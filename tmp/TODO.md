---
track: heavy
exec: worktree
files: 18
groups: 3
dependencies: group-0 → group-1, group-0 → group-2
branch: feature/issue-4-local-assets
base: main
---

# Issue #4: 이미지·지원 첨부파일 로컬 보존

## Overview

캡처한 HTML의 이미지와 보수적으로 허용한 첨부파일(PDF, plain text)을 발견해 기존 SafeCapture와 동일한 DNS·리디렉션·IP pinning 보안 경계 안에서 다운로드하고 Archive 디렉터리에 함께 보존한다. 성공한 자원만 same-origin asset Route Handler URL로 원문·읽기본을 다시 쓰고, 실패한 자원은 원래 참조를 제거해 외부 요청을 발생시키지 않으면서 Archive 자체는 정상 저장한다.

자원별 10 MiB, Archive별 총 50 MiB·20개, 자원별 10초 제한을 기본 계약으로 한다. 목록은 중복 URL을 제거하고 문서 순서로 제한하며, 허용 MIME은 `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif`, `application/pdf`, `text/plain`으로 제한한다. 파일명은 원격 경로를 신뢰하지 않고 콘텐츠 digest(또는 충분한 난수)+서버가 결정한 확장자를 쓰며, manifest에 원본 URL·최종 URL·MIME·byte length·저장 key를 기록한다.

## Group 0: 선행 (자원 캡처·저장 계약)
> 병렬 작업 전 반드시 먼저 완료

- [ ] `Asset`, `AssetManifest`, `CapturedAsset`, `AssetFetcher`, `SnapshotStore.readAsset` 계약을 추가하고, 외부 입력이 파일 경로나 Response 헤더를 직접 결정하지 못하게 저장 key·MIME을 타입으로 구분한다 (`src/lib/archive/types.ts`)
- [ ] HTML fetch와 binary fetch가 `resolvePublicUrl`·redirect 재검증·DNS IP pinning·abort·decompression size accounting을 공유하도록 transport를 일반화하되, HTML MIME 계약은 기존 동작을 유지한다 (`src/lib/archive/fetcher.ts`, `src/lib/archive/fetcher.test.ts`)
- [ ] binary asset fetcher에 MIME allow-list, `Content-Type`·실제 body 모두의 10 MiB 상한, 10초 전체 deadline, redirect 횟수, 압축 해제 후 크기 계수를 적용하고 private/special IP, MIME spoof, oversized/chunked/decompressed body, timeout, unsafe redirect를 거부한다 (`src/lib/archive/asset-fetcher.ts`, `src/lib/archive/asset-fetcher.test.ts`)
- [ ] HTML에서 `img[src]`, `img[srcset]`, 및 `a[href]`의 PDF/plain-text 후보를 최종 page URL 기준으로 해석하고, `http(s)`만 선택·URL 정규화/중복 제거·문서 순서·20개 상한을 적용한다. `data:`, `blob:`, `file:`, credentials, malformed URL은 후보에서 제외한다 (`src/lib/archive/assets.ts`, `src/lib/archive/assets.test.ts`)
- [ ] 성공한 asset을 digest 기반 안전한 key와 고정 확장자로 `assets/`에 저장하고 manifest·원문·읽기본을 하나의 stage 디렉터리에 fsync한 뒤 원자적으로 승격한다. 자원 조회는 UUID+manifest에 등록된 key+`O_NOFOLLOW`·regular-file·canonical-root 검증을 모두 통과해야 한다 (`src/lib/archive/storage.ts`, `src/lib/archive/storage.test.ts`)
- [ ] 환경 변수로 자원별/총 byte, 개수, timeout을 조절할 수 있게 하되 안전한 10 MiB/50 MiB/20개/10초 기본값과 양의 정수 검증을 제공한다 (`src/lib/archive/config.ts`)

## Group 1: 캡처 오케스트레이션·서빙 (parallel)
> worktree: `tmp/worktrees/feature-issue-4-local-assets-group-1`

