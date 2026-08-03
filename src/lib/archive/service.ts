import { resolveArchiveConfig,type ArchiveConfigInput } from "./config"; import { SqliteArchiveRepository } from "./database"; import { SafeCaptureClient,CaptureError } from "./fetcher"; import { extractHtmlMetadata } from "./html"; import { ImmediateSemaphore } from "./limiter"; import { LocalSnapshotStore } from "./storage"; import { CAPTURE_FAILURE_MESSAGES,type Archive,type ArchiveCreationResult,type ArchiveRepository,type CaptureClient,type SnapshotStore,type CaptureFailureCode } from "./types"; import { normalizeArchiveUrl } from "./url";
export class ArchiveService {
  constructor(private repository:ArchiveRepository,private store:SnapshotStore,private capture:CaptureClient,private limiter:ImmediateSemaphore,private budget:{windowMs:number;maxSubmissions:number;maxStoredBytes:number;reserveBytes:number;timeoutMs:number}){}
  async create(originalUrl:string):Promise<ArchiveCreationResult>{const normalizedUrl=normalizeArchiveUrl(originalUrl);const result=this.repository.createOrGet({originalUrl,normalizedUrl});if(!result.created)return result;const release=this.limiter.tryAcquire();if(!release){return {archive:this.fail(result.archive.id,"overloaded"),created:true};}const reservation=this.repository.reserveBudget(this.budget);if(!reservation){release();return {archive:this.fail(result.archive.id,"rate_limited"),created:true};}try{const page=await this.capture.capture(normalizedUrl);const meta=extractHtmlMetadata(page.bytes);const snapshot={...meta,capturedAt:new Date().toISOString(),finalUrl:page.finalUrl,byteLength:page.bytes.byteLength};await this.store.save(result.archive.id,page.bytes,snapshot);if(!reservation.commit(snapshot.byteLength)){await this.store.cleanup(result.archive.id);return {archive:this.fail(result.archive.id,"quota_exceeded"),created:true};}return {archive:this.repository.markSaved(result.archive.id,snapshot)!,created:true};}catch(error){reservation.release();await this.store.cleanup(result.archive.id).catch(()=>undefined);const code:CaptureFailureCode=error instanceof CaptureError?error.code:"capture_failed";return {archive:this.fail(result.archive.id,code),created:true};}finally{release();}}
  private fail(id:string,code:CaptureFailureCode){return this.repository.markFailed(id,code,CAPTURE_FAILURE_MESSAGES[code])!;} findById(id:string):Archive|null{return this.repository.findById(id);} close(){this.repository.close();}
}
export interface ArchiveServiceDependencies { capture?: CaptureClient }
export function createArchiveService(input:ArchiveConfigInput={},dependencies:ArchiveServiceDependencies={}):ArchiveService{const c=resolveArchiveConfig(input);return new ArchiveService(new SqliteArchiveRepository(c.databasePath),new LocalSnapshotStore(c.archiveRoot),dependencies.capture??new SafeCaptureClient(c),new ImmediateSemaphore(c.maxConcurrent),{windowMs:c.rateWindowMs,maxSubmissions:c.maxSubmissionsPerWindow,maxStoredBytes:c.maxStoredBytes,reserveBytes:c.maxBytes,timeoutMs:c.timeoutMs});}
let defaultService:ArchiveService|undefined;
export function getArchiveService(){
  if(defaultService)return defaultService;
  if(process.env.ARCHIVE_E2E==="1"&&process.env.NODE_ENV!=="production"){
    const port=Number(process.env.ARCHIVE_E2E_FIXTURE_PORT),config=resolveArchiveConfig();
    if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error("Invalid E2E fixture port");
    const capture=new SafeCaptureClient({...config,
      resolver:async(hostname)=>hostname.endsWith(".fixture.test")?[{address:"93.184.216.34",family:4 as const}]:Promise.reject(new Error("E2E only permits fixture hosts")),
      connectionAddress:(_validated,url)=>{if(!url.hostname.endsWith(".fixture.test")||Number(url.port)!==port)throw new Error("Invalid E2E fixture origin");return {address:"127.0.0.1",family:4};},
    });
    defaultService=createArchiveService(config,{capture});
  }
  return defaultService??=createArchiveService();
}
