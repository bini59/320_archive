import { Suspense } from "react";
import { requireAuthenticatedSession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { LibraryDataSkeleton } from "../skeletons";
import { LibraryDataView, LibraryView } from "@/components/library-view";

async function LibraryData({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const identity = await requireAuthenticatedSession();
  const { returnTo } = await searchParams;
  const folders = getArchiveService().listFolders(identity.userId);

  return <LibraryDataView folders={folders} returnTo={returnTo} />;
}

export default function LibraryPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  return <LibraryView><Suspense fallback={<LibraryDataSkeleton />}><LibraryData searchParams={searchParams} /></Suspense></LibraryView>;
}
