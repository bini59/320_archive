import { mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Snapshot, SnapshotStore } from "./types";

export class LocalSnapshotStore implements SnapshotStore {
  constructor(private readonly archiveRoot:string) {}
  async save(id:string,bytes:Uint8Array,snapshot:Snapshot):Promise<void>{
    const dir=path.join(this.archiveRoot,id), token=`${process.pid}-${randomUUID()}`, stage=path.join(this.archiveRoot,`.${id}-${token}.stage`);
    const htmlTmp=path.join(stage,"original.html"), jsonTmp=path.join(stage,"snapshot.json"); await mkdir(stage,{recursive:true});
    try {
      await this.write(htmlTmp,bytes); await this.write(jsonTmp,Buffer.from(`${JSON.stringify(snapshot,null,2)}\n`));
      await rename(stage,dir); const handle=await open(this.archiveRoot,"r"); try{await handle.sync();}finally{await handle.close();}
    } catch(error){ await rm(stage,{recursive:true,force:true}).catch(()=>undefined); throw error; }
  }
  async cleanup(id:string):Promise<void>{await rm(path.join(this.archiveRoot,id),{recursive:true,force:true});}
  private async write(target:string,data:Uint8Array){const file=await open(target,"wx");try{await file.writeFile(data);await file.sync();}finally{await file.close();}}
}
