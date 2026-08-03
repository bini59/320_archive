---
track: heavy
files: 16
groups: 3
dependencies: group-0 → group-1, group-0 → group-2
branch: feature/issue-5-public-library
base: main
---

# Issue #5: 공개 아카이브 탐색·검색 및 Docker 운영

## Overview
저장 완료된 아카이브만 노출하는 `/archives` 공개 라이브러리를 추가하고, 제목·원본 URL·정제 본문은 SQLite FTS5로 검색하며 제출자가 입력한 선택 태그로 탐색할 수 있게 한다. 검색 색인은 캡처 성공 트랜잭션에서 갱신하고 URL query 기반 필터와 고정 크기 페이지네이션을 제공하며, SQLite와 아카이브 파일은 Docker의 단일 명시 볼륨에 영속화해 정지 상태의 일관된 백업/복구 절차를 문서화한다.

## Requirements and decisions

- 공개 목록에는 `saved` 상태만 포함하고 최신 캡처 순으로 정렬하며, 각 항목은 기존 `/archives/[id]` 상세 링크와 제목(없으면 URL), 원본 URL, 캡처 시각, 설명, 태그를 표시한다.
- `/archives?q=<query>&tag=<slug>&page=<n>`을 정규 URL 계약으로 사용한다. 검색어와 태그는 함께 적용하고 잘못된/과도한 query 값은 안전한 기본값으로 제한한다.
- 제목·원본 URL·정제 Snapshot 본문은 저장 성공 시 FTS5에 색인한다. FTS 질의 구문을 사용자가 직접 주입하지 않도록 입력을 토큰화/인용하고 길이·토큰 수를 제한한다.
- 태그의 출처는 제출 폼의 선택 입력으로 한다. 쉼표 구분 값을 trim·공백 축약·소문자 정규화하여 중복을 제거하고, 태그 개수와 개별 길이 및 허용 문자를 제한한다. 표시값과 정규화 slug를 보존하며 동일 URL 재제출 시 유효 태그를 합친다.
- 태그 및 색인 기록은 아카이브와 관계형 테이블로 관리한다. 기존 DB는 시작 시 멱등 migration하며 기존 saved 행은 제목/URL부터 backfill하고, 본문은 저장 파일을 읽을 수 있는 서비스 계층의 별도 backfill 경로 없이 향후 캡처부터 완전 색인한다는 제약을 테스트·문서에 명시한다.
- 검색 결과는 고정 page size와 최대 page/query 범위를 사용하고 `COUNT`와 결과 조회가 같은 필터 의미를 갖게 한다. 빈 검색은 일반 인덱스 조회, 검색어가 있을 때만 FTS5를 사용한다.
- 컨테이너는 Next.js standalone 출력으로 비-root 실행한다. `/data` 하나에 `archive.db`와 `archives/`를 함께 두고 compose named volume을 명시한다.
- 백업은 앱 컨테이너를 중지한 뒤 `/data` 볼륨 전체를 하나의 아카이브로 복사하고 다시 시작하는 절차로 정한다. 복구도 앱 중지 → 빈 대상 볼륨에 전체 복원 → 권한 확인 → 시작 순서로 하여 WAL과 파일 저장소의 시점을 일치시킨다.
- Cloudflare Tunnel과 ingress/rate-limit 구성은 저장소 밖 운영자 책임이며 Docker/애플리케이션 설정에 생성하지 않는다.

## Group 0: 선행 (domain/database contract)
> 병렬 작업 전 반드시 먼저 완료

- [x] `Archive`, `Snapshot`, 생성 입력, 공개 목록 item/query/result, `Tag` 타입과 repository/service 계약을 추가하고 검색·태그·페이지 제한 상수를 정의한다 (`src/lib/archive/types.ts`)
- [x] 태그 파서/정규화기를 구현하고 빈 값, Unicode/대소문자, 중복, 허용 문자, 개수·길이 초과를 단위 테스트한다 (`src/lib/archive/tags.ts`, `src/lib/archive/tags.test.ts`)
- [x] `tags`, `archive_tags`, FTS5 virtual table 및 목록용 인덱스를 멱등 migration으로 추가하고, 저장 완료 시 snapshot 메타·정제 본문·태그·FTS 행을 한 트랜잭션에 기록한다. saved-only 목록, 제목/URL/body 검색, 태그 교집합 필터, 안정적 정렬, count/page, 기존 DB migration 및 다중 연결 동작을 통합 테스트한다 (`src/lib/archive/database.ts`, `src/lib/archive/database.test.ts`)
- [x] 캡처 결과에서 색인용 plain text를 결정적으로 추출하되 script/style/markup을 제외하고 공백과 최대 색인 길이를 제한하는 함수 및 테스트를 추가한다 (`src/lib/archive/readable.ts`, `src/lib/archive/readable.test.ts`)
- [x] `ArchiveService.create(url, tags)`가 정규화 태그를 저장하고 readable 본문을 DB 저장 성공 단계에 전달하며, 공개 조회 메서드가 repository 계약을 노출하도록 확장한다. DB 실패 시 파일 cleanup 및 기존 실패 계약을 보존하는 테스트를 추가한다 (`src/lib/archive/service.ts`, `src/lib/archive/service.test.ts`)

