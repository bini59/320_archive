import { access, constants } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { resolveArchiveConfig, type ArchiveConfigInput } from "./config";

export async function checkArchiveReadiness(input: ArchiveConfigInput = {}): Promise<void> {
  const config = resolveArchiveConfig(input);
  const database = new DatabaseSync(config.databasePath);
  try {
    database.exec("BEGIN IMMEDIATE");
    try {
      // Exercise a real main-database write without leaving health-check state behind.
      database.exec("CREATE TABLE __archive_readiness_probe(value INTEGER); ROLLBACK");
    } catch (error) {
      try { database.exec("ROLLBACK"); } catch { /* transaction did not start */ }
      throw error;
    }
  } finally {
    database.close();
  }
  await access(path.dirname(config.databasePath), constants.R_OK | constants.W_OK);
  await access(config.archiveRoot, constants.R_OK | constants.W_OK);
}
