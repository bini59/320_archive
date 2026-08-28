import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAuthenticatedSession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { FolderDataSkeleton } from "../../skeletons";
import { FolderDataView, FolderView } from "@/components/folder-view";

async function FolderData({ folderId }: { folderId: string }) {
  await connection();
  const identity = await requireAuthenticatedSession();
  const service = getArchiveService();
  const folder = service.listFolders(identity.userId).find((item) => item.id === folderId);
  if (!folder) notFound();
  const archives = service.listOwned(identity.userId, folderId);
  return <FolderDataView archives={archives} folder={folder} />;
}

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  return <FolderView><Suspense fallback={<FolderDataSkeleton />}><FolderData folderId={folderId} /></Suspense></FolderView>;
}
