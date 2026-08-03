import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "article", "aside", "blockquote", "br", "caption", "code", "dd", "details",
  "div", "dl", "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4",
  "h5", "h6", "hr", "li", "main", "ol", "p", "pre", "section", "small",
  "span", "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot",
  "th", "thead", "tr", "ul",
];

export function createReadableHtml(bytes: Uint8Array): Uint8Array {
  const source = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const body = source.match(/<body\b[^>]*>([\s\S]*?)(?:<\/body\s*>|$)/i)?.[1] ?? source;
  const content = sanitizeHtml(body, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    parser: { lowerCaseTags: true },
  }).trim();
  return Buffer.from(`<!doctype html><html><head><meta charset="utf-8"><title>Archived reading view</title></head><body>${content}</body></html>`);
}
