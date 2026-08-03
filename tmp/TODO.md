---
track: heavy
exec: worktree
files: 13
groups: 3
dependencies: group-0 → group-1, group-0 → group-2
branch: feature/issue-3-readable-archives
base: main
---

# Issue #3: 캡처 아카이브 안전한 읽기

## Overview

저장 완료된 Archive 상세에 캡처 시점에 생성·저장한 정제 HTML 읽기 본문과 출처(원본 URL, 캡처 시각, 상태)를 표시한다. 원본 HTML은 소스 사이트로 이동하지 않고 same-origin 전용 Route Handler에서 제공하되, 읽기 화면과 원본 화면 모두 외부 네트워크·스크립트·폼·상위 탐색을 차단하는 것을 보안 계약으로 한다.

원본 바이트는 보존용 `original.html`, 읽기본은 위험 태그/속성을 제거하고 문서 내 링크·미디어를 비활성화한 `readable.html`로 캡처 트랜잭션 안에서 함께 저장한다. 예전 스냅샷에 `readable.html`이 없는 경우는 성공 화면에서 원문만 제공하고 내부 경로나 파일 오류를 노출하지 않는 후방 호환 계약을 적용한다. Next.js 16의 `params: Promise<...>`, 동적 렌더링, Route Handler Response 헤더 규약을 따른다.

## Group 0: 선행 (정제/저장 계약)
> 병렬 작업 전 반드시 먼저 완료

- [x] 스냅샷 저장소에 보존 원문과 정제 읽기본을 저장·조회하는 명시적 API를 추가하고, 조회 결과는 임의 파일 경로가 아닌 허용된 `original | readable` 종류로만 표현한다 (`src/lib/archive/types.ts`)
- [x] HTML을 문서로 파싱해 `script`, `style`, `iframe`, `object`, `embed`, `form`, `input`, `button`, `meta`, `base`, `link`, `svg`, 이벤트 핸들러, `style`, `src/srcset/href/action` 등 능동·외부 리소스 표면을 allow-list로 제거하고, 본문 중심의 자체 완결형 HTML을 생성한다. malformed HTML, entity, 빈 본문, 우회성 URL/속성 사례를 안전하게 처리한다 (`src/lib/archive/readable.ts`, `src/lib/archive/readable.test.ts`, `package.json`, `pnpm-lock.yaml`)
- [x] `LocalSnapshotStore.save` entrypoint이 `original.html`, `readable.html`, `snapshot.json` 세 파일을 stage 디렉터리에 fsync한 뒤 한 번에 승격하게 하고, UUID 검증·정규화된 root 내부 경로·일반 파일 확인을 거친 읽기 API를 구현한다. 기존 저장분의 `readable.html` 부재는 typed not-found로 구분한다 (`src/lib/archive/storage.ts`, `src/lib/archive/storage.test.ts`)
- [x] 캡처 원문에서 metadata와 정제 읽기본을 한 번만 생성해 원자적으로 저장한 후에만 Archive를 `saved`로 전환하고, 정제/저장 실패는 허용 목록의 안전한 `failed` 사유로 귀결시킨다. 상세/Route Handler가 사용할 Archive+content 조회 진입점을 추가한다 (`src/lib/archive/service.ts`, `src/lib/archive/service.test.ts`)

## Group 1: 읽기/원문 UI (parallel)
> worktree: `tmp/worktrees/feature-issue-3-readable-archives-group-1`

