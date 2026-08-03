import { ARCHIVE_TAG_MAX_COUNT, ARCHIVE_TAG_MAX_LENGTH, type Tag } from "./types";

const TAG_PATTERN = /^[\p{L}\p{N}]+(?:[ -][\p{L}\p{N}]+)*$/u;
const TAG_SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export class TagValidationError extends Error {
  constructor(message = "태그 형식이 올바르지 않습니다.") {
    super(message);
    this.name = "TagValidationError";
  }
}

export function normalizeTagSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const slug = value.normalize("NFKC").toLocaleLowerCase("und");
  return Array.from(slug).length <= ARCHIVE_TAG_MAX_LENGTH && TAG_SLUG_PATTERN.test(slug) ? slug : null;
}

export function parseTags(value: string | null | undefined): Tag[] {
  if (!value?.trim()) return [];
  const result: Tag[] = [];
  const seen = new Set<string>();
  for (const raw of value.split(",")) {
    const name = raw.trim().replace(/\s+/gu, " ").normalize("NFKC");
    if (!name) continue;
    if (Array.from(name).length > ARCHIVE_TAG_MAX_LENGTH || !TAG_PATTERN.test(name)) throw new TagValidationError();
    const slug = name.toLocaleLowerCase("und").replace(/ /gu, "-");
    if (seen.has(slug)) continue;
    if (result.length >= ARCHIVE_TAG_MAX_COUNT) throw new TagValidationError(`태그는 최대 ${ARCHIVE_TAG_MAX_COUNT}개까지 입력할 수 있습니다.`);
    seen.add(slug);
    result.push({ name, slug });
  }
  return result;
}
