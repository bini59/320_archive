import { Suspense } from "react";
import { requireAuthenticatedSession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { HomeSkeleton } from "./skeletons";
import { HomeView } from "./home-view";

async function HomeContent({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  const { folderId } = await searchParams;
  const identity = await requireAuthenticatedSession();
  const folders = getArchiveService().listFolders(identity.userId);
  const selectedFolder = folders.some((folder) => folder.id === folderId) ? folderId ?? null : null;

  return <HomeView folders={folders} selectedFolderId={selectedFolder} />;
}

export default function Home({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  return <Suspense fallback={<HomeSkeleton />}><HomeContent searchParams={searchParams} /></Suspense>;
}
