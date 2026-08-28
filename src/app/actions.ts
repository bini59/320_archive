"use server";

import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  AuthUnavailableError,
  isE2eAuthBypass,
  loginUrl,
  currentAppOrigin,
  requireAuthenticatedSession,
  revokeSession,
} from "@/lib/auth";
import { getArchiveService } from "@/lib/archive/service";
import { ArchiveUrlError } from "@/lib/archive/url";
import { TagValidationError } from "@/lib/archive/tags";
import {
  formErrorForCaptureFailure,
  formErrorForInvalidTags,
  type ArchiveFormState,
} from "./archive-form-state";
import { folderErrorForAction, initialFolderFormState, validateFolderName, type FolderFormState } from "./folder-form-state";

export async function createArchiveAction(
  _previousState: ArchiveFormState,
  formData: FormData,
): Promise<ArchiveFormState> {
  const identity = await requireAuthenticatedSession();
  const value = formData.get("url");
  const tags = formData.get("tags");
  const folderId = formData.get("folderId");
  if (typeof folderId !== "string" || !folderId) {
    return { error: null, folderError: "아카이브를 보관할 폴더를 선택해 주세요.", tagError: null };
  }
  if (!getArchiveService().listFolders(identity.userId).some((folder) => folder.id === folderId)) {
    return { error: null, folderError: "선택한 폴더를 찾을 수 없습니다.", tagError: null };
  }
  if (typeof value !== "string" || value.trim() === "") {
    return { error: "보관할 URL을 입력해 주세요.", folderError: null, tagError: null };
  }
  if (typeof tags !== "string") return formErrorForInvalidTags();

  let archiveId: string;
  try {
    const visibility = formData.get("visibility") === "public" ? "public" : "private";
    const result = await getArchiveService().create(value.trim(), tags, identity.userId, folderId, visibility);
    if (visibility === "public") revalidateTag("public-archives", "max");
    const formError = formErrorForCaptureFailure(result.archive.failureCode);
    if (formError) return formError;
    archiveId = result.archive.id;
  } catch (error) {
    if (error instanceof ArchiveUrlError) {
      return { error: error.message, tagError: null };
    }
    if (error instanceof TagValidationError) return formErrorForInvalidTags(error.message);
    throw error;
  }

  const returnTo = formData.get("returnTo");
  const destination = typeof returnTo === "string" && /^\/library(?:\/[^/]+)?$/.test(returnTo) ? returnTo : `/archives/${archiveId}`;
  redirect(destination);
}

async function createFolderResult(formData: FormData): Promise<FolderFormState> {
  const identity = await requireAuthenticatedSession();
  const name = formData.get("name");
  const validationError = validateFolderName(name);
  if (validationError) return { ...initialFolderFormState, error: validationError };
  let folder;
  try {
    folder = getArchiveService().createFolder(identity.userId, name as string);
  } catch (error) {
    return { ...initialFolderFormState, error: folderErrorForAction(error) };
  }
  return { folder, error: null };
}

export async function createFolderAction(formData: FormData): Promise<void> {
  const result = await createFolderResult(formData);
  if (result.error || !result.folder) return;
  const returnTo = formData.get("returnTo");
  redirect(returnTo === "/" ? `/?folderId=${encodeURIComponent(result.folder.id)}` : "/library");
}

export async function createFolderModalAction(formData: FormData): Promise<FolderFormState> {
  return createFolderResult(formData);
}

export async function renameFolderAction(formData: FormData): Promise<void> {
  const identity = await requireAuthenticatedSession();
  const id = formData.get("id");
  const name = formData.get("name");
  if (typeof id === "string" && typeof name === "string") getArchiveService().renameFolder(identity.userId, id, name);
  redirect("/library");
}

export async function setArchiveVisibilityAction(formData: FormData): Promise<void> {
  const identity = await requireAuthenticatedSession();
  const id = formData.get("id");
  const visibility = formData.get("visibility");
  if (typeof id === "string" && (visibility === "public" || visibility === "private")) {
    getArchiveService().setVisibility(identity.userId, id, visibility);
    revalidateTag("public-archives", "max");
  }
  redirect("/library");
}

export async function deleteFolderAction(formData: FormData): Promise<void> {
  const identity = await requireAuthenticatedSession();
  const id = formData.get("id");
  if (typeof id === "string") getArchiveService().deleteFolder(identity.userId, id);
  redirect("/library");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get("sid")?.value;

  if (sid && !isE2eAuthBypass()) {
    try {
      await revokeSession(sid);
    } catch (error) {
      // A revoke that never reached auth must not strand the user in a
      // half-signed-out state, so drop the local cookie either way.
      if (!(error instanceof AuthUnavailableError)) throw error;
    }
  }
  jar.delete({ name: "sid", path: "/" });

  redirect(loginUrl(`${await currentAppOrigin()}/`).toString());
}
