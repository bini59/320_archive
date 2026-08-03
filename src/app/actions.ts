"use server";

import { redirect } from "next/navigation";
import { getArchiveService } from "@/lib/archive/service";
import { ArchiveUrlError } from "@/lib/archive/url";

export interface ArchiveFormState {
  error: string | null;
}

export const initialArchiveFormState: ArchiveFormState = { error: null };

export async function createArchiveAction(
  _previousState: ArchiveFormState,
  formData: FormData,
): Promise<ArchiveFormState> {
  const value = formData.get("url");
  if (typeof value !== "string" || value.trim() === "") {
    return { error: "보관할 URL을 입력해 주세요." };
  }

  let archiveId: string;
  try {
    const result = await getArchiveService().create(value.trim());
    archiveId = result.archive.id;
  } catch (error) {
    if (error instanceof ArchiveUrlError) {
      return { error: error.message };
    }
    throw error;
  }

  redirect(`/archives/${archiveId}`);
}
