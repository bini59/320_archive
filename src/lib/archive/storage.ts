import { mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { Archive, ArchiveMetadataStore } from "./types";

export class LocalArchiveMetadataStore implements ArchiveMetadataStore {
  private readonly archiveRoot: string;

  constructor(archiveRoot: string) {
    this.archiveRoot = archiveRoot;
  }

  async ensure(archive: Archive): Promise<void> {
    const directory = path.join(this.archiveRoot, archive.id);
    const metadataPath = path.join(directory, "metadata.json");
    const temporaryPath = path.join(directory, `.metadata-${process.pid}-${randomUUID()}.tmp`);
    await mkdir(directory, { recursive: true });
    try {
      const file = await open(temporaryPath, "wx");
      try {
        await file.writeFile(`${JSON.stringify(archive, null, 2)}\n`, "utf8");
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporaryPath, metadataPath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
