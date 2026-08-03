import sanitizeHtml from "sanitize-html";
import { ARCHIVE_INDEX_TEXT_MAX_LENGTH } from "./types";

const ALLOWED_TAGS = [
  "article", "aside", "blockquote", "br", "caption", "code", "dd", "details",
  "div", "dl", "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4",
  "h5", "h6", "hr", "li", "main", "ol", "p", "pre", "section", "small",
  "span", "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot",
  "th", "thead", "tr", "ul",
  "a", "img",
];

const ASSET_PATH = /^\/archives\/[0-9a-f-]{36}\/assets\/[a-f0-9]{64}\.(?:jpg|png|gif|webp|avif|pdf|txt)$/i;

export function createReadableHtml(bytes: Uint8Array): Uint8Array {
  const source = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const body = source.match(/<body\b[^>]*>([\s\S]*?)(?:<\/body\s*>|$)/i)?.[1] ?? source;
  const content = sanitizeHtml(body, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { img: ["src", "alt", "width", "height"], a: ["href"] },
    allowedSchemes: [],
    allowedSchemesByTag: {},
    transformTags: {
      img: (_tag,attrs)=>({tagName:"img",attribs:Object.fromEntries(Object.entries(attrs).filter(([name,value])=>name!=="src"||ASSET_PATH.test(value)))}),
      a: (_tag,attrs)=>({tagName:"a",attribs:Object.fromEntries(Object.entries(attrs).filter(([name,value])=>name!=="href"||ASSET_PATH.test(value)))}),
    },
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    parser: { lowerCaseTags: true },
  }).replace(/<a>([\s\S]*?)<\/a>/gi,"$1").replace(/<img\b(?![^>]*\bsrc=)[^>]*>/gi,"").trim();
  return Buffer.from(`<!doctype html><html><head><meta charset="utf-8"><title>Archived reading view</title></head><body>${content}</body></html>`);
}

export function extractReadableText(bytes: Uint8Array): string {
  const source = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const withoutHidden = source.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, " ");
  return sanitizeHtml(withoutHidden, { allowedTags: [], allowedAttributes: {}, disallowedTagsMode: "discard" })
    .replace(/\s+/gu, " ").trim().slice(0, ARCHIVE_INDEX_TEXT_MAX_LENGTH);
}
