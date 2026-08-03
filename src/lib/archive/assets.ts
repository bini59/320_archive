export interface AssetCandidate { url: string; kind: "image" | "attachment" }
import { createHash } from "node:crypto";
import type { AssetKey, CapturedAsset } from "./types";

const EXTENSIONS = {"image/jpeg":"jpg","image/png":"png","image/gif":"gif","image/webp":"webp","image/avif":"avif","application/pdf":"pdf","text/plain":"txt"} as const;

function safeUrl(value: string, baseUrl: string): string | null {
  try { const url=new URL(value,baseUrl);if(!/^https?:$/.test(url.protocol)||url.username||url.password)return null;url.hash="";return url.href; } catch { return null; }
}

function documentBase(html: string, pageUrl: string): string {
  const baseTag = /<base\b[^>]*>/i.exec(html)?.[0];
  const href = baseTag ? attribute(baseTag, "href") : null;
  return (href && safeUrl(href, pageUrl)) ?? pageUrl;
}

export function capturedAssetKey(asset: CapturedAsset): AssetKey {
  return `${createHash("sha256").update(asset.bytes).digest("hex")}.${EXTENSIONS[asset.mimeType]}` as AssetKey;
}

function attribute(tag:string,name:string):string|null { const match=new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,"i").exec(tag);return match?(match[1]??match[2]??match[3]):null; }
function replaceAttribute(tag:string,name:string,value:string|null):string { const pattern=new RegExp(`\\s+${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`,"i");return value===null?tag.replace(pattern,""):pattern.test(tag)?tag.replace(pattern,` ${name}="${value}"`):tag.replace(/\s*\/?\s*>$/,match=>` ${name}="${value}"${match}`); }
function assetPath(id:string,asset:CapturedAsset):string{return `/archives/${encodeURIComponent(id)}/assets/${capturedAssetKey(asset)}`;}

/** Rewrites only captured references and removes every remote fallback. */
export function rewriteAssetReferences(html:string,baseUrl:string,archiveId:string,assets:CapturedAsset[]):string {
  baseUrl=documentBase(html,baseUrl);
  const byUrl=new Map(assets.map(asset=>[asset.originalUrl,asset]));
  const resolve=(raw:string|null)=>raw?safeUrl(raw,baseUrl):null;
  return html.replace(/<(img|a)\b[^>]*>/gi,(tag:string,name:string)=>{
    if(name.toLowerCase()==="img"){
      const src=resolve(attribute(tag,"src"));const captured=src?byUrl.get(src):undefined;
      let next=replaceAttribute(tag,"src",captured?assetPath(archiveId,captured):null);
      const srcset=attribute(tag,"srcset");
      if(srcset){const entries=srcset.split(",").map(part=>{const bits=part.trim().split(/\s+/);const url=resolve(bits[0]);const asset=url?byUrl.get(url):undefined;return asset?`${assetPath(archiveId,asset)}${bits.slice(1).length?` ${bits.slice(1).join(" ")}`:""}`:null;}).filter(Boolean);next=replaceAttribute(next,"srcset",entries.length?entries.join(", "):null);}
      return next;
    }
    const href=attribute(tag,"href");const resolved=resolve(href);if(!resolved)return tag;
    let candidate=false;try{const path=new URL(resolved).pathname.toLowerCase();candidate=path.endsWith(".pdf")||path.endsWith(".txt");}catch{}
    if(!candidate)return tag;const captured=byUrl.get(resolved);return replaceAttribute(tag,"href",captured?assetPath(archiveId,captured):null);
  });
}
function srcsetUrls(value:string):string[]{return value.split(",").map(part=>part.trim().split(/\s+/,1)[0]).filter(Boolean);}

export function discoverAssetCandidates(html:string,baseUrl:string,maxAssets=20):AssetCandidate[]{
  baseUrl=documentBase(html,baseUrl);
  const candidates:AssetCandidate[]=[];const seen=new Set<string>();
  const add=(raw:string,kind:AssetCandidate["kind"])=>{const url=safeUrl(raw,baseUrl);if(url&&!seen.has(url)&&candidates.length<maxAssets){seen.add(url);candidates.push({url,kind});}};
  const tagPattern=/<(img|a)\b[^>]*>/gi;let match:RegExpExecArray|null;
  while((match=tagPattern.exec(html))&&candidates.length<maxAssets){const tag=match[0];const name=match[1].toLowerCase();if(name==="img"){const src=/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);if(src)add(src[1]??src[2]??src[3],"image");const srcset=/\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);if(srcset)for(const url of srcsetUrls(srcset[1]??srcset[2]??srcset[3]))add(url,"image");}else{const href=/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);if(href){const raw=href[1]??href[2]??href[3];let pathname="";try{pathname=new URL(raw,baseUrl).pathname.toLowerCase();}catch{}if(pathname.endsWith(".pdf")||pathname.endsWith(".txt"))add(raw,"attachment");}}
  }
  return candidates;
}
