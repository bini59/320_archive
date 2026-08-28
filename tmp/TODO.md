---
track: heavy
exec: worktree
files: 20-30 per integrated release (issue PRs are isolated)
branch: feat/issues-21-28
base: main
---

# 320_archive 이슈 #21~#28 구현 계획

## 계획 상태

- [ ] 이 문서는 계획 전용이다. 계획 단계에서는 애플리케이션 코드, 테스트 코드, 설정을 수정하지 않는다.
- [ ] 구현은 `feat/issues-21-28` 통합 브랜치에서 시작한다.
- [ ] 각 이슈는 원칙적으로 하나의 PR로 분리하고, PR에는 `Closes #N`을 포함한다.
- [ ] 모든 PR은 해당 이슈의 단위/통합 테스트와 대표 E2E를 포함하며, CI 완료 후 결과에 따라 수정 또는 머지한다.
- [ ] 최종 통합 후 `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`를 실행한다.
- [ ] 코드 변경을 마친 뒤 `graphify update .`를 실행한다. 이 계획 작성 단계에서는 실행하지 않는다.

## 현재 조사 결과

### 저장소 상태

- `main`과 `origin/main`이 `4f18294`에서 일치하며 working tree는 깨끗하다.
- 기존 `tmp/TODO.md`는 이미 완료된 사용자 소유 아카이브/폴더 계획이었다. 이번 전체 이슈 계획으로 교체했다.
- Next.js 16.2.12, React 19.2.4, TypeScript 7, pnpm, Vitest, Playwright를 사용한다.
- 배포는 `main` → GitHub Actions → GHCR ARM64 → 기존 Docker `archive-prod`이며 Cloudflare Tunnel은 저장소 범위 밖이다.

### 현재 구현과 gap

- `src/app/app-shell.tsx`, `src/app/app-navigation.tsx`는 데스크톱 사이드바와 모바일 상단 영역을 모두 렌더링하지만, 모바일 nav는 일반 가로 nav일 뿐 하단 고정/안전 영역/오버플로 처리 규칙이 없다.
- `src/app/archives/[id]/archive-viewer.tsx`는 탭/tabpanel을 제공하지만 좁은 viewport에서의 배치 전용 스타일과 검증이 부족하다.
- `src/app/archive-form.tsx`는 폴더 선택에서 `__new__`를 선택하면 `/library?returnTo=%2F`로 이동한다. 모달 생성은 없다.
- `src/app/actions.ts`에는 `createFolderAction`, `setArchiveVisibilityAction` 등이 있고 owner는 세션에서 취득하지만, 모달에 맞는 반환 상태 계약은 없다.
- `src/app/globals.css`의 `.archive-form`은 `width: min(100%, 900px)`, `.form-row`는 flex이며 `@media (max-width: 720px)`가 일부만 세로 전환한다. #26은 이 스타일 계약을 정리해야 한다.
- `src/components/folder-view.tsx`의 폴더 내 목록은 `table.data` 하나이며 모바일 카드가 없다. 공개 탐색 `src/app/archives/page.tsx`는 이미 카드 기반이지만 검색 toolbar, 태그, 페이지 이동이 좁은 폭에서 재배치되지 않는다.
- `src/components/library-view.tsx`의 folder grid는 `minmax(210px, 1fr)`이고 이름은 한 줄 ellipsis라 좁은 화면 긴 폴더명에 취약하다.
- `src/lib/archive/service.ts`의 `create()`는 pending row를 만들고 동기 capture/save를 수행한다. 저장 실패 시 reservation release와 store cleanup을 하고, staging 저장은 `LocalSnapshotStore.save()`가 임시 디렉터리에서 rename한다.
- 현재 retry API/동시 claim은 없고, 실패 archive는 detail에서 실패 문구를 보여주는 흐름에 머문다.
- 현재 실패 메시지 매핑은 `src/app/archive-form-state.ts`에 일부 재시도 가능 오류만 남긴다. ordinary failure는 detail redirect 후 표시된다.
- `src/lib/archive/database.ts`/`types.ts`에는 owner/folder/visibility predicate, public/owned content·asset 조회, folder CRUD, visibility 변경이 이미 존재한다. #27은 이 기존 데이터 모델을 깨지 않고 저장/예산/파일 경계를 보강해야 한다.
- 현재 `src/lib/archive/service.test.ts`에는 저장 성공, 실패 시 파일 cleanup, 예산/동시성, private/public content 권한 테스트가 있다. `e2e/archive-submission.spec.ts`에는 성공·실패·자산·탭 흐름이 있으므로 확장 지점이 명확하다.

