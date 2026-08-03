"use server";

import { redirect } from "next/navigation";
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
  const value = formData.get("url");
  const tags = formData.get("tags");
  if (typeof value !== "string" || value.trim() === "") {
    return { error: "보관할 URL을 입력해 주세요." };
  }
  if (typeof tags !== "string") return formErrorForInvalidTags();

  let archiveId: string;
  try {
    const result = await getArchiveService().create(value.trim(), tags);
    const formError = formErrorForCaptureFailure(result.archive.failureCode);
    if (formError) return formError;
    archiveId = result.archive.id;
  } catch (error) {
    if (error instanceof ArchiveUrlError) {
      return { error: error.message };
    }
    if (error instanceof TagValidationError) return formErrorForInvalidTags(error.message);
    throw error;
  }

  redirect(`/archives/${archiveId}`);
}
