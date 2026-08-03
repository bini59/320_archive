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

`pnpm test`는 Node 환경에서 단위·통합 테스트를 실행합니다. `pnpm test:e2e`를 처음 실행하기 전에는 `pnpm exec playwright install chromium`으로 브라우저를 설치해야 합니다. E2E 서버는 실행마다 운영 데이터와 분리된 임시 SQLite 및 아카이브 경로를 사용하며, 외부 인터넷 대신 테스트 전용 HTML fixture를 캡처합니다.

## Storage configuration

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `ARCHIVE_DATABASE_PATH` | `data/archive.db` | SQLite 데이터베이스 파일 경로 |
| `ARCHIVE_STORAGE_ROOT` | `data/archives` | UUID별 `original.html`, `snapshot.json`을 저장할 디렉터리 |
| `ARCHIVE_CAPTURE_TIMEOUT_MS` | `10000` | DNS, 연결, 리디렉션, 본문을 포함한 전체 동기 캡처 제한 시간(ms) |
| `ARCHIVE_CAPTURE_MAX_BYTES` | `5242880` | 압축 해제한 HTML 본문의 최대 바이트 수(5 MiB) |
| `ARCHIVE_CAPTURE_MAX_REDIRECTS` | `5` | 허용할 최대 리디렉션 횟수 |
| `ARCHIVE_CAPTURE_CONCURRENCY` | `4` | 프로세스별 동시 캡처 수; 초과 요청은 대기시키지 않고 거절 |
| `ARCHIVE_RATE_WINDOW_MS` | `60000` | SQLite 전역 제출 횟수 제한의 시간창(ms) |
| `ARCHIVE_RATE_MAX_SUBMISSIONS` | `30` | 시간창 안에 허용하는 전역 제출 수 |
| `ARCHIVE_STORAGE_MAX_BYTES` | `1073741824` | SQLite가 추적하는 전체 원문 저장 용량 한도(1 GiB) |

상대 경로는 애플리케이션 실행 디렉터리를 기준으로 해석됩니다. 두 경로의 상위 디렉터리는 시작 시 자동 생성되며, 기본 `data/` 디렉터리와 데이터베이스 파일은 Git에서 제외됩니다.

## Capture and abuse policy

제출 요청은 최대 10초 동안 같은 Server Action 안에서 동기 처리됩니다. HTTP(S) URL만 허용하며 credentials와 8 KiB 초과 URL을 거절합니다. 각 요청과 리디렉션 hop마다 DNS A/AAAA 결과 전체가 global-unicast인지 검사한 뒤, 검증한 IP로 실제 연결을 고정해 DNS rebinding과 내부망 접근을 막습니다. 응답은 `text/html` 또는 XHTML이어야 하며 Content-Length와 실제 압축 해제 스트림 모두에 5 MiB 제한을 적용합니다.

성공한 아카이브는 `<archive-root>/<uuid>/original.html`에 받은 원문 바이트를, `snapshot.json`에 제목·설명·최종 URL·캡처 시각·바이트 수를 저장합니다. 두 파일을 동기화하고 승격한 뒤에만 SQLite 상태를 `saved`로 바꿉니다. 실패한 아카이브에는 네트워크 주소나 내부 예외 대신 허용 목록의 안전한 사유만 공개합니다.

인증 없는 공개 endpoint이므로 애플리케이션은 프로세스별 동시 캡처 제한과 SQLite 기반 전역 rolling-window 제출 한도·전체 저장 byte quota를 기본 적용합니다. 이 경계는 여러 앱 프로세스의 모든 요청을 합산하는 기본 안전장치이며 사용자별 한도는 아닙니다. 운영 환경에서는 Cloudflare rate limiting을 IP별 추가 방어로 적용할 수 있지만, 애플리케이션 내부 제한을 대체하지는 않습니다.

## Deployment

기존 Docker 환경으로 배포합니다. Cloudflare Tunnel과 도메인 ingress 라우팅은 이 저장소 외부에서 운영자가 구성합니다.
