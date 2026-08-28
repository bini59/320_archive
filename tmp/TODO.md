---
track: heavy
exec: worktree
files: 40+
branch: feat-user-owned-private-archives
base: main
---

# 사용자 소유 아카이브·폴더·공개 탐색 구현 계획

## 1. 확정 요구사항과 경계

- `/verify` 성공 시 인증 응답의 사용자를 로컬 SQLite `users`에 upsert한다.
- `membership.status`가 `active`가 아니면 로컬 사용자도 `disabled` 상태로 반영하고, 이후 보호된 작업을 거부한다. 인증 원격 상태가 비활성/중지인지와 로컬 disabled 상태를 혼동하지 않는다.
- 아카이브는 반드시 로컬 사용자 소유이며, 소유자 전용 조회/변경 경계와 공개 아카이브 조회 경계를 별도 메서드·쿼리·라우트 흐름으로 둔다.
- 폴더는 사용자별 1-depth만 허용한다. 폴더 안에서 사이트를 등록할 수 있고, 캡처 완료 후 생성된 상세 화면은 해당 폴더로 돌아간다.
- 새 아카이브의 공개 설정 기본값은 `private`다. 공개 탐색/상세는 `public` 아카이브만 대상으로 하며 비로그인 접근을 허용한다.
- 공개 탐색은 카드형 메뉴/카드형 결과 UI로 개편한다.
- 기존 아카이브 데이터는 보존·호환 마이그레이션하지 않고 삭제한다. 기존 `archives_v1` 복사 로직도 제거한다.
- 구현은 이 계획 작성 단계에서 수행하지 않는다.

## 2. 현재 구조 조사 결과

### 인증

- `src/lib/auth.ts:81`의 `verifySession`이 `/verify` 응답을 그대로 `AuthenticatedIdentity`로 반환한다.
- `src/lib/auth.ts:119`의 `requireAuthenticatedSession`은 원격 membership만 확인하고 로컬 사용자를 만들거나 disabled 상태를 갱신하지 않는다.
- `src/proxy.ts:11`은 현재 `/`만 보호하며 `membership.status === active`일 때 통과시킨다.
- `src/app/app-shell.tsx:10`은 레이아웃용으로 매 요청 `verifySession`을 호출하고 활성 사용자만 셸을 렌더링한다. 로컬 사용자 동기화는 이 표시용 경로가 아니라 명시적인 인증/보호 경계에 두어 중복 upsert를 피한다.
- `src/app/actions.ts:22`의 등록 Server Action은 세션 확인 뒤 전역 아카이브 서비스를 호출한다.

### 아카이브 도메인/DB

- `src/lib/archive/types.ts:28`의 `Archive`에는 owner, visibility, folder 정보가 없다.
- `src/lib/archive/types.ts:72`의 `ArchiveRepository`는 `createOrGet`, `findById`, `listPublic`만 제공하고 모두 전역 범위다.
- `src/lib/archive/database.ts:10`의 `SqliteArchiveRepository`는 `archives`를 전역 테이블로 생성하며 현재 `normalized_url UNIQUE`로 사용자 간 중복도 막는다.
- `src/lib/archive/database.ts:16-35`에는 구 schema를 `archives_v1`로 옮겨 다시 복사하는 기존 호환/복구 로직이 있다. 삭제 결정에 따라 신규 스키마로 직접 만들고 기존 아카이브 행은 이관하지 않는다.
- `src/lib/archive/database.ts:39-43`에서 생성, 저장 완료, 공개 목록이 전역으로 처리된다. 공개 목록은 현재 `status='saved'`만 필터링한다.
- `src/lib/archive/service.ts:40`의 `create`는 owner/folder/visibility를 받지 않으며, 캡처 완료 후 별도 목적지 정보가 없다.
- `src/lib/archive/service.ts:121-138`의 public list/detail/content/asset 메서드가 소유자 확인 없이 ID만으로 접근 가능하다. 특히 public detail과 private owner detail을 분리해야 한다.
- `src/lib/archive/storage.ts` 계열은 UUID 디렉터리로 파일을 저장하므로 데이터 접근 authorization은 파일 경로 검증만으로 충족되지 않고 SQLite 조회 결과에 의존해야 한다.

### 라우트/UI

