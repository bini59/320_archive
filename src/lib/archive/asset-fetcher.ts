import { ASSET_MIME_TYPES, type AssetFetcher, type AssetMimeType, type CapturedAsset } from "./types";
import { CaptureError, SafeFetchTransport, type FetcherOptions } from "./fetcher";

export function matchesAssetSignature(mime:AssetMimeType,bytes:Uint8Array):boolean {
  const b=Buffer.from(bytes);
  switch(mime){
    case "image/jpeg":return b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
    case "image/png":return b.length>=8&&b.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
    case "image/gif":return b.length>=6&&(b.subarray(0,6).toString("ascii")==="GIF87a"||b.subarray(0,6).toString("ascii")==="GIF89a");
    case "image/webp":return b.length>=12&&b.subarray(0,4).toString("ascii")==="RIFF"&&b.subarray(8,12).toString("ascii")==="WEBP";
    case "image/avif":return matchesAvifFtyp(b);
    case "application/pdf":return b.length>=5&&b.subarray(0,5).toString("ascii")==="%PDF-";
    case "text/plain":try{new TextDecoder("utf-8",{fatal:true}).decode(bytes);return !b.some(byte=>(byte<0x20&&byte!==0x09&&byte!==0x0a&&byte!==0x0d)||byte===0x7f);}catch{return false;}
  }
}

function matchesAvifFtyp(b:Buffer):boolean {
  if(b.length<16||b.subarray(4,8).toString("ascii")!=="ftyp")return false;
  const size=b.readUInt32BE(0);
  if(size<16||size>Math.min(b.length,4096)||size%4!==0)return false;
  for(let offset=8;offset+4<=size;offset+=4){
    if(offset===12)continue;
    const brand=b.subarray(offset,offset+4).toString("ascii");
    if(brand==="avif"||brand==="avis")return true;
  }
  return false;
}

export class SafeAssetFetcher implements AssetFetcher {
  private readonly transport: SafeFetchTransport;
  constructor(options: FetcherOptions) { this.transport = new SafeFetchTransport(options); }
  async fetch(originalUrl: string, signal?: AbortSignal): Promise<CapturedAsset> {
    const result = await this.transport.fetch(originalUrl, {
      accept: ASSET_MIME_TYPES.join(", "), allowedMimeTypes: ASSET_MIME_TYPES, invalidMimeCode: "unsupported_mime",
    }, signal);
    if(!matchesAssetSignature(result.contentType as AssetMimeType,result.bytes)) throw new CaptureError("unsupported_mime");
    return { originalUrl, finalUrl: result.finalUrl, mimeType: result.contentType as AssetMimeType, bytes: result.bytes };
  }
}
