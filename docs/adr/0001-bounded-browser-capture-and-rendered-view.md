# ADR 0001: Bounded browser capture and self-contained rendered view

- Status: Accepted
- Date: 2026-08-06
- Scope: issue #8

## Decision

At archive creation time, run Playwright Chromium in a fresh, unauthenticated
context with one overall deadline and bounded request, response-byte, asset, and
rendered-document limits. The capture stores the received response as
`original.html` and may additionally store the post-hydration DOM as
`rendered.html`.

The viewer never executes captured JavaScript. The rendered result is served in a
sandboxed iframe with restrictive CSP and references only digest-keyed assets in
the same archive. CSS, inline styles, `@import`, `url(...)`, fonts, images, and
supported attachments are localized during capture; missing or rejected remote
references are removed rather than retained as fallbacks.

Inline styles are externalized into generated CSS assets so the rendered route can
keep `style-src 'self'`. The existing readable representation continues to use its
strict sanitizer and local asset rewriting. Existing archives without
`rendered.html` fall back to the readable/original views, and the v1 asset manifest
remains readable without a database migration.

## Consequences

- CSR pages can be preserved after hydration while the public viewer remains a
  non-executing document boundary.
- Chromium and its ARM64-compatible system libraries are production runtime
  dependencies, so image build and launch smoke tests are required.
- Browser DNS is revalidated for every HTTP(S) request, but browser capture is not
  an authenticated fetch path and does not claim to preserve login-only pages.
- Recursive cross-origin iframes, video/streaming, Shadow DOM traversal, viewer
  JavaScript, and authentication state are explicitly out of scope.