- [ ] 페이지 캡처 후 asset을 독립적으로 수집하되 20개/50 MiB 예산을 초과하면 남은 후보를 건너뛰고, 개별 DNS·network·timeout·MIME·size 실패는 nonfatal 결과로 기록한다. 저장 승격/전체 quota commit 실패만 Archive 트랜잭션 실패로 다룬다 (`src/lib/archive/service.ts`, `src/lib/archive/service.test.ts`)
- [ ] 원문 HTML은 성공한 image/attachment 참조만 `/archives/{id}/assets/{key}`로 치환하고, `srcset`은 성공 항목만 재구성한다. 실패·미지원 remote image/srcset은 제거하고 attachment link는 비활성화해 열람 시 소스 host로의 네트워크 폴백을 금지한다 (`src/lib/archive/assets.ts`, `src/lib/archive/assets.test.ts`)
- [ ] 읽기본 sanitizer에 `img`/`src`/`alt`/`width`/`height`와 보존된 attachment `a[href]`만 허용하고, same-origin asset path 패턴 외 URL·event/style·관련 우회를 모두 제거한다 (`src/lib/archive/readable.ts`, `src/lib/archive/readable.test.ts`)
- [ ] Next.js 16 `params: Promise<...>` 규약의 asset Route Handler를 추가하고, DB의 saved 상태와 manifest membership을 매 요청 재검증한 뒤 저장 MIME·정확한 length로 바이트를 반환한다. 이미지는 `inline`, PDF/plain text는 `attachment`+RFC 5987에 의존하지 않는 서버 파일명, 공통으로 `nosniff`·private/no-store와 안전한 not-found를 적용한다 (`src/app/archives/[id]/assets/[key]/route.ts`, `src/app/archives/[id]/assets/[key]/route.test.ts`)
- [ ] sandboxed 원문의 CSP는 기존 차단을 유지하면서 `img-src 'self'`만 추가하고, script/style/connect/media/font/frame/object/form/base와 외부 origin은 계속 차단한다. 보존 첨부파일은 iframe 네비게이션에 의존하지 않고 다운로드 Response로만 제공한다 (`src/app/archives/[id]/original/route.ts`, `src/app/archives/[id]/original/route.test.ts`)

## Group 2: 통합·E2E 회귀 (parallel)
> worktree: `tmp/worktrees/feature-issue-4-local-assets-group-2`

- [ ] fixture에 정상 이미지, PDF/plain text, 중복·상대·redirect URL, unsupported MIME, spoofed MIME, oversized/chunked, timeout, private-IP redirect, missing asset을 결정적으로 제공하고 예상하지 않은 외부 요청을 기록한다 (`e2e/fixture-server.mjs`)
- [ ] 소스 host를 중단한 후에도 읽기본·원문의 이미지가 same-origin에서 보이고 PDF/plain text가 안전한 헤더로 다운로드되며, 거부/실패 asset이 Archive 저장·열람을 막지 않고 browser의 remote fallback 요청을 발생시키지 않음을 Playwright로 검증한다 (`e2e/archive-submission.spec.ts`)

## Integration

- [ ] Group 0 완료 후 Group 1·2 worktree를 `tmp/`에 생성하고, 변경량이 적은 순서로 머지하며 자원 contract·fixture 충돌을 통합한다
- [ ] `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm build` 실행
- [ ] `pnpm test:e2e`로 local asset 보존, attachment 다운로드, source 오프라인 열람, remote fallback 차단, nonfatal 실패를 검증
- [ ] `graphify update .`로 지식 그래프 갱신
- [ ] 코드 리뷰: SSRF/DNS rebinding·redirect IP pinning·decompression bomb·MIME confusion·path traversal/symlink·quota accounting·HTML URL rewrite·CSP·nonfatal 일관성을 확인하는 정확성/보안 1차, transport/rewrite/manifest 중복과 불필요한 추상화를 줄이는 2차

## Risks

- [SSRF·DNS rebinding]: 최초 URL과 매 redirect를 `resolvePublicUrl`로 재검증하고, 검증된 public IP를 socket lookup에 pinning한 기존 SafeCapture transport를 HTML/binary가 공유한다.
- [저장 고갈·압축 폭탄]: `Content-Length`만 신뢰하지 않고 압축 해제 후 스트림을 자원별 10 MiB, Archive별 50 MiB·20개로 즉시 중단한다. 실제 asset byte를 기존 영구 SQLite quota commit에 포함한다.
- [MIME confusion·active content]: URL 확장자가 아닌 Response MIME allow-list로 선택하고 `nosniff`를 고정한다. SVG, HTML, XML, JavaScript, CSS, font, audio/video, archive/executable은 범위에서 제외한다.
- [HTML 외부 요청 폴백]: 성공 asset만 same-origin으로 rewrite하고 실패/unsupported remote `src`, `srcset`, attachment `href`를 제거한다. 원문 CSP는 `img-src 'self'`만 열고 나머지 자원 종류는 차단한다.
- [파일 경로·헤더 주입]: 원격 파일명은 파일시스템/헤더에 사용하지 않고, digest 기반 key·서버 결정 MIME/확장자·manifest membership·`O_NOFOLLOW`로 경계를 고정한다.
- [부분 실패·일관성]: asset 개별 실패는 manifest에 저장할 파일에서 제외하고 원문/읽기본의 해당 외부 참조도 제거한다. stage 승격 전 실패는 전체 cleanup, 승격 후 DB commit 실패도 저장 디렉터리 cleanup으로 기존 트랜잭션 계약을 유지한다.
- [후방 호환]: manifest/assets가 없는 기존 Archive는 기존 원문·읽기 열람을 그대로 유지하고, 열람 시점 lazy download/migration은 외부 통신·보존 데이터 변경을 유발하므로 범위에서 제외한다.
