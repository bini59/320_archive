import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { Snapshot, SnapshotContent, SnapshotContentKind, SnapshotStore } from "./types";
import { SnapshotContentNotFoundError } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_NAMES: Record<SnapshotContentKind, string> = { original: "original.html", readable: "readable.html" };

export class LocalSnapshotStore implements SnapshotStore {
  constructor(private readonly archiveRoot: string) {}

  async save(id: string, original: Uint8Array, readable: Uint8Array, snapshot: Snapshot): Promise<void> {
    this.validateId(id);
    await mkdir(this.archiveRoot, { recursive: true });
    const root = await realpath(this.archiveRoot);
    const dir = this.inside(root, id);
    const stage = this.inside(root, `.${id}-${process.pid}-${randomUUID()}.stage`);
    await mkdir(stage);
    try {
      await this.write(path.join(stage, FILE_NAMES.original), original);
      await this.write(path.join(stage, FILE_NAMES.readable), readable);
      await this.write(path.join(stage, "snapshot.json"), Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`));
      const stageHandle = await open(stage, "r");
      try { await stageHandle.sync(); } finally { await stageHandle.close(); }
      await rename(stage, dir);
      const rootHandle = await open(root, "r");
      try { await rootHandle.sync(); } finally { await rootHandle.close(); }
    } catch (error) {
      await rm(stage, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  async read(id: string, kind: SnapshotContentKind): Promise<SnapshotContent> {
    this.validateId(id);
    const root = await realpath(this.archiveRoot).catch(() => { throw new SnapshotContentNotFoundError(id, kind); });
    try {
      const archiveDir = await realpath(this.inside(root, id));
      if (path.dirname(archiveDir) !== root) throw new Error("archive directory escaped root");
      const target = this.inside(archiveDir, FILE_NAMES[kind]);
      const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) throw new Error("not a regular file");
        return { kind, bytes: await handle.readFile() };
      } finally { await handle.close(); }
    } catch {
      throw new SnapshotContentNotFoundError(id, kind);
    }
  }

  async cleanup(id: string): Promise<void> {
    this.validateId(id);
    await rm(path.join(this.archiveRoot, id), { recursive: true, force: true });
  }

  private validateId(id: string) { if (!UUID.test(id)) throw new TypeError("Invalid archive id"); }
  private inside(root: string, child: string): string {
    const target = path.resolve(root, child);
    if (path.dirname(target) === root || target.startsWith(`${root}${path.sep}`)) return target;
    throw new TypeError("Snapshot path escaped archive root");
  }
  private async write(target: string, data: Uint8Array) {
    const file = await open(target, "wx");
    try { await file.writeFile(data); await file.sync(); } finally { await file.close(); }
  }
}
