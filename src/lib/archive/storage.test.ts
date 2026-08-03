import { mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalSnapshotStore } from "./storage";
import { SnapshotContentNotFoundError, type Snapshot } from "./types";

const roots: string[] = [];
const id = "1527dbe2-42b2-4bf1-a5e0-c6e42d6c8d24";
const snapshot: Snapshot = { title: "Title", description: null, capturedAt: "2026-08-03T00:00:00.000Z", finalUrl: "https://example.com", byteLength: 8 };
async function fixture() { const root = await mkdtemp(path.join(os.tmpdir(), "snapshot-store-")); roots.push(root); return { root, store: new LocalSnapshotStore(root) }; }
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("LocalSnapshotStore", () => {
  it("atomically saves and reads both fixed content kinds", async () => {
    const { root, store } = await fixture();
    await store.save(id, Buffer.from("original"), Buffer.from("readable"), snapshot);
    expect(new TextDecoder().decode((await store.read(id, "original")).bytes)).toBe("original");
    expect(new TextDecoder().decode((await store.read(id, "readable")).bytes)).toBe("readable");
    expect(JSON.parse(await readFile(path.join(root, id, "snapshot.json"), "utf8"))).toEqual(snapshot);
    expect((await readdir(root)).filter((name) => name.endsWith(".stage"))).toEqual([]);
  });

  it("reports a missing legacy readable file with a typed error", async () => {
    const { root, store } = await fixture();
    await mkdir(path.join(root, id));
    await expect(store.read(id, "readable")).rejects.toBeInstanceOf(SnapshotContentNotFoundError);
  });

  it("stores digest-keyed assets and only reads manifest members",async()=>{const {root,store}=await fixture();const manifest=await store.save(id,Buffer.from("o"),Buffer.from("r"),snapshot,[{originalUrl:"https://example.com/a.png",finalUrl:"https://cdn.example/a.png",mimeType:"image/png",bytes:Buffer.from([1,2,3])}]);expect(manifest.assets[0].key).toMatch(/^[a-f0-9]{64}\.png$/);expect((await store.readAsset(id,manifest.assets[0].key)).bytes).toEqual(Buffer.from([1,2,3]));await writeFile(path.join(root,id,"assets","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"),"secret");await expect(store.readAsset(id,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png")).rejects.toBeInstanceOf(SnapshotContentNotFoundError);});

  it("rejects traversal IDs and symbolic content files", async () => {
    const { root, store } = await fixture();
    await expect(store.read("../outside", "original")).rejects.toBeInstanceOf(TypeError);
    await mkdir(path.join(root, id));
    await symlink("/etc/passwd", path.join(root, id, "original.html"));
    await expect(store.read(id, "original")).rejects.toBeInstanceOf(SnapshotContentNotFoundError);
  });

  it("rejects a symbolic archive directory that escapes the canonical root", async () => {
    const { root, store } = await fixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "snapshot-outside-"));
    roots.push(outside);
    await writeFile(path.join(outside, "original.html"), "outside secret");
    await symlink(outside, path.join(root, id));
    await expect(store.read(id, "original")).rejects.toBeInstanceOf(SnapshotContentNotFoundError);
  });

  it("rejects content opened through a parent directory replaced after validation", async () => {
    const { root } = await fixture();
    const archiveDir = path.join(root, id);
    const displacedDir = path.join(root, "displaced");
    const outside = await mkdtemp(path.join(os.tmpdir(), "snapshot-race-outside-"));
    roots.push(outside);
    await mkdir(archiveDir);
    await writeFile(path.join(archiveDir, "original.html"), "trusted");
    await writeFile(path.join(outside, "original.html"), "outside secret");
    const store = new LocalSnapshotStore(root, { beforeContentOpen: async () => {
      await rename(archiveDir, displacedDir);
      await symlink(outside, archiveDir);
    } });

    await expect(store.read(id, "original")).rejects.toBeInstanceOf(SnapshotContentNotFoundError);
  });
});