## Group 1: 공개 라이브러리와 제출 UX (병렬)
> worktree: `tmp/worktrees/feature-issue-5-public-library-group-1`

- [x] 제출 폼에 선택적 쉼표 구분 태그 입력, 도움말, 길이 제한 및 접근 가능한 오류 연결을 추가한다 (`src/app/archive-form.tsx`)
- [x] Server Action에서 태그를 검증해 서비스로 전달하고 태그 오류는 안전한 폼 상태로 반환하며 기존 URL/캡처 오류 흐름을 유지한다 (`src/app/actions.ts`, `src/app/archive-form-state.ts`, `src/app/archive-form-state.test.ts`)
- [x] `/archives` Server Component에서 Next.js 16의 async `searchParams`를 파싱하고 서버에서 목록을 조회해 검색 폼, 선택 필터, 태그 browse, 결과/빈 상태, 안정 링크, 이전·다음 페이지 URL을 렌더링한다 (`src/app/archives/page.tsx`)
- [x] 홈 화면에 공개 라이브러리 진입 링크를 추가하고 기존 제출 중심 랜딩 동작을 보존한다 (`src/app/page.tsx`)

## Group 2: Docker 운영과 문서 (병렬)
> worktree: `tmp/worktrees/feature-issue-5-public-library-group-2`

- [x] Next.js standalone 서버 출력을 활성화하고 현재 TypeScript 설정과 self-hosting 빌드를 유지한다 (`next.config.ts`)
- [x] pnpm multi-stage build, production dependency 산출물, 비-root 사용자, `/data` 디렉터리 및 `3000` 포트를 갖는 production 이미지를 추가한다 (`Dockerfile`, `.dockerignore`)
- [x] 앱 서비스와 명시적 `/data` named volume, `ARCHIVE_DATABASE_PATH=/data/archive.db`, `ARCHIVE_STORAGE_ROOT=/data/archives`, restart/healthcheck를 정의하고 Tunnel 서비스나 ingress는 포함하지 않는다 (`compose.yaml`)
- [x] 로컬 시작, 환경 변수, Docker build/up/down, 볼륨 위치, 앱 정지 기반 전체 `/data` 백업, 빈 볼륨 복구·권한·검증, WAL 파일 주의, 버전 호환성 및 외부 Cloudflare Tunnel 책임을 실행 가능한 명령과 함께 문서화한다 (`README.md`)

## Integration

- [ ] 선행 그룹을 먼저 통합한 뒤 변경량이 적은 Group 2, Group 1 순으로 워크트리를 머지하고 충돌 시 공유 타입·서비스 계약을 기준으로 조정한다
- [ ] repository/service/tag/parser 단위·통합 테스트를 실행하고 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`를 통과시킨다
- [ ] 여러 saved/failed fixture를 만들고 제목·URL·본문 검색, 태그 browse/filter, 검색+태그 조합, 페이지 이동, 빈 결과, 상세 stable link를 검증하는 E2E를 추가한다 (`e2e/archive-library.spec.ts`, `e2e/fixture-server.mjs`)
- [ ] `docker compose config`, 이미지 build, 임시 named volume에서 기동/healthcheck, 데이터 재기동 영속성, 문서의 중지 백업·빈 볼륨 복구 smoke test를 수행한다
- [ ] `graphify update .`로 지식 그래프를 갱신한다
- [ ] `review-gate`로 정확성·보안(FTS query escaping, XSS/URL 출력, 공개 데이터 경계, pagination 자원 제한, 컨테이너 권한, 백업 일관성)과 과설계를 검토하고 CRITICAL/HIGH를 모두 해소한다

## Risks

- FTS5 가용성: 실행 Node/SQLite 빌드에 FTS5가 없으면 시작 시 명확히 실패하도록 capability를 확인하고 Docker 이미지와 CI에서 실제 검색 테스트로 보장한다.
- 기존 데이터 본문 backfill: DB만으로 readable 파일 본문을 읽을 수 없으므로 기존 행은 제목/URL 검색을 즉시 지원하고, 완전한 본문 backfill이 필요하면 별도 운영 migration 이슈로 분리한다.
- FTS query syntax/DoS: 사용자 문자열을 raw `MATCH`에 넣지 않고 제한된 토큰을 인용하며 query 길이, 토큰 수, page 상한을 둔다.
- 저장소·색인 불일치: 파일 저장 후 DB 트랜잭션 실패 시 기존 cleanup 계약을 유지하고 saved 상태, 태그, FTS를 한 DB 트랜잭션으로 커밋한다.
- 태그 오염: 제출자가 임의 입력할 수 있으므로 개수·길이·문자 집합을 제한하고 정규화 slug에 UNIQUE를 적용하며 UI 출력은 React escaping을 유지한다.
- SQLite/WAL 백업 일관성: 실행 중 DB 파일만 복사하지 않으며, 앱을 완전히 중지한 상태에서 DB·WAL·아카이브 파일이 함께 있는 `/data` 볼륨 전체를 백업·복구한다.
- Docker 권한: 비-root 런타임 UID가 새 볼륨과 복구 데이터에 쓸 수 있는지 기동 및 복구 smoke test에서 확인하고 문서에 소유권 복구 명령을 제공한다.
