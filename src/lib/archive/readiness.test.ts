import { chmod, mkdir, mkdtemp, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkArchiveReadiness } from "./readiness";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(async (root) => {
  await chmod(root, 0o700).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
})));

describe("checkArchiveReadiness", () => {
  it("opens the database and verifies both storage locations are writable", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "archive-ready-"));
    roots.push(root);
    await expect(checkArchiveReadiness({
      databasePath: path.join(root, "db", "archive.db"),
      archiveRoot: path.join(root, "archives"),
    })).resolves.toBeUndefined();
    const database = new DatabaseSync(path.join(root, "db", "archive.db"));
    expect(database.prepare("SELECT name FROM sqlite_master WHERE name='__archive_readiness_probe'").get()).toBeUndefined();
    database.close();
  });

  it("rejects a database that cannot acquire a write transaction", async () => {
    if (process.getuid?.() === 0) return;
    const root = await mkdtemp(path.join(os.tmpdir(), "archive-ready-readonly-"));
    roots.push(root);
    const databasePath = path.join(root, "archive.db");
    const database = new DatabaseSync(databasePath);
    database.exec("CREATE TABLE existing(value INTEGER)");
    database.close();
    await mkdir(path.join(root, "archives"));
    await chmod(databasePath, 0o444);
    await chmod(root, 0o555);
    await expect(checkArchiveReadiness({ databasePath, archiveRoot: path.join(root, "archives") })).rejects.toThrow();
  });
});
