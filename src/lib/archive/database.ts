import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { ARCHIVE_LIST_MAX_PAGE, ARCHIVE_LIST_PAGE_SIZE, ARCHIVE_SEARCH_MAX_TOKENS, ARCHIVE_SEARCH_QUERY_MAX_LENGTH, ARCHIVE_STATUSES, CAPTURE_FAILURE_MESSAGES, type Archive, type ArchiveRepository, type ArchiveVisibility, type CaptureFailureCode, type Folder, type PublicArchiveItem, type PublicArchiveQuery, type Snapshot, type Tag, type User } from "./types";
import { normalizeTagSlug } from "./tags";
type Row = Record<string, unknown>;
const str = (v: unknown) => typeof v === "string" ? v : null;

function archive(row: Row, tags: Tag[] = []): Archive {
  const status = String(row.status) as Archive["status"];
  if (!ARCHIVE_STATUSES.includes(status)) throw new Error("Unknown status");
  return { id: String(row.id), ownerId: String(row.owner_id), folderId: str(row.folder_id), visibility: String(row.visibility) as ArchiveVisibility, originalUrl: String(row.original_url), normalizedUrl: String(row.normalized_url), status, createdAt: String(row.created_at), snapshot: status === "saved" ? { title: str(row.title), description: str(row.description), capturedAt: String(row.captured_at), finalUrl: String(row.final_url), byteLength: Number(row.byte_length) } : null, failureCode: str(row.failure_code) as CaptureFailureCode | null, failureMessage: str(row.failure_message), tags };
}

