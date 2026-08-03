# 320 Archive

개인용 웹 콘텐츠 아카이빙 서비스입니다. 사라질 수 있는 게시물과 페이지를 보존하고 열람하는 것을 목표로 합니다.

## Stack

- Next.js 16, React 19, TypeScript 7
- Tailwind CSS v4, daisyUI v5
- SQLite (Node.js built-in `node:sqlite`)
- pnpm

TypeScript 7.0.2를 사용합니다. 현재 `typescript-eslint`는 TS 7 Compiler API를 아직 지원하지 않아, `pnpm lint`는 TS 파서 기반 규칙을 실행하지 않습니다. `pnpm typecheck`와 `pnpm build`가 타입 검증을 담당합니다.

## Development

```bash
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

검증 명령:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Deployment

기존 Docker 환경으로 배포합니다. Cloudflare Tunnel과 도메인 ingress 라우팅은 이 저장소 외부에서 운영자가 구성합니다.