- `src/app/page.tsx:3`은 등록 화면과 공개 아카이브 링크만 제공한다.
- `src/app/archive-form.tsx:9`는 URL/태그만 제출하며 folderId/visibility/returnTo가 없다.
- `src/app/archives/page.tsx:37`은 인증 없이 `listPublic`을 호출하지만 테이블 UI이며 카드형 탐색이 아니다.
- `src/app/archives/[id]/page.tsx:22`와 `assets/[key]/route.ts`, `rendered/route.ts`, `original/route.ts`는 ID로 아카이브를 읽는다. public/private 분기와 소유자 검사를 공통 서비스 경계에서 적용해야 한다.
- `src/app/app-navigation.tsx:7`은 1-depth 폴더 메뉴가 없고, `src/app/app-shell.tsx:44`가 인증 사용자에게만 사이드바를 렌더링한다.
- `src/app/breadcrumb.tsx:5`는 공개 상세 기준 라벨만 처리하므로 폴더 복귀/개인 보관함 경로를 확장해야 한다.
- `e2e/archive-submission.spec.ts`와 관련 단위 테스트는 현재 전역 등록·공개 목록·상세 흐름을 전제로 한다.

## 3. 목표 도메인 모델과 보안 원칙

### 로컬 사용자

`users` 테이블을 추가한다.

- `id TEXT PRIMARY KEY`: auth provider가 반환한 `userId`를 안정적인 외부 식별자로 사용한다.
- `email`, `name`, `avatar_url`: verify 응답의 최신 profile snapshot.
- `status TEXT NOT NULL CHECK(status IN ('active','disabled'))`.
- `membership_role`, `membership_status`: 마지막 verify 결과를 감사/진단용으로 저장한다.
- `created_at`, `updated_at`.
- `userId`는 신뢰할 수 없는 클라이언트 입력이 아니라 서버가 검증한 `/verify` 응답에서만 취득한다.

`verifySession` 성공 직후 또는 `requireAuthenticatedSession` 내부에서 `syncLocalUser(identity)`를 실행한다. 활성 membership이면 active upsert, 그 외 membership 상태면 disabled upsert다. disabled 사용자는 로컬 사용자로 남겨 소유 데이터와 상태를 식별할 수 있으나 등록/폴더 관리/개인 조회는 거부한다. auth 장애/응답 파싱 실패는 임의로 disabled 처리하지 않고 기존과 같이 unavailable로 처리한다.

### 폴더

`folders` 테이블을 추가한다.

- `id TEXT PRIMARY KEY`, `owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
- `name TEXT NOT NULL`과 길이/공백 검증, `created_at`, `updated_at`.
- `(owner_id, name)` unique.
- parent_id는 만들지 않는다. 서버와 DB 모두 1-depth를 보장한다.

### 아카이브

기존 테이블을 새 스키마로 생성한다.

- `owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
- `folder_id TEXT NULL REFERENCES folders(id) ON DELETE SET NULL`.
- `visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public'))`.
- 기존 status/snapshot/failure 필드는 유지한다.
- unique는 `owner_id, normalized_url` 조합으로 변경한다. 같은 URL을 다른 사용자가 소유할 수 있어야 한다.
- owner/folder 인덱스와 `(visibility, status, captured_at DESC, id DESC)` 공개 목록 인덱스를 추가한다.
- 생성 시 owner/folder의 일치 여부를 한 트랜잭션에서 검증한다.

### 조회 분리

동일한 내부 `findById`를 재사용하지 않고 아래 경계를 별도로 설계한다.

- `findOwnedById(ownerId, archiveId)`: owner_id 일치 + active owner 전제의 개인 조회.
- `findPublicById(archiveId)`: `status='saved' AND visibility='public'`만 반환. owner 정보는 공개 응답에 불필요하면 노출하지 않는다.
- `listOwned(ownerId, folderId?)`: 반드시 owner_id predicate를 포함하는 개인 목록.
- `listPublic(query)`: 반드시 saved/public predicate만 포함하고 로그인 정보에 의존하지 않는 공개 목록.
- `findOwnedContent`/`findPublicContent`, `findOwnedAsset`/`findPublicAsset`를 서비스 또는 authorization wrapper로 분리한다.

ID를 아는 것만으로 private archive의 metadata, snapshot, original/readable/rendered, asset이 노출되지 않아야 한다. 공개 상세도 public으로 전환된 saved 아카이브만 열며 pending/failed/private는 404로 통일한다. public route에서 owner 인증을 fallback으로 사용하지 않는다.

## 4. 단계별 구현 계획

### Phase A — DB/도메인 계약과 초기화 정책