export class SqliteArchiveRepository implements ArchiveRepository {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    this.migrate();
  }

  private migrate() {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const version = Number((this.database.prepare("PRAGMA user_version").get() as Row).user_version ?? 0);
      if (version < 5) {
        this.database.exec("DROP TABLE IF EXISTS archive_search; DROP TABLE IF EXISTS archive_tags; DROP TABLE IF EXISTS tags; DROP TABLE IF EXISTS capture_events; DROP TABLE IF EXISTS budget_reservations; DROP TABLE IF EXISTS storage_budget; DROP TABLE IF EXISTS archives_v1; DROP TABLE IF EXISTS archives;");
      }
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT,name TEXT,avatar_url TEXT,status TEXT NOT NULL CHECK(status IN ('active','disabled')),membership_role TEXT,membership_status TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL) STRICT;
        CREATE TABLE IF NOT EXISTS folders(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(owner_id,name)) STRICT;
        CREATE TABLE IF NOT EXISTS archives(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),original_url TEXT NOT NULL,normalized_url TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','saved','failed')),created_at TEXT NOT NULL,title TEXT,description TEXT,captured_at TEXT,final_url TEXT,byte_length INTEGER,failure_code TEXT,failure_message TEXT,UNIQUE(owner_id,normalized_url)) STRICT;
        CREATE TABLE IF NOT EXISTS capture_events(id INTEGER PRIMARY KEY,created_at INTEGER NOT NULL) STRICT;
        CREATE TABLE IF NOT EXISTS storage_budget(singleton INTEGER PRIMARY KEY CHECK(singleton=1),used_bytes INTEGER NOT NULL,reserved_bytes INTEGER NOT NULL) STRICT;
        CREATE TABLE IF NOT EXISTS budget_reservations(id TEXT PRIMARY KEY,bytes INTEGER NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL) STRICT;
        INSERT OR IGNORE INTO storage_budget VALUES(1,0,0);
        CREATE TABLE IF NOT EXISTS tags(id INTEGER PRIMARY KEY,name TEXT NOT NULL,slug TEXT NOT NULL UNIQUE) STRICT;
        CREATE TABLE IF NOT EXISTS archive_tags(archive_id TEXT NOT NULL REFERENCES archives(id) ON DELETE CASCADE,tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,PRIMARY KEY(archive_id,tag_id)) STRICT;
        CREATE VIRTUAL TABLE IF NOT EXISTS archive_search USING fts5(archive_id UNINDEXED,title,original_url,body);
        CREATE INDEX IF NOT EXISTS archives_owner_order ON archives(owner_id,folder_id,created_at DESC,id DESC);
        CREATE INDEX IF NOT EXISTS archives_public_order ON archives(visibility,status,captured_at DESC,id DESC);
        CREATE INDEX IF NOT EXISTS archive_tags_by_tag ON archive_tags(tag_id,archive_id);
        PRAGMA user_version=5;
      `);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private tags(id: string): Tag[] { return Array.from((this.database.prepare("SELECT t.name,t.slug FROM tags t JOIN archive_tags at ON at.tag_id=t.id WHERE at.archive_id=? ORDER BY t.slug") as any).all(id) as Iterable<Row>).map(r => ({ name: String(r.name), slug: String(r.slug) })); }
  private addTags(id: string, tags: Tag[]) { for (const tag of tags) { this.database.prepare("INSERT INTO tags(name,slug) VALUES(?,?) ON CONFLICT(slug) DO NOTHING").run(tag.name, tag.slug); this.database.prepare("INSERT OR IGNORE INTO archive_tags(archive_id,tag_id) SELECT ?,id FROM tags WHERE slug=?").run(id, tag.slug); } }
  upsertUser(i: { id: string; email: string | null; name: string | null; avatarUrl: string | null; membershipRole: string | null; membershipStatus: string | null }): User { const now = new Date().toISOString(); this.database.prepare(`INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,avatar_url=excluded.avatar_url,status=excluded.status,membership_role=excluded.membership_role,membership_status=excluded.membership_status,updated_at=excluded.updated_at`).run(i.id, i.email, i.name, i.avatarUrl, i.membershipStatus === "active" ? "active" : "disabled", i.membershipRole, i.membershipStatus, now, now); return this.findUser(i.id)!; }
  findUser(id: string): User | null { const r = this.database.prepare("SELECT * FROM users WHERE id=?").get(id) as Row | undefined; return r ? { id: String(r.id), email: str(r.email), name: str(r.name), avatarUrl: str(r.avatar_url), status: String(r.status) as User["status"], membershipRole: str(r.membership_role), membershipStatus: str(r.membership_status), createdAt: String(r.created_at), updatedAt: String(r.updated_at) } : null; }
  createFolder(ownerId: string, name: string): Folder { const clean = name.trim(); const user = this.findUser(ownerId); if (!clean || clean.length > 100 || !user || user.status !== "active") throw new Error("Invalid folder"); const now = new Date().toISOString(), id = randomUUID(); this.database.prepare("INSERT INTO folders VALUES(?,?,?,?,?)").run(id, ownerId, clean, now, now); return { id, ownerId, name: clean, createdAt: now, updatedAt: now }; }
  listFolders(ownerId: string): Folder[] { return Array.from((this.database.prepare("SELECT * FROM folders WHERE owner_id=? ORDER BY name") as any).all(ownerId) as Iterable<Row>).map(r => ({ id: String(r.id), ownerId: String(r.owner_id), name: String(r.name), createdAt: String(r.created_at), updatedAt: String(r.updated_at) })); }
  deleteFolder(ownerId: string, id: string) { return Number(this.database.prepare("DELETE FROM folders WHERE id=? AND owner_id=?").run(id, ownerId).changes) === 1; }
  renameFolder(ownerId: string, id: string, name: string) { const clean = name.trim(); if (!clean || clean.length > 100) throw new Error("Invalid folder"); const result = this.database.prepare("UPDATE folders SET name=?,updated_at=? WHERE id=? AND owner_id=?").run(clean, new Date().toISOString(), id, ownerId); if (Number(result.changes) !== 1) return null; const row = this.database.prepare("SELECT * FROM folders WHERE id=? AND owner_id=?").get(id, ownerId) as Row; return { id: String(row.id), ownerId: String(row.owner_id), name: String(row.name), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }; }
  setVisibility(ownerId: string, id: string, visibility: ArchiveVisibility) { return Number(this.database.prepare("UPDATE archives SET visibility=? WHERE id=? AND owner_id=?").run(visibility, id, ownerId).changes) === 1; }

  createOrGet(i: { ownerId?: string; folderId?: string | null; visibility?: ArchiveVisibility; originalUrl: string; normalizedUrl: string; tags?: Tag[] }): { archive: Archive; created: boolean } {
    if (process.env.NODE_ENV === "production" && !i.ownerId) throw new Error("Archive owner is required");
    const ownerId = i.ownerId ?? "e2e";
    if (!this.findUser(ownerId)) this.upsertUser({ id: ownerId, email: null, name: ownerId, avatarUrl: null, membershipRole: "member", membershipStatus: "active" });
    if (i.folderId && !this.database.prepare("SELECT id FROM folders WHERE id=? AND owner_id=?").get(i.folderId, ownerId)) throw new Error("Invalid folder");
    this.database.exec("BEGIN IMMEDIATE");
    try { const result = this.database.prepare("INSERT OR IGNORE INTO archives(id,owner_id,folder_id,visibility,original_url,normalized_url,status,created_at) VALUES(?,?,?,?,?,?,?,?)").run(randomUUID(), ownerId, i.folderId ?? null, i.visibility ?? (i.ownerId ? "private" : "public"), i.originalUrl, i.normalizedUrl, "pending", new Date().toISOString()); const row = this.database.prepare("SELECT * FROM archives WHERE owner_id=? AND normalized_url=?").get(ownerId, i.normalizedUrl) as Row; this.addTags(String(row.id), i.tags ?? []); this.database.exec("COMMIT"); return { archive: archive(row, this.tags(String(row.id))), created: Number(result.changes) === 1 }; } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
  findById(id: string) { const r = this.database.prepare("SELECT * FROM archives WHERE id=?").get(id) as Row | undefined; return r ? archive(r, this.tags(id)) : null; }
  findOwnedById(ownerId: string, id: string) { const r = this.database.prepare("SELECT * FROM archives WHERE id=? AND owner_id=?").get(id, ownerId) as Row | undefined; return r ? archive(r, this.tags(id)) : null; }
  findPublicById(id: string) { const r = this.database.prepare("SELECT * FROM archives WHERE id=? AND visibility='public' AND status='saved'").get(id) as Row | undefined; return r ? archive(r, this.tags(id)) : null; }
  listOwned(ownerId: string, folderId?: string | null) { const rows = (this.database.prepare(`SELECT * FROM archives WHERE owner_id=? ${folderId === undefined ? "" : "AND folder_id IS ?"} ORDER BY created_at DESC,id DESC`) as any).all(...(folderId === undefined ? [ownerId] : [ownerId, folderId])) as Iterable<Row>; return Array.from(rows, r => archive(r, this.tags(String(r.id)))); }

  private saveArchive(id: string, s: Snapshot, indexText: string, tags: Tag[]) {
    const result = this.database.prepare("UPDATE archives SET status='saved',title=?,description=?,captured_at=?,final_url=?,byte_length=?,failure_code=NULL,failure_message=NULL WHERE id=? AND status='pending'").run(s.title, s.description, s.capturedAt, s.finalUrl, s.byteLength, id);
    if (Number(result.changes) !== 1) return false;
    this.addTags(id, tags);
    this.database.prepare("DELETE FROM archive_search WHERE archive_id=?").run(id);
    const original = String((this.database.prepare("SELECT original_url FROM archives WHERE id=?").get(id) as Row).original_url);
    this.database.prepare("INSERT INTO archive_search VALUES(?,?,?,?)").run(id, s.title ?? "", original, indexText);
    return true;
  }
  markSaved(id: string, s: Snapshot, indexText = "", tags: Tag[] = []) { this.database.exec("BEGIN IMMEDIATE"); try { this.saveArchive(id, s, indexText, tags); this.database.exec("COMMIT"); return this.findById(id); } catch (error) { this.database.exec("ROLLBACK"); throw error; } }
  markFailed(id: string, code: CaptureFailureCode, message: string) { const safe = CAPTURE_FAILURE_MESSAGES[code] === message ? message : CAPTURE_FAILURE_MESSAGES.capture_failed; this.database.prepare("UPDATE archives SET status='failed',failure_code=?,failure_message=? WHERE id=? AND status='pending'").run(code, safe, id); return this.findById(id); }
  listPublic(i: PublicArchiveQuery) { const page = Math.min(ARCHIVE_LIST_MAX_PAGE, Math.max(1, Number.isSafeInteger(i.page) ? i.page! : 1)), tag = normalizeTagSlug(i.tag) ?? "", tokens = (i.q ?? "").slice(0, ARCHIVE_SEARCH_QUERY_MAX_LENGTH).normalize("NFKC").match(/[\p{L}\p{N}]+/gu)?.slice(0, ARCHIVE_SEARCH_MAX_TOKENS) ?? [], match = tokens.map(t => `"${t.replaceAll('"', '""')}"`).join(" AND "), joins = `${match ? "JOIN archive_search f ON f.archive_id=a.id" : ""} ${tag ? "JOIN archive_tags at ON at.archive_id=a.id JOIN tags filter_tag ON filter_tag.id=at.tag_id" : ""}`, where = `a.status='saved' AND a.visibility='public' ${match ? "AND archive_search MATCH ?" : ""} ${tag ? "AND filter_tag.slug=?" : ""}`, params = [...(match ? [match] : []), ...(tag ? [tag] : [])]; const total = Number((this.database.prepare(`SELECT COUNT(DISTINCT a.id) value FROM archives a ${joins} WHERE ${where}`).get(...params) as Row).value); const rows = (this.database.prepare(`SELECT DISTINCT a.id,a.original_url,a.title,a.description,a.captured_at FROM archives a ${joins} WHERE ${where} ORDER BY a.captured_at DESC,a.id DESC LIMIT ? OFFSET ?`) as any).all(...params, ARCHIVE_LIST_PAGE_SIZE, (page - 1) * ARCHIVE_LIST_PAGE_SIZE) as Iterable<Row>; return { items: Array.from(rows, r => ({ id: String(r.id), originalUrl: String(r.original_url), title: str(r.title), description: str(r.description), capturedAt: String(r.captured_at), tags: this.tags(String(r.id)) } as PublicArchiveItem)), total, page, pageSize: ARCHIVE_LIST_PAGE_SIZE, pageCount: Math.ceil(total / ARCHIVE_LIST_PAGE_SIZE) }; }

  reserveBudget(i: { windowMs: number; maxSubmissions: number; maxStoredBytes: number; reserveBytes: number; timeoutMs: number }) {
    this.database.exec("BEGIN IMMEDIATE");
    try { const now = Date.now(), id = randomUUID(), expires = now + i.timeoutMs + 30000; this.database.prepare("DELETE FROM capture_events WHERE created_at<?").run(now - i.windowMs); this.database.prepare("DELETE FROM budget_reservations WHERE expires_at<=?").run(now); const count = Number((this.database.prepare("SELECT COUNT(*) value FROM capture_events").get() as Row).value), used = Number((this.database.prepare("SELECT used_bytes FROM storage_budget WHERE singleton=1").get() as Row).used_bytes), reserved = Number((this.database.prepare("SELECT COALESCE(SUM(bytes),0) value FROM budget_reservations").get() as Row).value); if (count >= i.maxSubmissions || used + reserved + i.reserveBytes > i.maxStoredBytes) { this.database.exec("ROLLBACK"); return null; } this.database.prepare("INSERT INTO capture_events(created_at) VALUES(?)").run(now); this.database.prepare("INSERT INTO budget_reservations VALUES(?,?,?,?)").run(id, i.reserveBytes, now, expires); this.database.exec("COMMIT"); let done = false; return { release: () => { if (!done) { this.database.prepare("DELETE FROM budget_reservations WHERE id=?").run(id); done = true; } }, finalizeSaved: (s: { archiveId: string; snapshot: Snapshot; indexText: string; tags: Tag[]; byteLength: number }) => { if (done) return null; this.database.exec("BEGIN IMMEDIATE"); try { const reservation = this.database.prepare("SELECT id FROM budget_reservations WHERE id=?").get(id); if (!reservation) { this.database.exec("ROLLBACK"); done = true; return null; } const a = this.database.prepare("SELECT status FROM archives WHERE id=?").get(s.archiveId) as Row | undefined; if (!a || a.status !== "pending") throw new Error("Archive is not pending"); const updated = this.database.prepare("UPDATE storage_budget SET used_bytes=used_bytes+? WHERE singleton=1 AND used_bytes+?<=?").run(s.byteLength, s.byteLength, i.maxStoredBytes); if (Number(updated.changes) !== 1) { this.database.exec("ROLLBACK"); done = true; return null; } if (!this.saveArchive(s.archiveId, s.snapshot, s.indexText, s.tags)) throw new Error("Archive is not pending"); this.database.prepare("DELETE FROM budget_reservations WHERE id=?").run(id); this.database.exec("COMMIT"); done = true; return this.findById(s.archiveId); } catch (error) { this.database.exec("ROLLBACK"); throw error; } } }; } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
  close() { this.database.close(); }
}
