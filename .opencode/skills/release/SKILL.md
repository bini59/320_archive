---
name: release
description: Release 320_archive to its Docker production environment. Use when the user wants to ship, deploy, cut a release, or says "릴리즈 하자".
---

# Release: 320_archive

## Production (`main`)

- `main` is the production branch.
- Push the verified release commit to `origin/main`.
- GitHub Actions validates the ARM64 build, publishes an immutable `sha-<full-sha>` image to GHCR, and deploys it through the dedicated `archive-prod` self-hosted runner.
- Wait for the CI, publish, and deploy jobs to succeed. Production deployments are serialized and automatically back up the data volume, verify readiness, and roll back on failure.
- Cloudflare Tunnel runs outside this repository. Confirm its Public Hostname origin remains `http://archive-320:3000`, then verify the public URL manually.

## Hotfix

- Create `hotfix/<short-description>` from `main`.
- Make and verify the smallest safe fix, then open a pull request to `main`.
- After merge, wait for the same automated deployment and Tunnel-routing verification as production.

## Versioning

- No versioning or tagging convention exists yet. Agree one with the project owner before using version bumps or tags.
