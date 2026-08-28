import { describe, expect, it } from "vitest";
import {
  captureFailurePresentation,
  formContextFromData,
  formErrorForCaptureFailure,
  formErrorForInvalidTags,
} from "./archive-form-state";

describe("formErrorForCaptureFailure", () => {
  it.each([
    ["overloaded", "현재 캡처 요청이 많습니다. 잠시 후 다시 시도해 주세요."],
    ["rate_limited", "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요."],
    ["quota_exceeded", "저장 공간 한도에 도달했습니다. 공간을 확보한 후 다시 시도해 주세요."],
  ] as const)("returns a retry-safe form error for %s", (code, expected) => {
    expect(formErrorForCaptureFailure(code)).toEqual({ error: expected });
  });

  it("leaves ordinary capture failures for the detail page", () => {
    expect(formErrorForCaptureFailure("network")).toBeNull();
  });

  it("returns a field-specific error for invalid tags", () => {
    expect(formErrorForInvalidTags()).toEqual({
      error: null,
      tagError: "태그 형식이 올바르지 않습니다.",
    });
  });

  it.each([
    ["network", "retryable", true],
    ["timeout", "retryable", true],
    ["overloaded", "concurrency", true],
    ["rate_limited", "rate", true],
    ["quota_exceeded", "quota", true],
    ["invalid_url", "permanent", false],
    ["not_html", "permanent", false],
  ] as const)("classifies %s as %s", (code, kind, retryable) => {
    expect(captureFailurePresentation(code)).toMatchObject({ kind, retryable });
  });

  it("keeps the submitted form context serializable", () => {
    const data = new FormData();
    data.set("url", " https://example.com/post ");
    data.set("tags", "개발, 읽을거리");
    data.set("folderId", "folder-1");
    data.set("visibility", "public");
    data.set("returnTo", "/library/folder-1");

    expect(formContextFromData(data)).toEqual({
      url: " https://example.com/post ",
      tags: "개발, 읽을거리",
      folderId: "folder-1",
      visibility: "public",
      returnTo: "/library/folder-1",
    });
  });
});
