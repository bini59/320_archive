import { isRetryableCaptureFailure, type CaptureFailureCode } from "@/lib/archive/types";

export type ArchiveFormErrorKind = "validation" | "retryable" | "permanent" | "rate" | "quota" | "concurrency";
export interface ArchiveFormContext {
  url: string;
  tags: string;
  folderId: string;
  visibility: "private" | "public";
  returnTo: string;
}

export interface ArchiveFormState {
  error: string | null;
  folderError?: string | null;
  tagError?: string | null;
  failureCode?: CaptureFailureCode | null;
  errorKind?: ArchiveFormErrorKind;
  retryable?: boolean;
  archiveId?: string;
  formContext?: ArchiveFormContext;
}

export const initialArchiveFormState: ArchiveFormState = { error: null, folderError: null };

const retryableCaptureErrors: Partial<Record<CaptureFailureCode, string>> = {
  overloaded: "현재 캡처 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  rate_limited: "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
  quota_exceeded: "저장 공간 한도에 도달했습니다. 공간을 확보한 후 다시 시도해 주세요.",
};

const permanentCaptureFailures = new Set<CaptureFailureCode>([
  "invalid_url", "not_html", "unsupported_mime", "too_large", "redirect",
]);

export function captureFailurePresentation(code: CaptureFailureCode) {
  const kind: ArchiveFormErrorKind = code === "rate_limited"
    ? "rate"
    : code === "quota_exceeded"
      ? "quota"
      : code === "overloaded"
        ? "concurrency"
        : permanentCaptureFailures.has(code) ? "permanent" : "retryable";
  return { code, kind, retryable: isRetryableCaptureFailure(code) };
}

export function formContextFromData(formData: FormData): ArchiveFormContext {
  const visibility = formData.get("visibility") === "public" ? "public" : "private";
  return {
    url: typeof formData.get("url") === "string" ? String(formData.get("url")) : "",
    tags: typeof formData.get("tags") === "string" ? String(formData.get("tags")) : "",
    folderId: typeof formData.get("folderId") === "string" ? String(formData.get("folderId")) : "",
    visibility,
    returnTo: typeof formData.get("returnTo") === "string" ? String(formData.get("returnTo")) : "",
  };
}

export function formErrorForCaptureFailure(
  code: CaptureFailureCode | null,
): ArchiveFormState | null {
  if (!code) return null;
  const error = retryableCaptureErrors[code];
  return error ? { error } : null;
}

export function isRetryableFormFailure(code: CaptureFailureCode | null): boolean {
  return isRetryableCaptureFailure(code);
}

export function formErrorForInvalidTags(message = "태그 형식이 올바르지 않습니다."): ArchiveFormState {
  return { error: null, tagError: message };
}