1. `src/lib/archive/types.ts`에 `ArchiveVisibility`, `User`, `Folder`, public/owned DTO, owner-aware repository 입력/결과 타입을 추가한다.
2. `src/lib/auth.ts`에 local user repository/service 의존성을 연결할 경계를 정하고, verify 성공 후 동기화되는 반환 계약을 추가한다. 인증 원격 응답의 필수 `userId`와 membership shape를 런타임 검증한다.
3. `src/lib/archive/database.ts`의 migration을 새 schema 생성 방식으로 재작성한다.
   - 기존 `archives_v1`에서 행을 복사하지 않는다.
   - 기존 구 테이블이 있으면 명시적으로 삭제하거나 새 초기화 시점에 데이터가 비어 있는 새 테이블로 재생성한다. 운영 적용 전 백업 삭제 확인을 release gate로 둔다.
   - `PRAGMA user_version`을 새 버전으로 올리고 idempotent 재실행을 보장한다.
4. user/folder/archive CRUD 및 소유자 predicate를 repository에 구현한다. `createOrGet`와 budget finalization 모두 owner/folder/visibility를 유지해야 한다.
5. `src/lib/archive/service.ts`를 owner context를 필수로 받도록 변경한다. 등록 과정은 `ownerId`, optional `folderId`, visibility를 전달하고 기본 visibility는 private로 고정한다.

### Phase B — 인증 동기화와 보호 경계

1. `src/lib/auth.ts`의 verify 성공 경로에서 local user upsert를 실행한다. E2E bypass도 deterministic `e2e` 사용자를 upsert할 수 있도록 테스트 DB와 동일한 계약을 적용한다.
2. `requireAuthenticatedSession`은 원격 및 로컬 상태를 모두 active로 확인하고, 비활성 membership이면 local status를 disabled로 기록한 뒤 로그인/접근 거부 흐름을 실행한다.
3. `src/proxy.ts`는 공개 경로(`/archives`, `/archives/:id` 및 공개 content/asset)를 통과시키고, 개인 경로와 등록/폴더 관리 경로만 보호하도록 matcher/분기를 재설계한다. proxy는 public/private 데이터 조회를 직접 판단하지 않는다.
4. Server Action은 매번 `requireAuthenticatedSession`에서 얻은 identity의 userId를 owner context로 사용하며 `ownerId`를 FormData에서 받지 않는다.
5. auth 장애는 503, 비활성/미인증은 기존 redirect/404 정책으로 명확히 구분한다.

### Phase C — 폴더 관리와 등록 복귀 흐름

1. 개인 보관함/폴더 화면을 추가한다. 후보 경로는 `/library`, `/library/[folderId]`로 통일하고, 실제 구현 시 기존 `/archives` 공개 탐색과 충돌하지 않게 한다.
2. `src/app/actions.ts`에 create/rename/delete folder action을 추가한다.
   - ownerId는 세션에서만 취득.
   - 이름은 trim, 빈 문자열/최대 길이/중복을 검증.
   - 삭제 시 아카이브를 삭제하지 않고 folder_id를 null로 만드는 정책을 기본으로 한다.
3. `src/app/archive-form.tsx`에 현재 folderId를 hidden/context prop으로 전달하고, visibility 선택은 private 기본값으로 둔다. public 전환은 명시적 선택으로만 가능하게 한다.
4. `createArchiveAction`은 캡처 성공 후 `/library/[folderId]` 또는 등록 시작 시 전달받은 안전한 내부 return path로 redirect한다. 외부 URL open redirect는 허용하지 않는다.
5. 실패/중복/재시도 시에도 원래 폴더 컨텍스트가 유지되도록 `ArchiveFormState`에 folder/return context를 포함한다.
6. `src/app/app-navigation.tsx`, `src/app/app-shell.tsx`, `src/app/breadcrumb.tsx`에 1-depth 폴더 목록과 현재 폴더 상태를 추가한다. 비로그인에는 개인 사이드바 대신 공개 카드 탐색 진입 UI만 제공한다.

### Phase D — 공개 탐색/상세와 카드 UI

1. `/archives`는 `listPublic`만 사용하고 카드형 결과 컴포넌트로 개편한다. 카드에는 title, URL, capturedAt, tags, public 상태만 표시한다.
2. 사이드바/공개 홈에 카드형 탐색 메뉴를 추가한다. 최소 카드: 공개 아카이브 탐색, 내 보관함/폴더, 새 사이트 등록. 개인 카드는 인증 사용자에게만 노출한다.
3. `/archives/[id]/page.tsx`는 `findPublicById`를 사용해 비로그인 public 상세를 허용한다. private이면 소유자라도 공개 경로가 아닌 개인 경로에서만 열리도록 분리한다.
4. `original`, `rendered`, `assets` route도 public/owned service method를 사용한다. public route로 접근할 때는 public saved predicate가 먼저 충족되어야 하며, private content는 owner session이 있는 개인 route에서만 반환한다.
5. 카드 UI에 사용하는 링크/검색/태그 query는 기존 `src/app/archives/query.ts`의 bounded parsing을 유지하고, public 목록에는 owner/folder 필터를 추가하지 않는다.
6. metadata/공개 URL에는 email, auth userId, 내부 filesystem 경로를 노출하지 않는다.