## 이슈별 구현 계약

### #27 — 저장 일관성 및 자원 정리 (선행 기반 PR)

목표는 기존 아카이브 호환성을 유지하면서 capture → derived content → assets → DB finalization의 실패 경계를 명확히 하는 것이다. 새 데이터 모델이나 삭제 migration을 만들지 않는다.

- 저장 전후 상태를 `pending → saved` 또는 `pending → failed`로만 전환하고, 실패한 reservation을 반드시 release한다.
- stage 디렉터리와 최종 archive 디렉터리를 구분하고, rename 이전/이후 예외 모두에서 stage·부분 최종 디렉터리를 정리한다. 기존 저장본을 덮어쓰지 않는다.
- `original.html`, `readable.html`, optional `rendered.html`, `snapshot.json`, `assets.json`의 부분 누락이 있으면 saved로 표시하지 않으며, read route는 기존 404/예측 가능한 fallback 계약을 유지한다.
- 예산 집계는 실제 성공 파일 바이트와 일치해야 하며, asset 저장 실패/최종화 실패/동시 요청/프로세스 reopen을 검증한다.
- 기존 DB/schema/기존 saved archive를 보존한다. 운영 데이터 삭제·비가역 migration은 범위에서 제외한다.

소유 파일: `src/lib/archive/service.ts`, `src/lib/archive/storage.ts`, `src/lib/archive/database.ts`, `src/lib/archive/types.ts` 및 해당 archive 테스트. UI 파일은 수정하지 않는다.

### #24 — 실패한 아카이브 재시도

#27의 상태/cleanup 계약 위에 같은 archive id를 재사용하는 owner-only retry를 추가한다.

- 재시도 가능한 코드(일시적 network/timeout/overloaded/rate limit/capture_failed 등)와 영구적 입력 오류(invalid URL, not HTML, unsupported MIME, too large, unsafe redirect 등)를 명시적인 allowlist로 분리한다.
- SQL 조건부 claim으로 `status='failed'`인 owner archive만 원자적으로 `pending`으로 바꾼다. 이미 retry 중이거나 saved인 행은 no-op/안전한 결과를 반환한다.
- retry는 새 archive row를 만들지 않고 기존 folder/visibility/tags/normalized URL/id를 보존한다. 동시 클릭·새로고침에도 capture가 한 번만 실행되도록 한다.
- Server Action과 detail/library 진입점 모두 owner session을 재검증한다. 클라이언트의 owner id를 신뢰하지 않는다.
- 성공 시 saved, 재실패 시 allowlisted failure 상태로 복귀하고 파일·budget 잔여를 정리한다.

소유 파일: `src/lib/archive/types.ts`, `database.ts`, `service.ts`, `src/app/actions.ts`, 실패 detail/목록 컴포넌트와 관련 테스트. #25의 문구/시각 상태는 이 PR에서 최소 계약만 제공하고 시각 UX는 #25에서 마무리한다.

### #25 — 아카이빙 진행 상태 및 결과 UX

현재 capture가 동기 Server Action이므로 서버 내부의 실시간 진행률을 가장하지 않는다. 브라우저의 action pending 상태와 최종 archive 상태를 정확히 표현하는 범위로 구현한다. 비동기 queue 도입은 별도 이슈다.

- 제출 직후 `useActionState` pending 동안 버튼을 disabled하고, URL/폴더/태그 입력의 중복 제출을 막는다.
- `pending`, `saved`, retryable failed, permanent failed, quota/rate/concurrency 거부를 사용자가 구분할 수 있는 상태/문구로 정리한다.
- pending이 오래 걸릴 때 “캡처 중이며 새로고침하지 않아도 된다”는 안내와 장시간 대기 후 확인 경로를 제공하되, 존재하지 않는 진행률을 표시하지 않는다.
- 실패 결과에는 재시도 가능한 경우 재시도 버튼과 다음 행동을, 영구 오류에는 수정할 입력/원인 안내를 제공한다.
- 성공 redirect, 오류 후 폼 값/폴더 context 보존, public cache revalidation을 회귀시키지 않는다.

소유 파일: `src/app/archive-form.tsx`, `src/app/archive-form-state.ts`, archive detail viewer/상태 표시 컴포넌트, `src/app/actions.ts`의 결과 전달부, 컴포넌트/E2E 테스트. #24가 먼저 머지되어 retry action을 제공해야 한다.

### #26 — 사이트 등록 폼 유동형 레이아웃

