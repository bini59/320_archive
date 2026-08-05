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

공개 등록 경로에는 애플리케이션의 프로세스별 동시 캡처 제한과 SQLite 기반 전역 rolling-window 제출 한도·전체 저장 byte quota를 기본 적용합니다. 이 경계는 여러 앱 프로세스의 모든 요청을 합산하는 기본 안전장치이며 사용자별 한도는 아닙니다. 운영 환경에서는 Cloudflare rate limiting을 IP별 추가 방어로 적용할 수 있지만, 애플리케이션 내부 제한을 대체하지는 않습니다.

## Authentication

공개 아카이브 열람(`/archives`)은 인증 없이 사용할 수 있지만, 새 아카이브 등록은 `321_auth`의 공유 `sid` 세션과 `/verify` 서버 간 검증을 통과해야 합니다. 미인증 사용자는 중앙 로그인으로 이동하고, auth 장애는 등록을 허용하지 않고 `503`으로 처리합니다. `APP_SECRET`은 브라우저에 전달되지 않습니다.

서비스 연동 전에 `321_auth` 운영 DB에 `archive` client를 등록하고, 앱 실행 환경에 다음 변수를 주입합니다.

```bash
AUTH_ORIGIN=https://auth.bini59.dev
CLIENT_ID=archive
APP_SECRET=<archive client 전용 secret>
```

두 저장소가 같은 호스트에 있고 `321_auth` auth-app 컨테이너가 실행 중이면 다음 명령이 강한 키 생성, 로컬 `.env`와 production runner env 저장, auth DB client 등록을 한 번에 처리합니다. 기존 `.env`의 `APP_SECRET`이 있으면 재사용합니다.

```bash
pnpm setup:auth
```

기본 등록 origin은 `https://archive.bini59.dev`이며, 다른 환경에서는 `ARCHIVE_ORIGIN`, `AUTH_ROOT`, `AUTH_COMPOSE_FILE`, `PRODUCTION_ENV_FILE`로 변경할 수 있습니다. CI production 배포는 `/home/ubuntu/actions-runner-320/.env`를 Compose env 파일로 사용합니다. 로컬 E2E 테스트만 `ARCHIVE_E2E=1`로 인증을 격리해 우회합니다.

## Deployment

프로덕션 이미지는 Next.js standalone 서버를 비-root 사용자(UID/GID `1001`)로 실행합니다. SQLite 데이터베이스와 저장 파일은 named volume의 `/data` 아래에 함께 보관됩니다.

```bash
docker compose build
docker compose up -d
docker compose ps
```

서비스는 호스트 포트를 공개하지 않고 기존 external Docker network `api-net`에
`archive-320` alias로 연결됩니다. 네트워크는 배포 전에 운영자가 한 번 생성해야 합니다.

```bash
docker network create api-net
```

기존 cloudflared 컨테이너도 `api-net`에 연결하고, Cloudflare Public Hostname의 origin을
`http://archive-320:3000`으로 지정합니다. 이 저장소는 cloudflared token, ingress 또는
컨테이너 구성을 생성하거나 변경하지 않습니다. 로그와 상태는 다음처럼 확인합니다.

```bash
docker compose logs -f app
docker compose down
```

`docker compose down`은 컨테이너와 네트워크만 제거하며 `320_archive_data` named volume은 유지합니다. 데이터를 지우는 `docker compose down --volumes`는 백업을 확인한 뒤에만 사용해야 합니다. 호스트상의 실제 volume 위치가 필요하면 다음 명령으로 확인합니다.

```bash
docker volume inspect 320_archive_data
```

이미지는 기본적으로 다음 경로를 사용합니다. compose 환경 변수나 별도 실행 환경에서도 두 경로를 동일한 영속 volume 안에 두어야 합니다.

| 환경 변수 | 컨테이너 값 |
| --- | --- |
| `ARCHIVE_DATABASE_PATH` | `/data/archive.db` |
| `ARCHIVE_STORAGE_ROOT` | `/data/archives` |

### Backup

SQLite는 WAL 파일을 사용할 수 있고 DB와 아카이브 파일이 함께 일관된 시점에 보존되어야 합니다. 실행 중인 DB 파일만 복사하지 말고, 앱을 중지한 뒤 `/data` volume 전체를 하나의 tar 파일로 백업합니다.

