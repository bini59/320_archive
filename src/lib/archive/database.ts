import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { ARCHIVE_STATUSES, CAPTURE_FAILURE_MESSAGES, type Archive,type ArchiveRepository,type CaptureFailureCode,type Snapshot } from "./types";

type Row=Record<string,unknown>;
const str=(v:unknown)=>typeof v==='string'?v:null;
function toArchive(row:Row):Archive { const status=str(row.status); if(!ARCHIVE_STATUSES.includes(status as never))throw new Error("Unknown status"); return {id:String(row.id),originalUrl:String(row.original_url),normalizedUrl:String(row.normalized_url),status:status as Archive["status"],createdAt:String(row.created_at),snapshot:status==='saved'?{title:str(row.title),description:str(row.description),capturedAt:String(row.captured_at),finalUrl:String(row.final_url),byteLength:Number(row.byte_length)}:null,failureCode:str(row.failure_code) as CaptureFailureCode|null,failureMessage:str(row.failure_message)}; }

export class SqliteArchiveRepository implements ArchiveRepository {
  private readonly database:DatabaseSync;
  constructor(path:string){this.database=new DatabaseSync(path);this.database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");this.migrate();}
  private migrate(){
    const existing=this.database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='archives'").get() as Row|undefined;
    if(existing && !String(existing.sql).includes("'saved'")){this.database.exec("ALTER TABLE archives RENAME TO archives_v1");}
    this.database.exec(`CREATE TABLE IF NOT EXISTS archives(id TEXT PRIMARY KEY,original_url TEXT NOT NULL,normalized_url TEXT NOT NULL UNIQUE,status TEXT NOT NULL CHECK(status IN ('pending','saved','failed')),created_at TEXT NOT NULL,title TEXT,description TEXT,captured_at TEXT,final_url TEXT,byte_length INTEGER,failure_code TEXT,failure_message TEXT) STRICT;
      CREATE TABLE IF NOT EXISTS capture_events(id INTEGER PRIMARY KEY, created_at INTEGER NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS storage_budget(singleton INTEGER PRIMARY KEY CHECK(singleton=1),used_bytes INTEGER NOT NULL,reserved_bytes INTEGER NOT NULL) STRICT;
      INSERT OR IGNORE INTO storage_budget VALUES(1,0,0);`);
    if(existing && !String(existing.sql).includes("'saved'")){this.database.exec("INSERT INTO archives(id,original_url,normalized_url,status,created_at) SELECT id,original_url,normalized_url,status,created_at FROM archives_v1; DROP TABLE archives_v1;");}
  }
  createOrGet(input:{originalUrl:string;normalizedUrl:string}){this.database.exec("BEGIN IMMEDIATE");try{const result=this.database.prepare("INSERT OR IGNORE INTO archives(id,original_url,normalized_url,status,created_at) VALUES(?,?,?,?,?)").run(randomUUID(),input.originalUrl,input.normalizedUrl,"pending",new Date().toISOString());const row=this.database.prepare("SELECT * FROM archives WHERE normalized_url=?").get(input.normalizedUrl) as Row;this.database.exec("COMMIT");return {archive:toArchive(row),created:Number(result.changes)===1};}catch(e){this.database.exec("ROLLBACK");throw e;}}
  findById(id:string){const row=this.database.prepare("SELECT * FROM archives WHERE id=?").get(id);return row?toArchive(row):null;}
  markSaved(id:string,s:Snapshot){this.database.prepare("UPDATE archives SET status='saved',title=?,description=?,captured_at=?,final_url=?,byte_length=?,failure_code=NULL,failure_message=NULL WHERE id=? AND status='pending'").run(s.title,s.description,s.capturedAt,s.finalUrl,s.byteLength,id);return this.findById(id);}
  markFailed(id:string,code:CaptureFailureCode,message:string){const safe=CAPTURE_FAILURE_MESSAGES[code]===message?message:CAPTURE_FAILURE_MESSAGES.capture_failed;this.database.prepare("UPDATE archives SET status='failed',failure_code=?,failure_message=? WHERE id=? AND status='pending'").run(code,safe,id);return this.findById(id);}
  reserveBudget(i:{windowMs:number;maxSubmissions:number;maxStoredBytes:number;reserveBytes:number}){this.database.exec("BEGIN IMMEDIATE");try{const now=Date.now();this.database.prepare("DELETE FROM capture_events WHERE created_at < ?").run(now-i.windowMs);const count=Number((this.database.prepare("SELECT COUNT(*) AS value FROM capture_events").get() as Row).value);const budget=this.database.prepare("SELECT * FROM storage_budget WHERE singleton=1").get() as Row;if(count>=i.maxSubmissions||Number(budget.used_bytes)+Number(budget.reserved_bytes)+i.reserveBytes>i.maxStoredBytes){this.database.exec("ROLLBACK");return null;}this.database.prepare("INSERT INTO capture_events(created_at) VALUES(?)").run(now);this.database.prepare("UPDATE storage_budget SET reserved_bytes=reserved_bytes+? WHERE singleton=1").run(i.reserveBytes);this.database.exec("COMMIT");let done=false;return {release:()=>{if(done)return;done=true;this.database.prepare("UPDATE storage_budget SET reserved_bytes=MAX(0,reserved_bytes-?) WHERE singleton=1").run(i.reserveBytes);},commit:(bytes:number)=>{if(done)return false;done=true;const r=this.database.prepare("UPDATE storage_budget SET reserved_bytes=MAX(0,reserved_bytes-?),used_bytes=used_bytes+? WHERE singleton=1 AND used_bytes+?<=?").run(i.reserveBytes,bytes,bytes,i.maxStoredBytes);return Number(r.changes)===1;}};}catch(e){this.database.exec("ROLLBACK");throw e;}}
  close(){this.database.close();}
}
