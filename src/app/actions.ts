"use server";

import { cookies } from "next/headers";
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

export async function createArchiveAction(
  _previousState: ArchiveFormState,
  formData: FormData,
): Promise<ArchiveFormState> {
  const identity = await requireAuthenticatedSession();
  const value = formData.get("url");
  const tags = formData.get("tags");
  if (typeof value !== "string" || value.trim() === "") {
    return { error: "보관할 URL을 입력해 주세요.", tagError: null };
  }
  if (typeof tags !== "string") return formErrorForInvalidTags();

  let archiveId: string;
  try {
    const folderId = formData.get("folderId");
    const visibility = formData.get("visibility") === "public" ? "public" : "private";
    const result = await getArchiveService().create(value.trim(), tags, identity.userId, typeof folderId === "string" && folderId ? folderId : null, visibility);
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
  const destination = typeof returnTo === "string" && /^\/library(?:\/[^/]+)?$/.test(returnTo) ? returnTo : "/library";
  redirect(destination);
}

export async function createFolderAction(formData: FormData): Promise<void> {
  const identity = await requireAuthenticatedSession();
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;
  getArchiveService().createFolder(identity.userId, name);
  redirect("/library");
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
  if (typeof id === "string" && (visibility === "public" || visibility === "private")) getArchiveService().setVisibility(identity.userId, id, visibility);
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
