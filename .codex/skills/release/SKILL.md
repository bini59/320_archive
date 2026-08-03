---
name: release
description: Release 320_archive to its Docker environment. Use when the user wants to ship, deploy, cut a release, or says "릴리즈 하자".
---

# Release: 320_archive

## Production (`main`)

- `main` is the production branch.
- Push the verified release commit to `origin/main`.
- No CI/CD workflow is configured yet. Deploy through the existing Docker environment using the procedure introduced with the deployment configuration.
- Cloudflare Tunnel runs outside this repository. After deployment, the operator must add or confirm the ingress route to the application service and verify the public URL manually.

## Hotfix

- Create `hotfix/<short-description>` from `main`.
- Make and verify the smallest safe fix, then open a pull request to `main`.
- After merge, follow the same Docker deployment and Tunnel-routing verification as production.

## Versioning

- No versioning or tagging convention exists yet. Agree one with the project owner before using version bumps or tags.
