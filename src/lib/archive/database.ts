import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

import { ARCHIVE_STATUS, type Archive, type ArchiveRepository } from "./types";

interface ArchiveRow {
  id: string;
  original_url: string;
  normalized_url: string;
  status: string;
  created_at: string;
}

function toArchive(row: ArchiveRow): Archive {
  if (row.status !== ARCHIVE_STATUS) throw new Error(`Unknown archive status: ${row.status}`);
  return {
    id: row.id,
    originalUrl: row.original_url,
    normalizedUrl: row.normalized_url,
    status: row.status,
    createdAt: row.created_at,
  };
}

export class SqliteArchiveRepository implements ArchiveRepository {
  private readonly database: DatabaseSync;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS archives (
        id TEXT PRIMARY KEY,
        original_url TEXT NOT NULL,
        normalized_url TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status = 'pending'),
        created_at TEXT NOT NULL
      ) STRICT
    `);
  }

  createOrGet(input: { originalUrl: string; normalizedUrl: string }) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database
        .prepare(`
          INSERT OR IGNORE INTO archives
            (id, original_url, normalized_url, status, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(randomUUID(), input.originalUrl, input.normalizedUrl, ARCHIVE_STATUS, new Date().toISOString());
      const row = this.database
        .prepare("SELECT * FROM archives WHERE normalized_url = ?")
        .get(input.normalizedUrl) as unknown as ArchiveRow | undefined;
      if (!row) throw new Error("Archive was not persisted");
      this.database.exec("COMMIT");
      return { archive: toArchive(row), created: Number(result.changes) === 1 };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  findById(id: string): Archive | null {
    const row = this.database.prepare("SELECT * FROM archives WHERE id = ?").get(id) as
      | (ArchiveRow & Record<string, unknown>)
      | undefined;
    return row ? toArchive(row) : null;
  }

  close(): void {
    this.database.close();
  }
}
