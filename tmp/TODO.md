---
track: heavy
exec: worktree
files: 17
groups: 3
dependencies: group-0 → group-1, group-0 → group-2
branch: feature/issue-2-safe-webpage-capture
base: main
---

# Issue #2: 제출한 웹페이지의 안전한 동기 캡처

## Overview

공개 URL 제출 직후 같은 Server Action 요청 안에서 HTML 캡처를 완료하고, 성공 시 원문과 스냅샷 메타데이터를 로컬 저장소에 남긴 뒤 Archive를 `saved`로 전환한다. 캡처 실패도 Archive 자체는 유지하여 `failed` 상태와 제한된 사용자용 사유를 공개 상세 페이지에 표시하며, 인증을 추가하지 않는 대신 SSRF 방어와 프로세스/SQLite 기반 자원 경계를 애플리케이션 내부에서 강제한다.

캡처 정책은 HTTP(S), DNS 결과의 global-unicast 주소만 허용, 선택한 주소로 연결 고정(IP pinning), redirect 매 hop 재검증, 최대 redirect 5회, 전체 10초 timeout, 압축 해제 후 HTML 5 MiB, `text/html` 응답만 허용으로 확정한다. Next.js 16 문서에 따라 공개 Server Action을 직접 호출 가능한 불신 경계로 취급하고, 동기 캡처가 끝난 뒤에만 상세 페이지로 redirect한다.

## Group 0: 선행 (capture domain/storage)
> 병렬 작업 전 반드시 먼저 완료

- [ ] `ArchiveStatus`를 `pending | saved | failed`로 확장하고 title, description, capturedAt, finalUrl, byteLength, safe failure code/message를 표현하는 Snapshot/캡처 결과 타입을 정의한다. Repository에는 상태 전이를 위한 `markSaved`/`markFailed`, abuse 예산 예약 인터페이스를 추가한다 (`src/lib/archive/types.ts`)
- [ ] 기존 `archives` CHECK 제약을 세 상태로 안전하게 마이그레이션하고 snapshot/failure 컬럼을 추가한다. `pending → saved|failed`만 허용하는 조건부 update, 중복 URL의 기존 최종 상태 재사용, SQLite 트랜잭션 기반 전역 시간창 제출 한도와 총 저장 바이트 quota 예약/해제를 구현한다 (`src/lib/archive/database.ts`)
- [ ] URL 구문 검증을 캡처 보안 경계로 확장한다. URL 최대 8 KiB, HTTP(S) 전용, credentials 금지에 더해 DNS A/AAAA 전체 결과가 global-unicast인지 판정하고 특수 목적/사설/loopback/link-local/multicast/unspecified/documentation 주소를 거부하는 순수 함수와 resolver 주입 지점을 제공한다 (`src/lib/archive/url.ts`)
- [ ] Node `http`/`https` 요청으로 안전한 캡처 클라이언트를 신설한다. 검증된 DNS 주소 하나를 `lookup`에 고정하면서 원래 hostname을 Host/SNI/TLS 검증에 유지하고, 자동 redirect를 끈 채 상대 Location을 해석하여 매 hop DNS 재조회·IP 고정 검증한다. redirect 5회, 전체 AbortSignal 10초, `content-type`의 `text/html` 확인, Content-Length 선검사와 압축 해제 후 스트림 5 MiB 초과 즉시 중단, 응답/소켓 정리를 구현한다 (`src/lib/archive/fetcher.ts`)
- [ ] HTML에서 `<title>`과 description meta를 제한적으로 추출하고 entity/공백을 정규화하되, malformed HTML·누락 태그를 캡처 실패로 만들지 않으며 메타데이터 필드 길이를 제한한다 (`src/lib/archive/html.ts`)
- [ ] `<archive-root>/<uuid>/original.html`과 `snapshot.json`을 sibling 임시 파일로 fsync한 뒤 승격하고, 둘이 모두 준비된 후에만 DB를 `saved`로 전환하는 저장 계약을 구현한다. 중간 실패 시 임시/부분 결과를 제거하고 `failed`로 귀결해 공개 조회에서 반쪽 스냅샷이 성공으로 보이지 않게 한다 (`src/lib/archive/storage.ts`)
- [ ] 10초/5 MiB/redirect/동시 캡처/SQLite rate 및 byte quota 기본값을 환경 변수로 해석·검증하고 테스트에서 작은 경계를 주입할 수 있게 한다. 프로세스별 동시 캡처 semaphore는 대기열을 무제한 늘리지 않고 즉시 안전한 과부하 결과를 반환하도록 구성한다 (`src/lib/archive/config.ts`, `src/lib/archive/limiter.ts`)
- [ ] create-or-get 뒤 신규 `pending` Archive만 quota를 예약하고 즉시 캡처한다. 저장 성공 시 `saved`, 예상 가능한 네트워크/정책/파싱/용량 실패 시 내부 세부정보를 기록하지 않는 허용 목록 기반 안전 문구와 `failed`로 전환하며, 예상 밖 저장/DB 오류는 원인을 노출하지 않고 일관된 실패 상태를 남긴다. 이미 `saved`/`failed`인 중복 제출은 재요청하지 않는다 (`src/lib/archive/service.ts`)

## Group 1: 제출 및 상세 UI (병렬)
> worktree: `tmp/worktrees/feature-issue-2-safe-webpage-capture-group-1`

