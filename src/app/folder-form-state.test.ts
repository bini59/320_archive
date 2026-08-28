import { describe, expect, it } from "vitest";
import { folderErrorForAction, validateFolderName } from "./folder-form-state";

describe("folder form state", () => {
  it("requires a non-empty folder name", () => {
    expect(validateFolderName(null)).toBe("폴더 이름을 입력해 주세요.");
    expect(validateFolderName("   ")).toBe("폴더 이름을 입력해 주세요.");
  });

  it("rejects names longer than the server limit", () => {
    expect(validateFolderName("a".repeat(101))).toBe("폴더 이름은 100자 이하로 입력해 주세요.");
  });

  it("accepts names within the server limit", () => {
    expect(validateFolderName("  읽을거리  ")).toBeNull();
  });

  it("maps duplicate and unknown server failures to safe messages", () => {
    expect(folderErrorForAction(new Error("UNIQUE constraint failed"))).toBe("이미 같은 이름의 폴더가 있습니다.");
    expect(folderErrorForAction(new Error("database unavailable"))).toBe("폴더를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
  });
});
