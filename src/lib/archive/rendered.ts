import { matchesAssetSignature } from "./asset-fetcher";
import { assetPathFor, capturedAssetKey } from "./assets";
import type { AssetMimeType, CapturedAsset } from "./types";

export const RENDERED_RESOURCE_MIME_TYPES = [
  "text/css",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "font/woff",
  "font/woff2",
  "font/ttf",
  "font/otf",
  "application/font-woff",
  "application/vnd.ms-fontobject",
] as const satisfies readonly AssetMimeType[];

export type RenderedResourceMimeType = (typeof RENDERED_RESOURCE_MIME_TYPES)[number];

export interface RenderedResource {
  requestUrl: string;
  finalUrl: string;
  mimeType: RenderedResourceMimeType;
  bytes: Uint8Array;
}

export interface InlineRenderedStyle {
  css: string;
  baseUrl: string;
}

export interface RenderedAssetBuildInput {
  archiveId: string;
  resources: Iterable<RenderedResource>;
  additionalAssets?: CapturedAsset[];
  inlineStyles?: InlineRenderedStyle[];
  styleAttributes?: InlineRenderedStyle[];
}

export interface RenderedAssetBuildResult {
  assets: CapturedAsset[];
  resourcePaths: Map<string, string>;
  inlineStylePaths: string[];
  styleAttributePath: string | null;
  styleAttributeClassPrefix: string | null;
}

const LOCAL_ASSET_PATH = /^\/archives\/[0-9a-f-]{36}\/assets\/[a-f0-9]{64}\.(?:jpg|png|gif|webp|avif|pdf|txt|css|woff|woff2|ttf|otf|eot)$/iu;

export function isRenderedResourceMime(value: string): value is RenderedResourceMimeType {
  return (RENDERED_RESOURCE_MIME_TYPES as readonly string[]).includes(value);
}

export function normalizeResourceUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function localPath(raw: string, baseUrl: string, resolve: (url: string) => string | null): string | null {
  const value = raw.trim();
  if (LOCAL_ASSET_PATH.test(value)) return value;
  const url = normalizeResourceUrl(value, baseUrl);
  return url ? resolve(url) : null;
}