### Phase E — 기존 데이터 삭제 및 운영 반영

1. 기존 `archives`/`archives_v1` 데이터 이관 코드를 제거한다. 새 schema migration에서 기존 archive rows를 삽입하지 않는다.
2. 저장 디렉터리의 기존 UUID archive files도 migration에서 자동 재연결하지 않는다. 운영 release 전 DB와 `ARCHIVE_STORAGE_ROOT`를 함께 백업하고, 명시된 삭제 절차로 비운다.
3. readiness check가 users/folders/new archive schema와 필요한 index를 확인하도록 `src/lib/archive/readiness.ts` 및 테스트를 갱신한다.
4. README의 인증/공개 목록/기본 private/데이터 삭제 및 백업 설명을 갱신한다. Cloudflare Tunnel 설정은 변경하지 않는다.

## 5. 테스트 전략

### 단위/DB 통합 테스트

- `src/lib/auth.test.ts`
  - verify 성공 시 active user upsert.
  - 동일 user 재검증 시 profile/status 갱신.
  - inactive/suspended membership이 local disabled로 기록됨.
  - auth unavailable/401은 잘못된 disabled upsert를 하지 않음.
  - E2E bypass user 계약.
- `src/lib/archive/database.test.ts`
  - 새 schema가 기존 archive rows를 복사하지 않음.
  - 같은 URL을 서로 다른 owner가 각각 생성 가능하고 같은 owner는 idempotent.
  - private 기본값, explicit public 값 저장.
  - folder owner mismatch/존재하지 않는 folder 거부.
  - owner 목록/상세가 다른 owner row를 반환하지 않음.
  - public 목록/상세/content/asset이 saved + public만 반환.
  - pending/failed/private는 public에서 404/null.
  - disabled owner의 생성/개인 조회 거부.
  - folder 삭제 시 archive는 남고 folder_id만 null.
  - budget reservation/finalization rollback에서 owner/folder/visibility도 원자적으로 유지.
- `src/lib/archive/service.test.ts`
  - owner context 필수.
  - 캡처 완료 후 저장된 folder/visibility 유지.
  - 서로 다른 사용자의 동일 normalized URL 격리.

### Server/UI 테스트

- `src/app/archives/query.test.ts`: 카드형 공개 query의 q/tag/page bounds 유지.
- action 테스트: ownerId spoofing 무시, folderId 소유권 검증, private 기본값, 안전한 return path와 폴더 redirect.
- 컴포넌트 테스트: 비로그인 공개 카드 메뉴, 로그인 1-depth folder menu, private/public 표시, 폴더 등록 폼.
- 기존 `src/app/archive-form-state.test.ts`에 폴더 context가 오류 반환에서 보존되는지 추가.

### E2E

- fixture auth에서 user A/B와 active/disabled membership을 제어할 수 있도록 `e2e/fixture-server.mjs` 및 Playwright 설정을 확장한다.
- 비로그인: `/archives` 카드 목록과 public detail/readable/rendered/assets 접근 성공, private 접근 실패.
- user A: folder 생성 → folder에서 사이트 등록 → 캡처 완료 → 해당 folder로 복귀 → 아카이브가 A의 private 목록에 표시.
- user B: A의 private archive URL/asset/content 직접 접근 실패, 자신의 동일 URL 등록 가능.
- public 전환 후 비로그인 탐색/상세 성공, private 재전환 후 공개 접근 차단.
- membership 비활성화: 다음 verify 후 user disabled, 등록/폴더 관리/개인 조회 거부.
- 카드형 탐색 메뉴 및 1-depth 사이드바, 모바일 메뉴, redirect 경로 검증.
- 기존 `e2e/archive-submission.spec.ts`의 전역 등록 기대를 새 인증/폴더 흐름으로 교체하고, 공개 탐색 테스트는 별도 describe로 분리한다.

## 6. 마이그레이션·배포 전략

