---
track: heavy
exec: worktree
files: 32
branch: feat-capture-csr-rendered-pages-with-self-contai
base: main
---

# Issue #8: CSR 렌더링 결과를 self-contained iframe HTML/CSS로 보존

## Delivery scope

- Browser capture는 보존 시점의 isolated Playwright Chromium에서만 JavaScript를 실행하고, `domcontentloaded`·bounded `networkidle`·`document.fonts` readiness를 전체 timeout 안에서 처리한다.
- 모든 HTTP(S) navigation/resource를 기존 public URL 정책으로 재검증하고, request/asset/page/rendered-output 상한, redirect·popup·child-frame·WebSocket·beacon·form·post-capture navigation 차단을 적용한다.
- hydration 이후 DOM과 검증된 CSS/image/font/attachment를 digest-keyed local asset으로 저장한다. inline style은 self-hosted CSS로 외부화하고 수집되지 않은 원격 fallback은 제거한다.
- `original.html`은 받은 원문 바이트를 그대로 보존하고, `readable.html`과 선택적 `rendered.html`을 같은 staging directory에서 atomic save한다. 기존 v1 manifest와 rendered 없는 legacy archive는 계속 읽는다.
- rendered route는 sandbox iframe과 `script/connect/form/remote frame/worker/manifest`가 차단된 restrictive CSP로 제공하며, rendered가 없는 archive는 readable/original로 fallback한다.
- production dependency로 직접 선언한 Playwright와 ARM64 Chromium/OS libraries를 standalone Docker image에 포함하고, final image Chromium launch smoke를 CI gate로 둔다.

## Implementation status

- [x] Domain/runtime contract: `CapturedPage`, `SnapshotContentKind`, CSS/font MIME, rendered limits, storage manifest/path contract.
- [x] Bounded browser capture and resource localizer: URL policy, response signatures, CSS `@import`/`url()`, inline style/style attributes, hydration DOM cleanup.
- [x] Persistence/service: `rendered.html`, CSS/font assets, atomic staging, cleanup, quota accounting for original/rendered/assets, injected test seams, legacy fallback.
- [x] Viewer/HTTP boundary: rendered tab/default, sandbox iframe, rendered CSP, CSS/font asset response policy.
- [x] Runtime/operations: Debian ARM64 Chromium image, standalone tracing, compose limits, README, final-image CI smoke.
- [x] Unit/integration/E2E coverage: CSR hydration, local CSS/font/background, source-offline viewing, no script/remote fallback, request budget and regressions.
- [x] Graphify refresh after the implementation.

## Verification checklist

- [x] Final `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build` after the last review patch.
- [x] `docker compose config --quiet`, ARM64 Docker build, production-image readiness and Chromium launch smoke after the last source change.
- [x] Review-gate security pass: SSRF/DNS revalidation, browser escape, XSS/CSP/sandbox, MIME/signature, path traversal and quota cleanup.
- [ ] Release `main` through CI publish/deploy and verify the production readiness/public URL and Tunnel origin.
- [ ] Comment on and close GitHub issue #8 after release evidence.

## Decisions and exclusions

- No auth cookies, storage state, auth headers, viewer JavaScript, recursive cross-origin iframe capture, video/streaming preservation, or Shadow DOM viewer.
- Browser Chromium DNS is revalidated through the public URL resolver for every request; production does not yet provide an IP-pinned browser proxy. This remains an explicit review note in ADR-0001.
- `Snapshot.byteLength` retains its existing meaning of original HTML bytes. The generic SQLite byte ledger keeps its existing derived-readable behavior while adding rendered HTML and localized asset bytes to the actual/reserved capture budget.