- [ ] saved 상세를 출처 헤더와 `읽기 | 원문` 탭으로 구성하고, 기본 읽기 탭에 정제 HTML을 가독성 있는 typography/container로 렌더링한다. 원본 URL은 provenance 문자열로 유지하되 캡처 열람 흐름에서 소스 탐색을 유발하는 클릭 링크로 두지 않는다 (`src/app/archives/[id]/page.tsx`, `src/app/archives/[id]/archive-viewer.tsx`)
- [ ] 원문 탭은 전용 same-origin content endpoint를 `sandbox` 속성에 allow token이 없는 iframe으로 표시하며, 정제 HTML을 React tree에 주입하는 경우에도 캡처 시 sanitizer 계약을 반드시 전제한 신뢰 경계를 코드에 명시한다. 키보드 탭 전환·선택 상태·iframe 제목을 제공한다 (`src/app/archives/[id]/archive-viewer.tsx`)
- [ ] 상세 ID와 `saved`+스냅샷 상태를 서버에서 다시 검증한 후에만 저장 content를 반환하는 Route Handler를 추가한다. 원문 Response에 `Content-Type: text/html`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control`, `Content-Security-Policy: default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox` 및 파일과 함께 저장되지 않은 고정 CSP 방어를 적용하고, pending/failed/missing/invalid ID는 content를 노출하지 않는다 (`src/app/archives/[id]/original/route.ts`)
- [ ] failed 상세는 탭/iframe/본문을 렌더링하지 않고 저장된 allow-list 실패 문구와 출처·상태만 표시하며, pending과 예전 saved 스냅샷은 파일 부재 시 깨진 UI 대신 안전한 fallback을 표시한다 (`src/app/archives/[id]/page.tsx`)

## Group 2: 자동화/보안 회귀 (parallel)
> worktree: `tmp/worktrees/feature-issue-3-readable-archives-group-2`

- [x] fixture HTML에 본문 구조와 script, event handler, javascript/data URL, base/form/iframe, 외부 image/style 공격 표면을 포함해 정제기와 원문 격리를 결정적으로 검증한다 (`e2e/fixture-server.mjs`)
- [x] saved 상세의 기본 읽기본·provenance·캡처 시각·상태, 탭 전환 후 sandboxed 원문 iframe, 원문의 script/탐색/폼/외부 요청 미실행, failed 상세의 안전한 오류만 표시를 Playwright로 검증한다 (`e2e/archive-submission.spec.ts`)
- [x] Route Handler의 saved 전용 인가, invalid/missing/failed 응답, CSP·nosniff·cache 헤더, 경로 탐색 불가를 통합 테스트하고, 읽기본의 스크립트·외부 URL·폼 제거를 단위 테스트에서 이중 검증한다 (`src/app/archives/[id]/original/route.test.ts`, `src/lib/archive/readable.test.ts`)

## Integration

- [ ] Group 0 완료 후 UI와 테스트 worktree를 변경량이 적은 순서로 머지하고 SnapshotStore/content API 계약에 맞춰 충돌을 정리한다
- [ ] `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm build` 실행
- [ ] `pnpm test:e2e`로 saved 읽기/원문 전환, XSS/네트워크/탐색 격리, failed 상태를 검증
- [ ] `graphify update .`로 지식 그래프 갱신
- [ ] 코드 리뷰: sanitizer allow-list·저장 원자성·경로 탐색·XSS/CSP/sandbox·상태별 content 노출을 확인하는 정확성/보안 1차, 중복·불필요한 추상화를 줄이는 2차

## Risks

- [캡처 HTML XSS]: 렌더링 시점의 블랙리스트에 의존하지 않고 캡처 시 파서 기반 태그/속성 allow-list로 `readable.html`을 고정한다. 원문은 별도 endpoint+CSP+토큰 없는 iframe sandbox로 다중 격리한다.
- [소스 사이트 통신/탐색]: sanitizer가 모든 활성 URL 속성과 form/base를 제거하고, content endpoint CSP는 script/style/img/media/connect/form/navigation을 `default-src 'none'`과 sandbox로 차단한다. 상세의 원본 URL은 자동 탐색 링크로 제공하지 않는다.
- [저장 계약 변경]: 원문·읽기본·metadata를 모두 stage에 완성한 뒤 디렉터리를 승격하고 마지막에 DB를 saved로 전환한다. 중간 실패는 전체 cleanup과 failed 상태로 귀결시킨다.
- [기존 저장분 호환성]: `readable.html`이 없는 기존 saved Archive는 provenance와 원문 탭을 유지하고 읽기본 부재를 안내한다. 요청 시 원문을 재정제해 쓰는 lazy migration은 보존 데이터 변경·동시성을 유발하므로 범위에서 제외한다.
- [원문 endpoint 노출]: UUID 형식만으로 신뢰하지 않고 DB의 saved 상태와 snapshot 존재를 다시 확인한다. 경로는 root+UUID+고정 파일명으로만 구성하고 심볼릭 등 일반 파일이 아닌 대상은 거부한다.
- [파서/sanitizer 선택]: 직접 정규식 파싱은 malformed HTML 우회에 취약하므로 서버 환경의 검증된 HTML parser/sanitizer를 최소 의존성으로 도입하고 악성 fixture 회귀 테스트로 업그레이드를 통제한다.
