import { mkdtemp, mkdir, readFile, readdir, rm, symlink } from "node:fs/promises";
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

  it("rejects traversal IDs and symbolic content files", async () => {
    const { root, store } = await fixture();
    await expect(store.read("../outside", "original")).rejects.toBeInstanceOf(TypeError);
    await mkdir(path.join(root, id));
    await symlink("/etc/passwd", path.join(root, id, "original.html"));
    await expect(store.read(id, "original")).rejects.toBeInstanceOf(SnapshotContentNotFoundError);
  });
});
