---
track: heavy
exec: worktree
files: 20
groups: 3
dependencies: group-0 → group-1, group-0 → group-2
branch: feature/issue-1-basic-archive
base: main
---

# Issue #1: 기본 Archive 제출 및 공개 상세 흐름

## Overview

공개 홈에서 HTTP(S) URL 하나를 받아 서버에서 정규화·내부망 차단 검증하고, UUID 기반 Archive를 SQLite와 로컬 메타데이터 디렉터리에 멱등 저장한 뒤 `/archives/{id}`로 이동한다. 새 Archive는 `pending`이며, 동일한 정규화 URL은 기존 Archive를 재사용한다. 실제 HTML/Asset 캡처와 인증·공개 범위 제어는 후속 작업으로 남긴다.

계획은 Next.js 16 문서의 Server Action 입력 검증과 `useActionState`, `redirect()`의 예외 기반 제어 흐름, Promise 형태의 동적 `params`, 동기 `node:sqlite` 조회 전 `connection()` 호출 요구사항을 따른다.

## Group 0: 선행 (domain/storage)
> 병렬 작업 전 반드시 먼저 완료

- [x] `Archive`, `pending`, 생성 결과 타입과 저장소 인터페이스를 정의하고 original/normalized URL, UUID, ISO 생성 시각의 불변식을 고정한다 (`src/lib/archive/types.ts`)
- [x] WHATWG `URL`로 HTTP(S)만 허용하고 호스트 소문자화·기본 포트 제거를 적용하되 path/query/fragment는 보존한다. localhost 이름, IPv4/IPv6 loopback·private·link-local·unspecified 범위를 거부하고 오류를 사용자 표시 가능한 형태로 반환한다 (`src/lib/archive/url.ts`)
- [x] 환경 변수 기반 SQLite/Archive root 경로를 해석하고 기본값을 각각 `data/archive.db`, `data/archives`로 설정한다. 테스트가 명시 경로를 주입할 수 있게 하며 디렉터리를 안전하게 생성한다 (`src/lib/archive/config.ts`)
- [x] `node:sqlite` 스키마와 prepared statement를 구성한다. `normalized_url` UNIQUE 제약, UUID primary key, 상태/생성 시각 컬럼을 두고 create-or-get을 트랜잭션으로 처리하여 동시 중복 제출도 같은 행을 재사용하게 한다 (`src/lib/archive/database.ts`)
- [x] SQLite 저장 뒤 `<archive-root>/<uuid>/metadata.json`을 원자적으로 생성하고 기존 디렉터리/메타데이터는 멱등 처리한다. DB 성공·파일 실패 시 재제출로 복구 가능하도록 저장 순서와 오류 계약을 명시한다 (`src/lib/archive/storage.ts`)
- [x] URL 검증부터 DB create-or-get, 메타데이터 보장, ID 조회를 한 진입점으로 묶어 UI가 영속화 세부사항에 의존하지 않게 한다 (`src/lib/archive/service.ts`)

## Group 1: 제출 및 상세 UI (병렬)
> worktree: `tmp/worktrees/feature-issue-1-basic-archive-group-1`

- [x] `'use server'` 액션에서 FormData를 불신 입력으로 검증하고 예상 가능한 URL 오류는 action state로 반환한다. 영속화 성공 후 `redirect()`는 try/catch 밖에서 호출하여 신규·중복 모두 안정 URL로 이동시킨다 (`src/app/actions.ts`)
- [x] `useActionState` 기반 URL 입력 폼을 구현해 required/url 힌트, 서버 오류의 `aria-live` 표시, 제출 중 버튼 비활성화를 제공한다 (`src/app/archive-form.tsx`)
- [x] 기존 placeholder를 공개 제출 화면으로 교체하고 폼의 레이블·설명·오류 영역을 접근 가능하게 배치한다 (`src/app/page.tsx`)
- [x] Promise인 `params`에서 UUID를 읽고 `connection()` 이후 Archive를 조회해 원본 URL과 `pending` 상태, 생성 시각을 표시한다. 잘못된/없는 ID는 `notFound()`로 처리한다 (`src/app/archives/[id]/page.tsx`)
- [x] 존재하지 않는 Archive에 대한 명확한 404 화면과 홈 복귀 링크를 추가한다 (`src/app/archives/[id]/not-found.tsx`)