```bash
mkdir -p backups
docker compose stop app
docker run --rm \
  -v 320_archive_data:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine:3.22 tar -C /data -czf /backup/320-archive-data.tar.gz .
docker compose start app
```

백업 파일이 생성됐는지 확인합니다.

```bash
tar -tzf backups/320-archive-data.tar.gz | head
docker compose ps
```

### Restore

복구 대상 앱을 중지하고 **비어 있는 새 volume**에 전체 백업을 풉니다. 아래 명령은 기존 운영 volume을 덮어쓰지 않으므로 복구 내용을 먼저 검증할 수 있습니다.

```bash
docker compose stop app
docker volume create 320_archive_restore
docker run --rm \
  -v 320_archive_restore:/data \
  -v "$PWD/backups:/backup:ro" \
  alpine:3.22 sh -c 'test -z "$(ls -A /data)" && tar -C /data -xzf /backup/320-archive-data.tar.gz && chown -R 1001:1001 /data'
docker run --rm -v 320_archive_restore:/data:ro alpine:3.22 ls -la /data
```

검증 후 `compose.yaml`의 volume 이름을 일시적으로 `320_archive_restore`로 바꾸거나, 동일 구성을 가리키는 compose override를 사용하여 앱을 시작합니다. `docker compose up -d` 후 health 상태, 아카이브 목록과 상세 페이지를 확인합니다. 복구 이미지/애플리케이션 버전은 백업을 만든 버전과 같거나 해당 데이터베이스 migration과 호환되는 버전을 사용하세요. 운영 volume을 교체하기 전 원본 volume도 별도로 보존하는 것을 권장합니다.

Cloudflare Tunnel 컨테이너, 공개 도메인의 ingress, TLS 및 엣지 rate limit은 기존 운영 환경의 책임입니다. 이 저장소의 compose 파일은 Tunnel을 만들거나 설정하지 않습니다.

### Automated CI/CD

PR과 `main` push는 GitHub-hosted ARM64 runner에서 lint, typecheck, 단위·통합 테스트,
Playwright E2E, production build와 Docker build를 실행합니다. 성공한 `main` commit은
`ghcr.io/bini59/320_archive:sha-<full-commit-sha>` immutable tag와 편의용 `latest` tag로
게시됩니다. 배포에는 SHA tag만 사용합니다.

운영 ARM64 호스트에는 이 저장소 전용 GitHub Actions runner를 등록하고
`self-hosted`, `Linux`, `ARM64`, `archive-prod` label을 부여합니다. runner 사용자가 Docker
daemon, 저장소 checkout 및 `backups/`에 접근할 수 있어야 하며 다른 저장소에는 이 runner를
공유하지 않는 것을 권장합니다. production environment 보호 규칙과 승인자는 GitHub에서
별도로 설정할 수 있습니다.

CD는 production concurrency group으로 직렬 실행합니다. `scripts/deploy.sh`는 현재 이미지
tag를 기록하고 앱을 중지한 뒤 `320_archive_data` 전체를
`backups/320-archive-data-<UTC timestamp>.tar.gz`로 백업합니다. 이후 지정된 SHA 이미지를
기동해 Docker healthcheck가 healthy가 될 때까지 기다리고, pull/start/readiness 실패 시 이전
이미지로 되돌립니다. 백업 실패 시에도 기존 앱을 다시 시작합니다. runner에서 수동 검증할 때는:
기본적으로 최신 백업 10개를 보존하며 `BACKUP_RETENTION_COUNT`로 개수를 조정할 수 있습니다.

```bash
scripts/deploy.sh ghcr.io/bini59/320_archive:sha-<40-character-commit-sha>
docker compose ps
docker run --rm --network api-net curlimages/curl:8.14.1 -fsS http://archive-320:3000/health/ready
```

배포 전 `api-net`과 기존 cloudflared 연결을 확인하고, 배포 후 위 내부 readiness와 실제 Public
Hostname을 모두 확인합니다. 실패한 run에는 rollback 결과가 stderr와 Actions log에 남습니다.