- [x] 공개 Server Action 입력을 계속 불신 데이터로 검증하고 capture service를 await한 뒤 `/archives/{id}`로 redirect한다. rate/quota/과부하 거절은 예외 세부정보 없이 폼에 재시도 가능한 안전 문구로 반환하고, 생성된 Archive의 일반 캡처 실패는 상세 페이지에서 확인하도록 redirect한다 (`src/app/actions.ts`, `src/app/archive-form-state.ts`)
- [x] 최대 URL 길이를 브라우저 힌트에도 반영하고, 동기 요청 중 버튼/문구를 `캡처 중…`으로 표시하여 최대 10초 작업임을 명확히 하며 서버 오류를 기존 `aria-live` 영역에 유지한다 (`src/app/archive-form.tsx`)
- [x] 공개 상세 페이지에서 `pending/saved/failed`별 한국어 badge와 설명을 렌더링한다. saved에는 title, description, 최종 URL, 캡처 시각, 원문 byte 수를 표시하고 failed에는 저장된 안전 문구만 표시하며 로컬 원문 파일 경로/내부 오류는 노출하지 않는다 (`src/app/archives/[id]/page.tsx`)

## Group 2: 자동화 및 운영 경계 (병렬)
> worktree: `tmp/worktrees/feature-issue-2-safe-webpage-capture-group-2`

- [x] IP 분류와 DNS 결과 전부 검사, literal IP, redirect hop 재검증, DNS rebinding 방지를 위한 고정 lookup, scheme/credentials/8 KiB URL 거부를 단위 테스트한다. DNS resolver와 HTTP transport를 주입해 공용 인터넷에 의존하지 않는다 (`src/lib/archive/url.test.ts`, `src/lib/archive/fetcher.test.ts`)
- [x] 로컬 fixture 서버로 HTML 성공, 상대/절대 redirect, redirect 6번째 거부, 전체 timeout, non-HTML, Content-Length 및 chunked/decompressed 5 MiB 초과, 연결 종료를 검증한다. 테스트 서버 주소는 운영 public-IP 정책을 우회하지 않고 명시적 테스트 resolver/transport seam으로만 허용한다 (`src/lib/archive/fetcher.test.ts`)
- [x] 임시 SQLite/파일 저장소에서 `pending → saved`, title/description/capture metadata와 정확한 original bytes, 실패 상태/안전 문구, 부분 파일 정리, 중복 미재캡처, 동시 제출 한도, 시간창 rate limit, 총 byte quota 및 프로세스 재시작 후 quota 지속을 통합 테스트한다 (`src/lib/archive/service.test.ts`)
- [x] Playwright가 외부 `example.com`에 의존하지 않도록 테스트 전용 fixture origin/DNS seam을 구성하고, 제출 후 saved 상세 정보와 실패 상세 문구, rate/quota 폼 거절을 사용자 흐름으로 검증한다 (`playwright.config.ts`, `e2e/archive-submission.spec.ts`)
- [x] 캡처 정책, 환경 변수 기본값, 동기 처리의 10초 상한, 저장 파일(`original.html`, `snapshot.json`), 인증 없는 공개 endpoint의 프로세스/SQLite rate·quota 경계를 문서화하고 Cloudflare rate limit은 선택적 추가 방어로 명시한다 (`README.md`)

## Integration

- [ ] Group 0 완료 후 UI와 테스트 worktree를 변경량 적은 순서로 머지하고 캡처 타입/상태 전이 계약에 맞춰 충돌을 정리한다
- [ ] `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm build` 실행
- [ ] `pnpm test:e2e`로 성공 캡처, 안전한 실패 표시, abuse 경계의 실제 Server Action 흐름 확인
- [ ] `graphify update .`로 지식 그래프 갱신
- [ ] 코드 리뷰: SSRF/DNS rebinding/redirect/압축 폭탄/파일 원자성/SQLite 경쟁 조건을 포함한 정확성·보안 1차, 과설계·중복 추상화 정리 2차

## Risks

- [DNS rebinding/redirect SSRF]: URL 문자열 검사에 의존하지 않고 매 hop의 모든 DNS 응답을 검사한 뒤 허용된 한 IP로 실제 socket lookup을 고정한다. redirect마다 scheme, credentials, DNS, IP pinning을 처음부터 반복한다.
- [압축 폭탄과 느린 응답]: Content-Length는 조기 거절 최적화로만 사용하고 실제 압축 해제 후 스트림 바이트를 5 MiB에서 중단한다. DNS·연결·redirect·body 전체에 하나의 10초 deadline을 적용한다.
- [DB/파일 이중 쓰기]: 파일 쌍을 임시 경로에 완성·동기화한 뒤 승격하고 마지막에 조건부 DB 상태 전이를 수행한다. `saved`만 완전한 스냅샷을 의미하며 실패 시 임시/부분 파일을 청소한다.
- [중복/동시 캡처]: SQLite의 normalized URL UNIQUE와 조건부 상태 전이를 기준 진실로 사용하고, 신규 행만 캡처한다. 프로세스 semaphore와 SQLite 예산 예약을 함께 사용해 단일 프로세스 폭주와 재시작/다중 연결 우회를 각각 막는다.
- [공개 endpoint abuse]: 인증은 범위 밖으로 유지하되 URL 8 KiB, 즉시 동시성 거절, SQLite rolling-window 제출 한도와 총 저장 byte quota를 기본 활성화한다. 클라이언트 IP 헤더 신뢰 문제를 피하기 위해 앱 내부 한도는 우선 전역 경계로 두고, 운영 프록시의 per-IP rate limit은 추가 계층으로 둔다.
- [동기 Server Action 지연]: 캡처를 action 안에서 완료한다는 Issue #2 계약을 유지하고 버튼 상태와 10초 deadline을 제공한다. 이후 비동기 worker 전환은 별도 이슈로 남긴다.
- [안전한 오류 노출]: DNS 주소, 내부 host, socket/TLS/파일/SQLite 메시지를 공개 모델에 저장하지 않고, 안정적인 실패 code를 허용 목록의 한국어 문구로 매핑한다.
