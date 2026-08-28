import { ARCHIVE_LIST_MAX_PAGE, ARCHIVE_SEARCH_QUERY_MAX_LENGTH, type PublicArchiveQuery } from "@/lib/archive/types";
import { unstable_cache } from "next/cache";
import { getArchiveService } from "@/lib/archive/service";

type RawSearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => typeof value === "string" ? value : value?.[0];

export function parseArchiveSearchParams(raw: RawSearchParams): PublicArchiveQuery {
  const q = first(raw.q)?.trim().slice(0, ARCHIVE_SEARCH_QUERY_MAX_LENGTH);
  const tag = first(raw.tag)?.trim().normalize("NFKC").toLocaleLowerCase("und");
  const requestedPage = Number.parseInt(first(raw.page) ?? "1", 10);
  const page = Number.isSafeInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), ARCHIVE_LIST_MAX_PAGE) : 1;
  return { ...(q ? { q } : {}), ...(tag ? { tag } : {}), page };
}

export function archiveListHref(query: PublicArchiveQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.tag) params.set("tag", query.tag);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const encoded = params.toString();
  return encoded ? `/archives?${encoded}` : "/archives";
}

export const listCachedPublicArchives = unstable_cache(
  async (query: PublicArchiveQuery) => getArchiveService().listPublic(query),
  ["public-archives"],
  { revalidate: 30, tags: ["public-archives"] },
);
