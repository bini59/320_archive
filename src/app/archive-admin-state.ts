export type ArchiveAdminResultKind = "success" | "validation" | "forbidden" | "not_found" | "partial";

export interface ArchiveAdminState {
  kind: ArchiveAdminResultKind | null;
  message: string | null;
}

export const initialArchiveAdminState: ArchiveAdminState = { kind: null, message: null };

export interface AdminSignInState {
  error: string | null;
}

export const initialAdminSignInState: AdminSignInState = { error: null };

export const ADMIN_MESSAGES = {
  forbidden: "관리 권한이 없습니다. 관리자 인증 후 다시 시도해 주세요.",
  notFound: "아카이브를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.",
  invalidRequest: "요청이 올바르지 않습니다.",
  confirmRequired: "삭제를 확인해 주세요.",
  tagsSaved: "태그를 저장했습니다.",
  filesPending: "아카이브는 삭제되었지만 일부 파일을 정리하지 못했습니다. 정리는 자동으로 다시 시도되며, 삭제를 다시 눌러 즉시 재시도할 수도 있습니다.",
} as const;
