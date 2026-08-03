const decode = (value: string) => value.replace(/&(?:amp|lt|gt|quot|#39|#x27);/gi, e => ({"&amp;":"&","&lt;":"<","&gt;":">","&quot;":"\"","&#39;":"'","&#x27;":"'"}[e.toLowerCase()] ?? e)).replace(/\s+/g," ").trim();
const clean = (value: string | undefined, max: number) => value ? decode(value.replace(/<[^>]*>/g," ")).slice(0,max) || null : null;
export function extractHtmlMetadata(bytes: Uint8Array): {title:string|null;description:string|null} {
  const html=new TextDecoder("utf-8",{fatal:false}).decode(bytes);
  const title=clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1],300);
  let description: string|null=null;
  for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs=match[1]; const name=attrs.match(/(?:^|\s)(?:name|property)\s*=\s*["']?([^\s"'>]+)/i)?.[1]?.toLowerCase();
    if (name==='description'||name==='og:description') { description=clean(attrs.match(/(?:^|\s)content\s*=\s*(?:["']([^"']*)["']|([^\s>]+))/i)?.slice(1).find(Boolean),1000); if(description) break; }
  }
  return {title,description};
}
