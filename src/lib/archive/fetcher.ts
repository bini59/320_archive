import http from "node:http";
import https from "node:https";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";
import type { CapturedPage } from "./types";
import { resolvePublicUrl, type AddressResolver, systemResolver } from "./url";

export type FetchFailureCode = "network"|"timeout"|"not_html"|"too_large"|"redirect"|"invalid_url";
export class CaptureError extends Error { constructor(readonly code:FetchFailureCode) { super(code); this.name="CaptureError"; } }
export interface FetcherOptions { timeoutMs:number; maxBytes:number; maxRedirects:number; resolver?:AddressResolver }

export class SafeCaptureClient {
  constructor(private readonly options:FetcherOptions) {}
  async capture(input:string, signal?:AbortSignal):Promise<CapturedPage> {
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(new CaptureError("timeout")),this.options.timeoutMs);
    const abort=()=>controller.abort(signal?.reason); signal?.addEventListener("abort",abort,{once:true});
    try { return await this.follow(input,0,controller.signal); }
    catch(error) { if(error instanceof CaptureError) throw error; if(controller.signal.aborted) throw new CaptureError("timeout"); throw new CaptureError("network"); }
    finally { clearTimeout(timeout); signal?.removeEventListener("abort",abort); }
  }
  private async follow(input:string, redirects:number, signal:AbortSignal):Promise<CapturedPage> {
    let resolved; try { resolved=await resolvePublicUrl(input,this.options.resolver??systemResolver); } catch { throw new CaptureError("invalid_url"); }
    const {url,addresses}=resolved; const chosen=addresses[0];
    const response=await new Promise<http.IncomingMessage>((resolve,reject)=>{
      const transport=url.protocol==='https:'?https:http;
      const request=transport.request(url,{headers:{accept:"text/html","accept-encoding":"gzip, deflate, br",host:url.host},servername:url.hostname,lookup:(_h,_o,cb)=>cb(null,chosen.address,chosen.family)},resolve);
      const onAbort=()=>request.destroy(signal.reason instanceof Error?signal.reason:new CaptureError("timeout")); signal.addEventListener("abort",onAbort,{once:true});
      request.once("error",reject); request.once("close",()=>signal.removeEventListener("abort",onAbort)); request.end();
    });
    const status=response.statusCode??0;
    if(status>=300&&status<400&&response.headers.location){ response.resume(); if(redirects>=this.options.maxRedirects) throw new CaptureError("redirect"); let next:string; try{next=new URL(response.headers.location,url).href;}catch{throw new CaptureError("redirect");} return this.follow(next,redirects+1,signal); }
    const type=String(response.headers["content-type"]??"").split(";",1)[0].trim().toLowerCase();
    if(type!=="text/html"&&type!=="application/xhtml+xml"){response.destroy();throw new CaptureError("not_html");}
    const length=Number(response.headers["content-length"]); if(Number.isFinite(length)&&length>this.options.maxBytes){response.destroy();throw new CaptureError("too_large");}
    let stream:Readable=response; const encoding=String(response.headers["content-encoding"]??"").toLowerCase();
    if(encoding==='gzip') stream=response.pipe(createGunzip()); else if(encoding==='deflate') stream=response.pipe(createInflate()); else if(encoding==='br') stream=response.pipe(createBrotliDecompress());
    const chunks:Buffer[]=[]; let total=0;
    try { for await(const chunk of stream){const b=Buffer.from(chunk);total+=b.length;if(total>this.options.maxBytes){stream.destroy();response.destroy();throw new CaptureError("too_large");}chunks.push(b);} }
    catch(error){response.destroy();if(error instanceof CaptureError)throw error;throw new CaptureError("network");}
    return {bytes:Buffer.concat(chunks),finalUrl:url.href,contentType:type};
  }
}