- 고정 max-width 의존을 제거하거나 토큰화하고, 입력 영역은 부모 usable width를 사용한다.
- URL 입력과 등록 버튼은 넓은 폭에서 합리적인 비율로 배치하고, 모바일에서는 세로 stack 및 full width가 된다.
- 폴더/공개 설정/태그 label, select, error가 overflow 없이 배치되며 긴 폴더명과 긴 오류도 줄바꿈한다.
- 모바일·태블릿·데스크톱 breakpoint는 임의 픽셀 고정보다 `minmax`, `clamp`, flex/grid 비율을 우선한다.

소유 파일: `src/app/globals.css`, `src/app/archive-form.tsx`의 className/semantic wrapper, `src/components/home-view.tsx`, 관련 UI/E2E 테스트. #22는 이 PR의 layout class를 소비하므로 #26을 선행한다.

### #22 — 사이트 등록 중 새 폴더 생성 모달

- 폴더 select에서 새 폴더를 선택하면 route 이동 없이 client modal을 연다.
- modal은 이름 input, 취소, 생성, pending/duplicate-submit 방지, server validation error를 제공한다.
- Escape, backdrop/취소 정책, `role=dialog`, labelled title, initial focus, 닫힌 뒤 select/form focus 복귀를 구현한다.
- Server Action은 기존처럼 session owner만 사용하고, 성공 시 새 folder id/name을 parent form select에 즉시 반영·선택한다. 폴더 목록 stale state를 남기지 않는다.
- 폴더명 trim/빈 값/길이/중복 오류는 사용자에게 안전한 field error로 반환한다. returnTo redirect는 modal 흐름에서 사용하지 않는다.

소유 파일: `src/app/archive-form.tsx`, 신규 `src/app/folder-create-modal.tsx`(필요 시), `src/app/actions.ts`, folder action/state 테스트, archive form E2E. #26의 form layout을 기준으로 한다.

### #21 — 모바일 전용 하단 내비게이션 및 탭 레이아웃

- 기존 데스크톱 sidebar를 유지하고 모바일에서는 사이트 등록/공개 탐색/내 보관함의 고정 하단 navigation을 사용한다.
- safe-area inset, content bottom padding, 충분한 touch target, active `aria-current`, keyboard focus를 보장한다.
- 폴더 링크는 하단 primary nav를 침범하지 않는 별도 scrollable/접근 가능한 영역으로 두거나 내 보관함 진입 후 제공한다.
- archive viewer의 읽기/렌더링/원문 tab은 좁은 폭에서 줄바꿈·가로 스크롤·focus 상태를 명시해 잘리지 않게 한다.
- 데스크톱 sidebar/topbar와 기존 route semantics는 유지한다.

소유 파일: `src/app/app-shell.tsx`, `src/app/app-navigation.tsx`, `src/app/active-nav-item.tsx`, `src/app/archives/[id]/archive-viewer.tsx`, `src/app/globals.css`, navigation/viewer E2E. #22/#26과 CSS 파일에서 충돌할 수 있어 CSS 블록을 전용 섹션으로 분리한다.

### #28 — 모바일 폴더 및 공개 아카이브 목록 반응형

- folder grid가 모바일 1열/필요 시 2열로 자연스럽게 축소되고 긴 이름을 안전하게 줄바꿈한다.
- 공개 archive card의 제목·URL·tag·date와 CTA가 viewport 밖으로 나가지 않는다.
- 검색, tag filter, reset, pagination toolbar가 모바일에서 세로/가변 배치되고 버튼 touch target을 유지한다.
- 빈 결과/빈 폴더 상태는 충분한 padding과 명확한 안내를 갖는다.

소유 파일: `src/components/library-view.tsx`, `src/app/archives/page.tsx`, `src/app/archives/query.ts`가 필요할 때만, `src/app/globals.css`, responsive E2E. #23과 `folder-view.tsx`/archive card 스타일에서 겹치므로 #28의 공통 card shell을 먼저 확정한다.

### #23 — 모바일 아카이브 목록 카드 UI

- `src/components/folder-view.tsx`의 desktop table은 유지하고 모바일에서만 동일 데이터를 독립 card list로 표시한다.
- card에는 제목, original URL, 저장일, visibility select/save, 상세 열기를 제공한다. 긴 URL/title은 layout을 깨지 않게 처리한다.
- visibility action은 기존 owner-only Server Action을 사용한다. 카드와 테이블에 서로 다른 권한/데이터 계약을 만들지 않는다.
- desktop/mobile 중복 DOM을 최소화하고, 접근성상 중복 링크/label을 정리한다.

소유 파일: `src/components/folder-view.tsx`, `src/app/globals.css`, folder card component/test, responsive E2E. #28 이후 머지해 공통 mobile card/grid 스타일 충돌을 줄인다.

