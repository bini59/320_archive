import { isIP } from "node:net";

export class ArchiveUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveUrlError";
  }
}

function ipv4Octets(address: string): number[] {
  return address.split(".").map(Number);
}

function isBlockedIpv4(address: string): boolean {
  const [a, b] = ipv4Octets(address);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function expandIpv6(address: string): number[] {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  const [head = "", tail = ""] = value.split("::");
  const convert = (part: string): number[] => {
    if (!part) return [];
    return part.split(":").flatMap((item) => {
      if (!item.includes(".")) return [Number.parseInt(item, 16)];
      const bytes = ipv4Octets(item);
      return [(bytes[0] << 8) | bytes[1], (bytes[2] << 8) | bytes[3]];
    });
  };
  const left = convert(head);
  const right = convert(tail);
  return [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill(0), ...right];
}

function isBlockedIpv6(address: string): boolean {
  const parts = expandIpv6(address);
  const allZero = parts.every((part) => part === 0);
  const loopback = parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1;
  const uniqueLocal = (parts[0] & 0xfe00) === 0xfc00;
  const linkLocal = (parts[0] & 0xffc0) === 0xfe80;
  const mappedIpv4 = parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;
  const mappedAddress = `${parts[6] >> 8}.${parts[6] & 255}.${parts[7] >> 8}.${parts[7] & 255}`;
  return allZero || loopback || uniqueLocal || linkLocal || (mappedIpv4 && isBlockedIpv4(mappedAddress));
}

function assertPublicHost(hostname: string): void {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new ArchiveUrlError("로컬 주소는 보관할 수 없습니다.");
  }
  const version = isIP(host);
  if ((version === 4 && isBlockedIpv4(host)) || (version === 6 && isBlockedIpv6(host))) {
    throw new ArchiveUrlError("내부 네트워크 주소는 보관할 수 없습니다.");
  }
}

export function normalizeArchiveUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ArchiveUrlError("올바른 URL을 입력해 주세요.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ArchiveUrlError("HTTP 또는 HTTPS URL만 보관할 수 있습니다.");
  }
  if (url.username || url.password) {
    throw new ArchiveUrlError("사용자 정보가 포함된 URL은 보관할 수 없습니다.");
  }
  assertPublicHost(url.hostname);
  return url.href;
}
