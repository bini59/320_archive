import type { Folder } from "@/lib/archive/types";

export type FolderFormState = {
  folder: Pick<Folder, "id" | "name"> | null;
  error: string | null;
};

export const initialFolderFormState: FolderFormState = { folder: null, error: null };

export function validateFolderName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.trim()) return "폴더 이름을 입력해 주세요.";
  if (value.trim().length > 100) return "폴더 이름은 100자 이하로 입력해 주세요.";
  return null;
}

export function folderErrorForAction(error: unknown): string {
  if (error instanceof Error && error.message.includes("UNIQUE")) {
    return "이미 같은 이름의 폴더가 있습니다.";
  }
  return "폴더를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
