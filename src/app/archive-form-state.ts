import type { CaptureFailureCode } from "@/lib/archive/types";

export interface ArchiveFormState {
  error: string | null;
}

export const initialArchiveFormState: ArchiveFormState = { error: null };

const retryableCaptureErrors: Partial<Record<CaptureFailureCode, string>> = {
  overloaded: "현재 캡처 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  rate_limited: "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
  quota_exceeded: "저장 공간 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
};

export function formErrorForCaptureFailure(
  code: CaptureFailureCode | null,
): ArchiveFormState | null {
  if (!code) return null;
  const error = retryableCaptureErrors[code];
  return error ? { error } : null;
}
