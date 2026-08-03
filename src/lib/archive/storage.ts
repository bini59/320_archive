import { mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Snapshot, SnapshotStore } from "./types";

export class LocalSnapshotStore implements SnapshotStore {
  constructor(private readonly archiveRoot:string) {}
  async save(id:string,bytes:Uint8Array,snapshot:Snapshot):Promise<void>{
    const dir=path.join(this.archiveRoot,id); await mkdir(dir,{recursive:true});
    const token=`${process.pid}-${randomUUID()}`, htmlTmp=path.join(dir,`.original-${token}.tmp`), jsonTmp=path.join(dir,`.snapshot-${token}.tmp`);
    try {
      await this.write(htmlTmp,bytes); await this.write(jsonTmp,Buffer.from(`${JSON.stringify(snapshot,null,2)}\n`));
      await rename(htmlTmp,path.join(dir,"original.html")); await rename(jsonTmp,path.join(dir,"snapshot.json"));
      const handle=await open(dir,"r"); try{await handle.sync();}finally{await handle.close();}
    } catch(error){ await Promise.all([htmlTmp,jsonTmp,path.join(dir,"original.html"),path.join(dir,"snapshot.json")].map(x=>rm(x,{force:true}).catch(()=>undefined))); throw error; }
  }
  async cleanup(id:string):Promise<void>{await rm(path.join(this.archiveRoot,id),{recursive:true,force:true});}
  private async write(target:string,data:Uint8Array){const file=await open(target,"wx");try{await file.writeFile(data);await file.sync();}finally{await file.close();}}
}
