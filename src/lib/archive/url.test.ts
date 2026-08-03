import { describe, expect, it } from "vitest";

import { ArchiveUrlError, isGlobalUnicastAddress, normalizeArchiveUrl, resolvePublicUrl } from "./url";

describe("normalizeArchiveUrl", () => {
  it("normalizes equivalent HTTP URLs while preserving path, query, and fragment", () => {
    expect(normalizeArchiveUrl("HTTP://Example.COM:80/path?q=One#Part")).toBe(
      "http://example.com/path?q=One#Part",
    );
    expect(normalizeArchiveUrl("https://EXAMPLE.com:443/")).toBe("https://example.com/");
  });

  it.each([
    ["path", "https://example.com/a", "https://example.com/b"],
    ["query", "https://example.com/?a=1", "https://example.com/?a=2"],
    ["fragment", "https://example.com/#one", "https://example.com/#two"],
  ])("keeps a meaningful %s difference", (_kind, first, second) => {
    expect(normalizeArchiveUrl(first)).not.toBe(normalizeArchiveUrl(second));
  });

  it.each(["ftp://example.com/file", "mailto:person@example.com", "file:///tmp/page"])(
    "rejects the unsupported scheme in %s",
    (input) => {
      expect(() => normalizeArchiveUrl(input)).toThrow(ArchiveUrlError);
      expect(() => normalizeArchiveUrl(input)).toThrow("HTTP 또는 HTTPS");
    },
  );

  it.each(["not a URL", "https://[not-ipv6]/", "http://"])(
    "rejects the malformed URL %s",
    (input) => {
      expect(() => normalizeArchiveUrl(input)).toThrow(ArchiveUrlError);
      expect(() => normalizeArchiveUrl(input)).toThrow("올바른 URL");
    },
  );

  it.each(["http://localhost", "http://LOCALHOST.", "http://api.localhost"])(
    "rejects the localhost name %s",
    (input) => {
      expect(() => normalizeArchiveUrl(input)).toThrow(ArchiveUrlError);
      expect(() => normalizeArchiveUrl(input)).toThrow("로컬 주소");
    },
  );

  it.each([
    "http://0.0.0.0",
    "http://10.0.0.1",
    "http://127.0.0.1",
    "http://169.254.1.1",
    "http://172.16.0.1",
    "http://172.31.255.255",
    "http://192.168.1.1",
    "http://100.64.0.1",
    "http://192.0.0.1",
    "http://198.18.0.1",
    "http://224.0.0.1",
    "http://240.0.0.1",
  ])("rejects the private or special IPv4 address %s", (input) => {
    expect(() => normalizeArchiveUrl(input)).toThrow(ArchiveUrlError);
    expect(() => normalizeArchiveUrl(input)).toThrow("내부 네트워크 주소");
  });

  it.each([
    "http://[::]",
    "http://[::1]",
    "http://[fc00::1]",
    "http://[fd12::1]",
    "http://[fe80::1]",
    "http://[ff02::1]",
    "http://[::ffff:127.0.0.1]",
    "http://[::ffff:192.168.1.1]",
  ])("rejects the private or special IPv6 address %s", (input) => {
    expect(() => normalizeArchiveUrl(input)).toThrow(ArchiveUrlError);
    expect(() => normalizeArchiveUrl(input)).toThrow("내부 네트워크 주소");
  });

  it("rejects URLs larger than the persistence boundary", () => {
    expect(() => normalizeArchiveUrl(`https://example.com/${"a".repeat(8192)}`)).toThrow(
      "너무 깁니다",
    );
  });
});

describe("capture address policy", () => {
  it.each(["192.0.2.1", "198.51.100.1", "203.0.113.1", "2001:db8::1"])("blocks documentation address %s", address => {
    expect(isGlobalUnicastAddress(address)).toBe(false);
  });
  it("rejects a hostname when any DNS answer is unsafe", async () => {
    await expect(resolvePublicUrl("https://example.com", async () => [
      {address:"93.184.216.34",family:4}, {address:"127.0.0.1",family:4},
    ])).rejects.toThrow(ArchiveUrlError);
  });
});
