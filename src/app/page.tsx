import { Suspense } from "react";
import { requireAuthenticatedSession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { HomeDataSkeleton } from "./skeletons";
import { HomeView } from "@/components/home-view";
import { HomeDataView } from "@/components/home-data";

async function HomeData({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  const { folderId } = await searchParams;
  const identity = await requireAuthenticatedSession();
  const folders = getArchiveService().listFolders(identity.userId);
  const selectedFolder = folders.some((folder) => folder.id === folderId) ? folderId ?? null : null;

  return <HomeDataView folders={folders} selectedFolderId={selectedFolder} />;
}

export default function Home({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  return <HomeView><Suspense fallback={<HomeDataSkeleton />}><HomeData searchParams={searchParams} /></Suspense></HomeView>;
}
