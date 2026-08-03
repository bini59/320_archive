import { promises as dns } from "node:dns";
import { isIP } from "node:net";

export class ArchiveUrlError extends Error { constructor(message: string) { super(message); this.name = "ArchiveUrlError"; } }
export interface ResolvedAddress { address: string; family: 4 | 6 }
export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

function ipv4Number(address: string): number | null {
  const parts = address.split("."); if (parts.length !== 4) return null;
  const bytes = parts.map(Number); if (bytes.some((v, i) => !/^\d+$/.test(parts[i]) || v < 0 || v > 255)) return null;
  return ((bytes[0] * 0x1000000) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) >>> 0;
}
function inV4(value: number, base: string, prefix: number): boolean {
  const network = ipv4Number(base)!; const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (network & mask);
}
const BLOCKED_V4: Array<[string, number]> = [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]];
function expandV6(address: string): number[] | null {
  let source = address.toLowerCase().split("%")[0];
  if (source.includes(".")) { const last = source.slice(source.lastIndexOf(":") + 1); const n = ipv4Number(last); if (n === null) return null; source = `${source.slice(0, source.lastIndexOf(":"))}:${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`; }
  const chunks = source.split("::"); if (chunks.length > 2) return null;
  const left = chunks[0] ? chunks[0].split(":") : [], right = chunks[1] ? chunks[1].split(":") : [];
  const middle = chunks.length === 2 ? Array(8-left.length-right.length).fill("0") : [];
  const values = [...left,...middle,...right].map((x) => Number.parseInt(x,16));
  return values.length === 8 && values.every((x) => Number.isInteger(x) && x >= 0 && x <= 0xffff) ? values : null;
}
export function isGlobalUnicastAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) { const value = ipv4Number(address)!; return !BLOCKED_V4.some(([base,prefix]) => inV4(value,base,prefix)); }
  if (family !== 6) return false; const p = expandV6(address); if (!p) return false;
  if (p.slice(0,5).every(x=>x===0) && (p[5] === 0xffff || p[5] === 0)) return isGlobalUnicastAddress(`${p[6]>>8}.${p[6]&255}.${p[7]>>8}.${p[7]&255}`);
  if (p.every(x=>x===0) || (p.slice(0,7).every(x=>x===0) && p[7]===1)) return false;
  if ((p[0]&0xfe00)===0xfc00 || (p[0]&0xffc0)===0xfe80 || (p[0]&0xff00)===0xff00 || p[0]===0x2001 && (p[1]===0x0db8 || p[1]===0x0010)) return false;
  return true;
}
export function parseArchiveUrl(input: string): URL {
  if (Buffer.byteLength(input,"utf8") > 8192) throw new ArchiveUrlError("URL이 너무 깁니다.");
  let url: URL; try { url = new URL(input); } catch { throw new ArchiveUrlError("올바른 URL을 입력해 주세요."); }
  if (!['http:','https:'].includes(url.protocol)) throw new ArchiveUrlError("HTTP 또는 HTTPS URL만 보관할 수 있습니다.");
  if (url.username || url.password) throw new ArchiveUrlError("사용자 정보가 포함된 URL은 보관할 수 없습니다.");
  const host=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
  if (host==='localhost'||host.endsWith('.localhost')) throw new ArchiveUrlError("로컬 주소는 보관할 수 없습니다.");
  if (isIP(host) && !isGlobalUnicastAddress(host)) throw new ArchiveUrlError("내부 네트워크 주소는 보관할 수 없습니다.");
  return url;
}
export function normalizeArchiveUrl(input: string): string { return parseArchiveUrl(input).href; }
export const systemResolver: AddressResolver = async hostname => (await dns.lookup(hostname,{all:true,verbatim:true})).map(x=>({address:x.address,family:x.family as 4|6}));
export async function resolvePublicUrl(input: string | URL, resolver: AddressResolver = systemResolver): Promise<{url:URL; addresses:ResolvedAddress[]}> {
  const url=parseArchiveUrl(String(input)); const host=url.hostname.replace(/^\[|\]$/g,'');
  const family=isIP(host); const addresses=family ? [{address:host,family:family as 4|6}] : await resolver(host);
  if (!addresses.length || addresses.some(x=>!isGlobalUnicastAddress(x.address))) throw new ArchiveUrlError("안전하게 접근할 수 없는 주소입니다.");
  return {url,addresses};
}
