# 320 Archive

개인용 웹 콘텐츠 아카이빙 서비스입니다. 사라질 수 있는 게시물과 페이지를 보존하고 열람하는 것을 목표로 합니다.

## Stack

- Next.js 16, React 19, TypeScript 7
- Tailwind CSS v4, daisyUI v5
- SQLite (Node.js built-in `node:sqlite`)
- pnpm

TypeScript 7.0.2를 사용합니다. 현재 `typescript-eslint`는 TS 7 Compiler API를 아직 지원하지 않아, `pnpm lint`는 TS 파서 기반 규칙을 실행하지 않습니다. `pnpm typecheck`와 `pnpm build`가 타입 검증을 담당합니다.

## Development

Node.js의 내장 `node:sqlite`를 지원하는 Node.js 22.5 이상이 필요합니다.

의존성을 설치하고 개발 서버를 실행합니다.

```bash
pnpm install
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

검증 명령:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

`pnpm test`는 Node 환경에서 단위·통합 테스트를 실행합니다. `pnpm test:e2e`를 처음 실행하기 전에는 `pnpm exec playwright install chromium`으로 브라우저를 설치해야 합니다. E2E 서버는 실행마다 운영 데이터와 분리된 임시 SQLite 및 아카이브 경로를 사용합니다.

## Storage configuration

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `ARCHIVE_DATABASE_PATH` | `data/archive.db` | SQLite 데이터베이스 파일 경로 |
| `ARCHIVE_STORAGE_ROOT` | `data/archives` | UUID별 `metadata.json`을 저장할 디렉터리 |

상대 경로는 애플리케이션 실행 디렉터리를 기준으로 해석됩니다. 두 경로의 상위 디렉터리는 시작 시 자동 생성되며, 기본 `data/` 디렉터리와 데이터베이스 파일은 Git에서 제외됩니다.

## Deployment

기존 Docker 환경으로 배포합니다. Cloudflare Tunnel과 도메인 ingress 라우팅은 이 저장소 외부에서 운영자가 구성합니다.
