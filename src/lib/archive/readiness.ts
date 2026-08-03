import { access, constants } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { resolveArchiveConfig, type ArchiveConfigInput } from "./config";

export async function checkArchiveReadiness(input: ArchiveConfigInput = {}): Promise<void> {
  const config = resolveArchiveConfig(input);
  const database = new DatabaseSync(config.databasePath);
  try {
    database.prepare("SELECT 1").get();
  } finally {
    database.close();
  }
  await access(path.dirname(config.databasePath), constants.R_OK | constants.W_OK);
  await access(config.archiveRoot, constants.R_OK | constants.W_OK);
}