1. 애플리케이션 코드와 DB schema 변경을 한 릴리스 단위로 배포한다. 구 archive 데이터 호환을 목표로 하지 않는다.
2. 배포 전 앱 중지 → `/data` 전체 백업 → DB 및 archive storage 삭제/초기화 확인 → 새 이미지 기동 순서로 진행한다. 기존 `scripts/deploy.sh`의 백업/rollback 정책을 유지하되, schema가 비가역적임을 release checklist에 표시한다.
3. 새 앱 기동 후 readiness에서 `users`, `folders`, 새 `archives` schema/index, storage root 권한을 확인한다.
4. 첫 로그인으로 user upsert, private archive 생성, folder 복귀, public 전환/비로그인 조회를 smoke한다.
5. 실패 시 새 데이터가 없는 초기 상태에서는 이전 이미지/백업으로 rollback할 수 있지만, 새 schema에 기록된 데이터는 이전 이미지에서 읽을 수 없으므로 rollback 전 데이터 보존/폐기 결정을 명시한다.
6. 실제 Tunnel ingress나 Cloudflare 설정은 변경하지 않는다.

## 7. 보안 검토 체크리스트

- 모든 owner-aware SQL에 `owner_id = ?`를 포함하고, ID-only repository 메서드는 private 경로에서 사용하지 않는다.
- 공개 SQL은 `visibility='public' AND status='saved'`를 항상 포함하며, 인증 실패 시 private 결과로 fallback하지 않는다.
- folderId, archiveId, returnTo, visibility는 클라이언트 입력이므로 세션 owner와 DB에서 재검증한다.
- public/private 변경 action이 필요하면 active owner만 변경할 수 있고, userId/ownerId를 payload로 받지 않는다.
- raw SQLite error, 내부 경로, auth 응답 전체를 UI/로그에 노출하지 않는다.
- 파일 route는 서비스 authorization을 통과한 뒤에만 storage를 읽으며 기존 UUID/asset key 형식 검증을 유지한다.
- 외부 redirect, XSS, 원격 asset/CSP 정책은 기존 방어를 유지한다.
- 계정 disabled 전환은 새 작업을 막지만 기존 private archive를 다른 사용자에게 공개하거나 삭제하지 않는다.

## 8. 실행 순서와 완료 기준

- [ ] Phase A 도메인 타입, schema, repository 계약
- [ ] Phase B verify upsert 및 disabled 보호 경계
- [ ] Phase C folder CRUD, folder-scoped registration, completion return
- [ ] Phase D public/private route 분리와 카드형 탐색 UI
- [ ] Phase E 삭제 migration, readiness, README/운영 절차
- [ ] 단위/통합/E2E 테스트 전환 및 추가
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`
- [ ] `docker compose config --quiet`, production image readiness/Chromium smoke
- [ ] review-gate에서 owner isolation, public query separation, migration irreversibility 검토
- [ ] 구현 완료 후 `graphify update .` 실행

## 9. 예상 변경 파일군

- 인증: `src/lib/auth.ts`, `src/lib/auth.test.ts`, `src/proxy.ts`
- 도메인/DB: `src/lib/archive/types.ts`, `src/lib/archive/database.ts`, `src/lib/archive/database.test.ts`, `src/lib/archive/service.ts`, `src/lib/archive/service.test.ts`, `src/lib/archive/readiness.ts`
- 앱 경계: `src/app/actions.ts`, `src/app/archive-form.tsx`, `src/app/archive-form-state.ts`, `src/app/page.tsx`, `src/app/app-shell.tsx`, `src/app/app-navigation.tsx`, `src/app/breadcrumb.tsx`
- 공개/개인 화면: `src/app/archives/page.tsx`, `src/app/archives/query.ts`, `src/app/archives/[id]/page.tsx`, `src/app/archives/[id]/original/route.ts`, `src/app/archives/[id]/rendered/route.ts`, `src/app/archives/[id]/assets/[key]/route.ts`, 신규 `/library` 페이지/컴포넌트
- 스타일/아이콘: `src/app/globals.css`, `src/app/icons.tsx`
- 검증/운영: `e2e/*.spec.ts`, `e2e/fixture-server.mjs`, `README.md`

## 결정이 필요한 구현 세부사항

- private archive의 개인 화면 경로를 `/library`로 확정할지, `/archives/mine`으로 할지 구현 시작 전에 하나로 고정한다. 이 계획은 공개 `/archives`와의 보안 경계가 분명한 `/library`를 기본안으로 한다.
- folder 삭제 시 아카이브를 루트로 이동하는 정책을 기본으로 포함했다. 삭제와 함께 아카이브 삭제가 필요하면 별도 명시가 필요하다.
- archive visibility 변경 UI를 등록 후 개인 상세에 둘지 폴더 목록 bulk action으로 둘지 정한다. 어느 경우에도 active owner-only action으로 구현한다.