## 의존성 및 병렬 실행 그룹

실행 브랜치와 워크트리는 모두 `feat/issues-21-28`에서 파생한다. 공통 타입/DB/service는 병렬 수정하지 않는다.

### Group 0 — 선행 조사/계약 검증

- 상태: pending
- 대상: #27의 기존 atomic stage/cleanup와 budget finalization, #24의 retry 상태 계약, #25의 동기 action UX 한계 확인
- 산출물: 구현 전 테스트 케이스 목록과 파일 ownership 확인. 별도 기능 코드는 만들지 않는다.
- 완료 기준: #27/#24/#25의 상태 전이와 호환성 기준이 이 TODO 및 각 PR 설명에 일치한다.

### Group 1 — 저장 기반 (순차)

- PR-27: #27 저장 일관성/자원 정리
- PR-24: #24 실패 retry (`PR-27` 머지 후)
- PR-25: #25 진행/결과 UX (`PR-24` 머지 후)
- 이유: 상태 전이와 cleanup을 먼저 고정해야 retry가 중복 파일/예산을 만들지 않고, UX가 실제 retry 가능성을 정확히 표현할 수 있다.

### Group 2 — 등록 폼 (순차)

- PR-26: #26 유동형 form layout
- PR-22: #22 폴더 생성 modal (`PR-26` 머지 후)
- 이유: 두 PR이 `archive-form.tsx`를 만지므로 layout wrapper/class를 먼저 고정해 modal 기능 PR의 충돌을 줄인다.

### Group 3 — navigation/list UI (부분 병렬 후 순차 통합)

- PR-21: #21 mobile bottom nav + viewer tabs
- PR-28: #28 folder/public list responsive
- PR-23: #23 folder archive mobile cards (`PR-28` 머지 후)
- PR-21과 PR-28은 서로 다른 컴포넌트를 우선 소유한다. 둘 다 `globals.css`에 추가하는 경우 전용 comment block을 분리한다. PR-23은 `folder-view.tsx`를 독점해 #28과 직접 충돌하지 않게 한다.

### 통합 순서

1. Group 0 완료
2. Group 1: #27 → #24 → #25
3. Group 2: #26 → #22
4. Group 3: #21과 #28을 병렬 구현/CI 후 통합 → #23 구현/CI
5. 모든 PR 통합 후 전체 lint/typecheck/unit/E2E/build 및 Docker/health smoke

## PR별 브랜치와 완료 기준

| PR | 이슈 | 브랜치 | 선행 | 핵심 완료 기준 |
| --- | --- | --- | --- | --- |
| PR-27 | #27 | `feat/issue-27-storage-consistency` | Group 0 | 실패/동시성/예산 테스트 통과, 기존 saved 데이터 호환 |
| PR-24 | #24 | `feat/issue-24-archive-retry` | PR-27 | 동일 id·owner-only·atomic claim·retry race 테스트 통과 |
| PR-25 | #25 | `feat/issue-25-archive-status-ux` | PR-24 | pending/성공/오류별 UI와 재시도 CTA E2E 통과 |
| PR-26 | #26 | `feat/issue-26-fluid-registration-form` | Group 0 | mobile/tablet/desktop overflow 없는 form viewport 검증 |
| PR-22 | #22 | `feat/issue-22-folder-modal` | PR-26 | modal a11y, Escape/focus, server owner validation, 자동 선택 E2E |
| PR-21 | #21 | `feat/issue-21-mobile-navigation-tabs` | Group 0 | bottom nav touch/focus/active state와 viewer tabs 모바일 검증 |
| PR-28 | #28 | `feat/issue-28-responsive-lists` | Group 0 | folder/public/search/pagination/empty 상태 모바일 검증 |
| PR-23 | #23 | `feat/issue-23-mobile-archive-cards` | PR-28 | mobile card + desktop table, visibility/detail action E2E |

각 PR 공통 완료 기준:

