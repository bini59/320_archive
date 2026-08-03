import { mkdirSync } from "node:fs";
import path from "node:path";

export interface ArchiveConfig {
  databasePath: string;
  archiveRoot: string;
}

export interface ArchiveConfigInput {
  databasePath?: string;
  archiveRoot?: string;
}

export function resolveArchiveConfig(input: ArchiveConfigInput = {}): ArchiveConfig {
  const databasePath = path.resolve(
    input.databasePath ?? process.env.ARCHIVE_DATABASE_PATH ?? "data/archive.db",
  );
  const archiveRoot = path.resolve(
    input.archiveRoot ?? process.env.ARCHIVE_STORAGE_ROOT ?? "data/archives",
  );
  mkdirSync(path.dirname(databasePath), { recursive: true });
  mkdirSync(archiveRoot, { recursive: true });
  return { databasePath, archiveRoot };
}
