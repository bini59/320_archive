export interface AssetCandidate { url: string; kind: "image" | "attachment" }

function safeUrl(value: string, baseUrl: string): string | null {
  try { const url=new URL(value,baseUrl);if(!/^https?:$/.test(url.protocol)||url.username||url.password)return null;url.hash="";return url.href; } catch { return null; }
}
function srcsetUrls(value:string):string[]{return value.split(",").map(part=>part.trim().split(/\s+/,1)[0]).filter(Boolean);}

export function discoverAssetCandidates(html:string,baseUrl:string,maxAssets=20):AssetCandidate[]{
  const candidates:AssetCandidate[]=[];const seen=new Set<string>();
  const add=(raw:string,kind:AssetCandidate["kind"])=>{const url=safeUrl(raw,baseUrl);if(url&&!seen.has(url)&&candidates.length<maxAssets){seen.add(url);candidates.push({url,kind});}};
  const tagPattern=/<(img|a)\b[^>]*>/gi;let match:RegExpExecArray|null;
  while((match=tagPattern.exec(html))&&candidates.length<maxAssets){const tag=match[0];const name=match[1].toLowerCase();if(name==="img"){const src=/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);if(src)add(src[1]??src[2]??src[3],"image");const srcset=/\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);if(srcset)for(const url of srcsetUrls(srcset[1]??srcset[2]??srcset[3]))add(url,"image");}else{const href=/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);if(href){const raw=href[1]??href[2]??href[3];let pathname="";try{pathname=new URL(raw,baseUrl).pathname.toLowerCase();}catch{}if(pathname.endsWith(".pdf")||pathname.endsWith(".txt"))add(raw,"attachment");}}
  }
  return candidates;
}