/** Rewrite CSS network references to captured asset paths; an unknown reference becomes inert. */
export function rewriteCssReferences(
  css: string,
  baseUrl: string,
  resolve: (url: string) => string | null,
): string {
  const imported = css.replace(
    /@import\s+(?:(?:url\(\s*)?(["']?)([^"'\s)]+)\1\s*\)?)([^;]*);/giu,
    (_match, quote: string, rawUrl: string, suffix: string) => {
      const path = localPath(rawUrl, baseUrl, resolve);
      return path ? `@import url("${path}")${suffix};` : "";
    },
  );

  return imported.replace(
    /url\(\s*(["']?)(.*?)\1\s*\)/giu,
    (_match, _quote: string, rawUrl: string) => {
      const path = localPath(rawUrl, baseUrl, resolve);
      return `url("${path ?? ""}")`;
    },
  );
}

function aliases(resource: RenderedResource): string[] {
  return [normalizeResourceUrl(resource.requestUrl, resource.finalUrl), normalizeResourceUrl(resource.finalUrl, resource.finalUrl)].filter(
    (value): value is string => value !== null,
  );
}

export function buildRenderedAssets(input: RenderedAssetBuildInput): RenderedAssetBuildResult {
  const resources = Array.from(input.resources);
  const byUrl = new Map<string, RenderedResource>();
  for (const resource of resources) {
    if (!matchesAssetSignature(resource.mimeType, resource.bytes)) continue;
    for (const url of aliases(resource)) byUrl.set(url, resource);
  }

  const assets: CapturedAsset[] = [];
  const assetsByKey = new Map<string, CapturedAsset>();
  const pathsByUrl = new Map<string, string>();
  const processingCss = new Set<string>();
  const cssPathByUrl = new Map<string, string>();

  const addAsset = (asset: CapturedAsset): string => {
    const key = capturedAssetKey(asset);
    const existing = assetsByKey.get(key);
    if (existing) return assetPathFor(input.archiveId, existing);
    assets.push(asset);
    assetsByKey.set(key, asset);
    return assetPathFor(input.archiveId, asset);
  };

  const buildCss = (url: string): string | null => {
    const existing = cssPathByUrl.get(url);
    if (existing) return existing;
    const resource = byUrl.get(url);
    if (!resource || resource.mimeType !== "text/css" || processingCss.has(url)) return null;
    processingCss.add(url);
    const source = new TextDecoder("utf-8", { fatal: false }).decode(resource.bytes);
    const rewritten = rewriteCssReferences(source, resource.finalUrl, (reference) => {
      const target = byUrl.get(reference);
      if (!target) return null;
      if (target.mimeType === "text/css") return buildCss(reference);
      return addAsset({
        originalUrl: target.requestUrl,
        finalUrl: target.finalUrl,
        mimeType: target.mimeType,
        bytes: target.bytes,
      });
    });
    const asset: CapturedAsset = {
      originalUrl: resource.requestUrl,
      finalUrl: resource.finalUrl,
      mimeType: "text/css",
      bytes: Buffer.from(rewritten),
    };
    const path = addAsset(asset);
    processingCss.delete(url);
    for (const alias of aliases(resource)) cssPathByUrl.set(alias, path);
    return path;
  };

  const buildResource = (resource: RenderedResource): string | null => {
    const normalized = normalizeResourceUrl(resource.requestUrl, resource.finalUrl);
    if (!normalized) return null;
    if (resource.mimeType === "text/css") return buildCss(normalized);
    return addAsset({
      originalUrl: resource.requestUrl,
      finalUrl: resource.finalUrl,
      mimeType: resource.mimeType,
      bytes: resource.bytes,
    });
  };

  for (const resource of resources) {
    const path = buildResource(resource);
    if (path) for (const alias of aliases(resource)) pathsByUrl.set(alias, path);
  }

  for (const asset of input.additionalAssets ?? []) {
    if (!matchesAssetSignature(asset.mimeType, asset.bytes)) continue;
    const path = addAsset(asset);
    for (const url of [normalizeResourceUrl(asset.originalUrl, asset.finalUrl), normalizeResourceUrl(asset.finalUrl, asset.finalUrl)]) {
      if (url) pathsByUrl.set(url, path);
    }
  }

  const inlineStylePaths = (input.inlineStyles ?? []).map((style, index) => {
    const css = rewriteCssReferences(style.css, style.baseUrl, (reference) => pathsByUrl.get(reference) ?? null);
    return addAsset({
      originalUrl: `https://archive.invalid/inline-style-${index}.css`,
      finalUrl: style.baseUrl,
      mimeType: "text/css",
      bytes: Buffer.from(css),
    });
  });

  let styleAttributePath: string | null = null;
  let styleAttributeClassPrefix: string | null = null;
  if (input.styleAttributes?.length) {
    styleAttributeClassPrefix = `archive-captured-style-${input.archiveId.replaceAll("-", "")}`;
    const css = input.styleAttributes
      .map((style, index) => `.${styleAttributeClassPrefix}-${index}{${style.css}}`)
      .join("\n");
    const rewritten = rewriteCssReferences(css, input.styleAttributes[0].baseUrl, (reference) => pathsByUrl.get(reference) ?? null);
    styleAttributePath = addAsset({
      originalUrl: "https://archive.invalid/inline-style-attributes.css",
      finalUrl: input.styleAttributes[0].baseUrl,
      mimeType: "text/css",
      bytes: Buffer.from(rewritten),
    });
  }

  return { assets, resourcePaths: pathsByUrl, inlineStylePaths, styleAttributePath, styleAttributeClassPrefix };
}
