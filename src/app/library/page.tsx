import { Suspense } from "react";
import { requireAuthenticatedSession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { LibrarySkeleton } from "../skeletons";
import { LibraryView } from "./library-view";

async function LibraryContent({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const identity = await requireAuthenticatedSession();
  const { returnTo } = await searchParams;
  const folders = getArchiveService().listFolders(identity.userId);

  return <LibraryView folders={folders} returnTo={returnTo} />;
}

export default function LibraryPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  return <Suspense fallback={<LibrarySkeleton />}><LibraryContent searchParams={searchParams} /></Suspense>;
}