## Group 2: 자동화 및 운영 경계 (병렬)
> worktree: `tmp/worktrees/feature-issue-1-basic-archive-group-2`

- [x] Vitest와 Playwright 테스트 명령·개발 의존성을 추가하되 Node 내장 `node:sqlite`를 사용하는 현재 런타임 요구사항을 유지한다 (`package.json`, `pnpm-lock.yaml`)
- [x] Vitest의 Node 환경과 path alias를 설정하고 테스트별 임시 SQLite/Archive root 정리를 지원한다 (`vitest.config.ts`)
- [x] 정규화 동등성/차이(path, query, fragment), 잘못된 scheme, malformed URL, localhost 및 IPv4/IPv6 내부망 범위를 단위 테스트한다 (`src/lib/archive/url.test.ts`)
- [x] 임시 디렉터리에서 신규 생성, 중복 재사용, DB 재시작 후 조회, 메타데이터 생성/복구, 동시 중복 제출을 통합 테스트한다 (`src/lib/archive/service.test.ts`)
- [x] Playwright webServer와 테스트 전용 격리 저장 경로를 구성한다 (`playwright.config.ts`)
- [x] 공개 폼의 성공 제출→UUID 상세 리다이렉트→URL/pending 표시, 동일 URL 재제출 시 같은 상세 URL, 잘못된/내부망 URL 오류, 없는 UUID의 404를 E2E 검증한다 (`e2e/archive-submission.spec.ts`)
- [x] 실제 런타임 데이터가 Git에 들어가지 않도록 `data/`를 제외한다 (`.gitignore`)
- [x] 환경 변수 이름, 기본 저장 경로, 로컬 실행 및 테스트 명령을 문서화한다 (`README.md`)

## Integration

- [ ] 선행 그룹 완료 후 UI/테스트 워크트리를 변경량 적은 순서로 머지하고 충돌 시 Group 0의 공개 계약을 기준으로 정리한다
- [ ] `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm build` 실행
- [ ] `pnpm test:e2e`로 실제 제출/리다이렉트/상세/검증 실패 흐름 확인
- [ ] `graphify update .`로 지식 그래프 갱신
- [ ] 코드 리뷰: 정확성·보안 1차, 과설계·단순화 2차

## Risks

- [SSRF 검증 우회]: DNS 조회나 실제 캡처는 이번 범위에 없지만 hostname/IPv4/IPv6 literal의 내부 범위를 엄격히 거부하고, 후속 fetch 구현 시 DNS rebinding 및 redirect hop 재검증을 별도 보안 경계로 둔다.
- [DB/파일 이중 쓰기 불일치]: DB의 UNIQUE 제약을 기준 진실로 삼고 메타데이터 쓰기를 멱등·원자적으로 만들어 재제출이 누락 파일을 복구하게 한다.
- [동시 중복 제출]: 애플리케이션의 사전 조회만 믿지 않고 SQLite UNIQUE 제약과 트랜잭션에서 충돌 후 기존 행을 조회한다.
- [Next.js 정적 최적화와 동기 DB]: 상세 페이지는 `connection()` 뒤 SQLite를 읽어 빌드 시점 값이 고정되거나 prerender 오류가 나지 않게 한다.
- [Server Action 오류/리다이렉트 혼동]: 예상 검증 오류만 직렬화된 action state로 반환하고, `redirect()`는 예외를 삼키지 않도록 try/catch 밖에 둔다.
- [프로세스별 SQLite 연결]: 경로별 연결 생명주기를 서버 전용 모듈에 캡슐화하고 테스트에는 명시적 정리 API를 제공해 파일 잠금과 테스트 간 누수를 방지한다.
