import { describe, expect, it } from "vitest";
import { formErrorForCaptureFailure } from "./archive-form-state";

describe("formErrorForCaptureFailure", () => {
  it.each([
    ["overloaded", "현재 캡처 요청이 많습니다. 잠시 후 다시 시도해 주세요."],
    ["rate_limited", "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요."],
    ["quota_exceeded", "저장 공간 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."],
  ] as const)("returns a retry-safe form error for %s", (code, expected) => {
    expect(formErrorForCaptureFailure(code)).toEqual({ error: expected });
  });

  it("leaves ordinary capture failures for the detail page", () => {
    expect(formErrorForCaptureFailure("network")).toBeNull();
  });
});
