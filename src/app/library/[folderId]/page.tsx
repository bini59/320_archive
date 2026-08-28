import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAuthenticatedSession } from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { FolderView } from "./folder-view";

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  await connection();
  const identity = await requireAuthenticatedSession();
  const service = getArchiveService();
  const folder = service.listFolders(identity.userId).find((item) => item.id === folderId);
  if (!folder) notFound();
  const archives = service.listOwned(identity.userId, folderId);
  return <FolderView folder={folder} archives={archives} />;
}
