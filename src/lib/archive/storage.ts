import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { Asset, AssetKey, AssetManifest, AssetMimeType, CapturedAsset, Snapshot, SnapshotContent, SnapshotContentKind, SnapshotStore, StoredAsset } from "./types";
import { SnapshotContentNotFoundError } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_NAMES: Record<SnapshotContentKind, string> = { original: "original.html", readable: "readable.html", rendered: "rendered.html" };
const EXTENSIONS:Record<AssetMimeType,string>={"image/jpeg":"jpg","image/png":"png","image/gif":"gif","image/webp":"webp","image/avif":"avif","application/pdf":"pdf","text/plain":"txt","text/css":"css","font/woff":"woff","font/woff2":"woff2","font/ttf":"ttf","font/otf":"otf","application/font-woff":"woff","application/vnd.ms-fontobject":"eot"};
const ASSET_KEY=/^[a-f0-9]{64}\.(?:jpg|png|gif|webp|avif|pdf|txt|css|woff|woff2|ttf|otf|eot)$/;
interface LocalSnapshotStoreOptions {
  beforeContentOpen?: () => void | Promise<void>;
  afterRename?: () => void | Promise<void>;
}

export class LocalSnapshotStore implements SnapshotStore {
  constructor(private readonly archiveRoot: string, private readonly options: LocalSnapshotStoreOptions = {}) {}

  async save(id: string, original: Uint8Array, readable: Uint8Array, snapshot: Snapshot, capturedAssets: CapturedAsset[] = [], rendered: Uint8Array | null = null): Promise<AssetManifest> {
    this.validateId(id);
    await mkdir(this.archiveRoot, { recursive: true });
    const root = await realpath(this.archiveRoot);
    const dir = this.inside(root, id);
    const stage = this.inside(root, `.${id}-${process.pid}-${randomUUID()}.stage`);
    await mkdir(stage);
    const manifest:AssetManifest={version:1,assets:[]};
    let renamed = false;
    try {
      await this.write(path.join(stage, FILE_NAMES.original), original);
      await this.write(path.join(stage, FILE_NAMES.readable), readable);
      if (rendered) await this.write(path.join(stage, FILE_NAMES.rendered), rendered);
      await this.write(path.join(stage, "snapshot.json"), Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`));
      if(capturedAssets.length){const assetDir=path.join(stage,"assets");await mkdir(assetDir);for(const captured of capturedAssets){const digest=createHash("sha256").update(captured.bytes).digest("hex");const key=`${digest}.${EXTENSIONS[captured.mimeType]}` as AssetKey;await this.write(path.join(assetDir,key),captured.bytes).catch(async error=>{if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;});const asset:Asset={originalUrl:captured.originalUrl,finalUrl:captured.finalUrl,mimeType:captured.mimeType,byteLength:captured.bytes.byteLength,key};manifest.assets.push(asset);}const assetsHandle=await open(assetDir,"r");try{await assetsHandle.sync();}finally{await assetsHandle.close();}}
      const assetsJson = Buffer.from(`${JSON.stringify(manifest,null,2)}\n`);
      await this.write(path.join(stage,"assets.json"), assetsJson);
      manifest.storedByteLength = original.byteLength + readable.byteLength + (rendered?.byteLength ?? 0)
        + Buffer.byteLength(`${JSON.stringify(snapshot, null, 2)}\n`)
        + assetsJson.byteLength
        + manifest.assets.reduce((total, asset, index, all) => all.findIndex(candidate => candidate.key === asset.key) === index ? total + asset.byteLength : total, 0);
      const stageHandle = await open(stage, "r");
      try { await stageHandle.sync(); } finally { await stageHandle.close(); }
      await rename(stage, dir);
      renamed = true;
      await this.options.afterRename?.();
      const rootHandle = await open(root, "r");
      try { await rootHandle.sync(); } finally { await rootHandle.close(); }
      return manifest;
    } catch (error) {
      await rm(stage, { recursive: true, force: true }).catch(() => undefined);
      if (renamed) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  async readAsset(id:string,key:AssetKey|string):Promise<StoredAsset>{
    this.validateId(id);if(!ASSET_KEY.test(key))throw new SnapshotContentNotFoundError(id,"original");
    const root=await realpath(this.archiveRoot).catch(()=>{throw new SnapshotContentNotFoundError(id,"original");});
    try{const archiveDir=await realpath(this.inside(root,id));if(path.dirname(archiveDir)!==root)throw new Error("archive escaped root");const manifestHandle=await open(path.join(archiveDir,"assets.json"),constants.O_RDONLY|constants.O_NOFOLLOW);let manifest:AssetManifest;try{if(!(await manifestHandle.stat()).isFile())throw new Error("manifest not file");const opened=process.platform === "linux" ? await realpath(`/proc/self/fd/${manifestHandle.fd}`) : path.join(archiveDir,"assets.json");if(path.dirname(opened)!==archiveDir)throw new Error("manifest escaped");manifest=JSON.parse(await manifestHandle.readFile("utf8")) as AssetManifest;}finally{await manifestHandle.close();}const asset=manifest.assets.find(item=>item.key===key);if(!asset)throw new Error("not in manifest");const assetDir=await realpath(path.join(archiveDir,"assets"));if(path.dirname(assetDir)!==archiveDir)throw new Error("asset dir escaped");await this.options.beforeContentOpen?.();const handle=await open(this.inside(assetDir,key),constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=await handle.stat();if(!stat.isFile()||stat.size!==asset.byteLength)throw new Error("invalid asset");const opened=process.platform === "linux" ? await realpath(`/proc/self/fd/${handle.fd}`) : path.join(assetDir,key);if(path.dirname(opened)!==assetDir)throw new Error("asset escaped");return {asset,bytes:await handle.readFile()};}finally{await handle.close();}}catch{throw new SnapshotContentNotFoundError(id,"original");}
  }

  async read(id: string, kind: SnapshotContentKind): Promise<SnapshotContent> {
    this.validateId(id);
    const root = await realpath(this.archiveRoot).catch(() => { throw new SnapshotContentNotFoundError(id, kind); });
    try {
      const archiveDir = await realpath(this.inside(root, id));
      if (path.dirname(archiveDir) !== root) throw new Error("archive directory escaped root");
      await this.options.beforeContentOpen?.();
      const target = this.inside(archiveDir, FILE_NAMES[kind]);
      const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) throw new Error("not a regular file");
        const openedPath = process.platform === "linux" ? await realpath(`/proc/self/fd/${handle.fd}`) : await realpath(target);
        if (path.dirname(openedPath) !== archiveDir) throw new Error("opened content escaped archive directory");
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