- [ ] 관련 단위/통합 테스트를 먼저 RED로 추가하고 최소 구현 후 GREEN, 리팩터한다.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` 통과
- [ ] 해당 PR의 Playwright viewport/E2E 통과
- [ ] 보안/owner boundary, public/private read boundary 회귀 없음
- [ ] CI가 약 4분 소요되는 동안 로그를 확인하고 실패 시 원인 수정 후 재실행
- [ ] review-gate의 correctness/security pass와 ponytail over-engineering pass 완료
- [ ] PR body에 변경 파일, 테스트 명령, CI run, 남은 위험을 기록
- [ ] 통합 후 해당 이슈가 실제로 해결됐는지 acceptance criteria를 체크하고 닫는다.

## 파일 ownership / 충돌 회피

- 저장 핵심: `src/lib/archive/{types,database,service,storage}.ts`는 Group 1만 수정한다.
- 상태 UX: `src/app/archive-form-state.ts`, capture form 결과 표시, retry CTA는 #25가 소유한다. #24는 action/service hook만 추가한다.
- 등록 form: #26은 layout/class wrapper, #22는 modal/state/owner action을 소유한다.
- shell/nav: #21은 `app-shell.tsx`, `app-navigation.tsx`, `active-nav-item.tsx`, viewer tabs를 소유한다.
- 공개/folder list: #28은 `library-view.tsx`, 공개 list toolbar/card shell을 소유하고, #23은 `folder-view.tsx` mobile card를 소유한다.
- `globals.css`는 feature별 named block을 사용해 cherry-pick/merge 시 같은 줄을 동시에 수정하지 않는다.
- 공통 타입·utility를 병렬 PR에서 임의로 확장하지 말고, 필요하면 선행 PR 또는 해당 도메인 소유 PR에서만 변경한다.

## 테스트 전략

### Unit/integration

- #27: `service.test.ts`, `storage.test.ts`, `database.test.ts`에 stage cleanup, reservation release/finalize, partial file, missing content, reopen, concurrent capture를 추가한다.
- #24: repository conditional retry claim, retryable allowlist, same-id/idempotency, owner mismatch, simultaneous retry를 테스트한다.
- #25: `archive-form-state.test.ts`에 모든 failure code/next action mapping, pending state contract, folder/field state preservation을 추가한다.
- #22/#26: modal state reducer/validation 및 semantic form rendering 테스트를 추가한다. server action은 owner spoofing, duplicate/invalid folder name을 검증한다.
- #21/#28/#23: 가능하면 순수 formatter/class contract를 테스트하고, 레이아웃 핵심은 Playwright viewport로 검증한다.

### E2E viewport journeys

- viewport: 대표 mobile `390x844`, narrow mobile `320x700`, tablet `768x1024`, desktop `1280x800`.
- #21: mobile bottom nav 각 링크, active aria state, keyboard focus, viewer tabs의 clipped/overflow 없음.
- #22/#26: 등록 → 새 폴더 modal → 생성 → select 자동 반영 → submit; 각 viewport에서 URL/button/label/error overflow 없음.
- #23/#28: folder table/card 전환, 긴 title/URL/folder, public search/tag/reset/pagination, empty state.
- #24/#25/#27: fixture capture fail → detail failure state → retry → same archive saved; duplicate click/concurrent retry; forced asset/storage/quota failure cleanup.
- 인증 fixture는 기존 `e2e/fixture-server.mjs`/Playwright 설정을 확장하되, 실제 production secret이나 Cloudflare Tunnel을 테스트에 넣지 않는다.

## 검증/리뷰/배포 완료 기준

- [ ] 각 PR CI green 및 required checks 통과
- [ ] 실패 CI는 로그를 확인하고 코드/테스트를 수정한 뒤 재실행; green 전 머지 금지
- [ ] 통합 브랜치에서 `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`
- [ ] `docker compose config --quiet` 및 이미지 기동/readiness `/health/ready` 확인
- [ ] public `/archives` 200, 인증 보호된 `/`/`/library` 흐름, archive detail/readable/rendered/assets smoke
- [ ] owner isolation과 private archive content/asset 직접 접근 실패 smoke
- [ ] `review-gate` correctness/security → ponytail cleanup 순서로 최종 리뷰
- [ ] `graphify update .` 실행 후 graph 변경을 확인
- [ ] release skill의 기존 Docker/backup/rollback 절차에 따라 main 배포
- [ ] 배포 후 모바일/desktop public smoke 및 실제 archive retry/folder modal 흐름 확인
- [ ] 모든 acceptance criteria 검증 후 #21~#28 이슈 close
- [ ] 모든 작업과 워크트리 정리 후 `tmp/TODO.md` 삭제 (dev-workflow 완료 절차)

## 범위 밖 / 안전 제약

- Cloudflare Tunnel ingress/DNS를 애플리케이션 초기화나 PR에서 변경하지 않는다.
- #25를 위해 장시간 비동기 queue/worker를 새로 도입하지 않는다. 필요성이 확인되면 별도 이슈로 분리한다.
- #27에서 기존 archive rows/files를 삭제하거나 비가역 schema migration을 하지 않는다.
- ownerId, folderId, archiveId, returnTo는 클라이언트 입력을 신뢰하지 않으며 서버 session/DB에서 검증한다.
