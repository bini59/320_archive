import http from "node:http";
import https from "node:https";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";
import type { CapturedPage } from "./types";
import { resolvePublicUrl, type AddressResolver, systemResolver } from "./url";

export type FetchFailureCode = "network"|"timeout"|"not_html"|"too_large"|"redirect"|"invalid_url"|"unsupported_mime";
export class CaptureError extends Error { constructor(readonly code:FetchFailureCode) { super(code); this.name="CaptureError"; } }
export interface FetcherOptions { timeoutMs:number; maxBytes:number; maxRedirects:number; resolver?:AddressResolver; connectionAddress?: (validatedAddress:string,url:URL)=>{address:string;family:4|6} }
export interface TransportResult { bytes:Uint8Array; finalUrl:string; contentType:string }
export interface TransportRequest { accept:string; allowedMimeTypes:readonly string[]; invalidMimeCode:"not_html"|"unsupported_mime" }

export class SafeFetchTransport {
  constructor(private readonly options:FetcherOptions) {}
  async fetch(input:string, request:TransportRequest, signal?:AbortSignal):Promise<TransportResult> {
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(new CaptureError("timeout")),this.options.timeoutMs);
    const abort=()=>controller.abort(signal?.reason); signal?.addEventListener("abort",abort,{once:true});
    try{return await this.follow(input,0,request,controller.signal);}
    catch(error){if(error instanceof CaptureError)throw error;if(controller.signal.aborted)throw new CaptureError("timeout");throw new CaptureError("network");}
    finally{clearTimeout(timeout);signal?.removeEventListener("abort",abort);}
  }
  private async follow(input:string,redirects:number,request:TransportRequest,signal:AbortSignal):Promise<TransportResult>{
    if(signal.aborted)throw signal.reason instanceof CaptureError?signal.reason:new CaptureError("timeout");
    let resolved;try{resolved=await Promise.race([resolvePublicUrl(input,this.options.resolver??systemResolver),new Promise<never>((_r,reject)=>{const abort=()=>reject(signal.reason instanceof CaptureError?signal.reason:new CaptureError("timeout"));if(signal.aborted)abort();else signal.addEventListener("abort",abort,{once:true});})]);}catch(error){if(error instanceof CaptureError)throw error;throw new CaptureError("invalid_url");}
    if(signal.aborted)throw signal.reason instanceof CaptureError?signal.reason:new CaptureError("timeout");
    const {url,addresses}=resolved;const validated=addresses[0];const chosen=this.options.connectionAddress?.(validated.address,url)??validated;
    const response=await new Promise<http.IncomingMessage>((resolve,reject)=>{if(signal.aborted){reject(signal.reason);return;}const transport=url.protocol==="https:"?https:http;const lookup:http.RequestOptions["lookup"]=(_h,o,cb)=>{if(typeof o==="object"&&o.all)(cb as (e:NodeJS.ErrnoException|null,a:Array<{address:string;family:4|6}>)=>void)(null,[chosen]);else(cb as (e:NodeJS.ErrnoException|null,a:string,f:4|6)=>void)(null,chosen.address,chosen.family);};const req=transport.request(url,{headers:{accept:request.accept,"accept-encoding":"gzip, deflate, br",host:url.host},servername:url.hostname,lookup},resolve);const onAbort=()=>req.destroy(signal.reason instanceof Error?signal.reason:new CaptureError("timeout"));signal.addEventListener("abort",onAbort,{once:true});req.once("error",reject);req.once("close",()=>signal.removeEventListener("abort",onAbort));req.end();});
    const status=response.statusCode??0;if(status>=300&&status<400&&response.headers.location){response.resume();if(redirects>=this.options.maxRedirects)throw new CaptureError("redirect");let next:string;try{next=new URL(response.headers.location,url).href;}catch{throw new CaptureError("redirect");}return this.follow(next,redirects+1,request,signal);}
    const type=String(response.headers["content-type"]??"").split(";",1)[0].trim().toLowerCase();if(!request.allowedMimeTypes.includes(type)){response.destroy();throw new CaptureError(request.invalidMimeCode);}
    const length=Number(response.headers["content-length"]);if(Number.isFinite(length)&&length>this.options.maxBytes){response.destroy();throw new CaptureError("too_large");}
    let stream:Readable=response;const encoding=String(response.headers["content-encoding"]??"").trim().toLowerCase();if(encoding==="gzip")stream=response.pipe(createGunzip());else if(encoding==="deflate")stream=response.pipe(createInflate());else if(encoding==="br")stream=response.pipe(createBrotliDecompress());else if(encoding&&encoding!=="identity"){response.destroy();throw new CaptureError("network");}
    const chunks:Buffer[]=[];let total=0;try{for await(const chunk of stream){const b=Buffer.from(chunk);total+=b.length;if(total>this.options.maxBytes){stream.destroy();response.destroy();throw new CaptureError("too_large");}chunks.push(b);}}catch(error){response.destroy();if(error instanceof CaptureError)throw error;throw new CaptureError("network");}
    return {bytes:Buffer.concat(chunks),finalUrl:url.href,contentType:type};
  }
}

export class SafeCaptureClient {
  private readonly transport:SafeFetchTransport;
  constructor(options:FetcherOptions){this.transport=new SafeFetchTransport(options);}
  capture(input:string,signal?:AbortSignal):Promise<CapturedPage>{return this.transport.fetch(input,{accept:"text/html",allowedMimeTypes:["text/html","application/xhtml+xml"],invalidMimeCode:"not_html"},signal);}
}
