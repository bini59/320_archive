# 320_archive

개인용 웹 아카이브 서비스다. 외부 게시물이 사라지는 상황에 대비해, 보존할 콘텐츠를 저장하고 열람한다.

## Development flow

- 작업은 `dev-flow`로 시작한다.
- 계획은 `planner`, 구현은 `dev-workflow`, 최종 검토는 `review-gate`, 릴리즈 절차는 `release`를 사용한다.
- Codex 기준으로 작업한다. Claude 전용 구성은 추가하지 않는다.

## graphify

이 프로젝트에는 `graphify-out/` 지식 그래프가 있다.

- 코드베이스 질문은 `graphify-out/graph.json`이 있으면 먼저 `graphify query "<question>"`으로 조사한다.
- 관계 추적에는 `graphify path "<A>" "<B>"`, 개념 확인에는 `graphify explain "<concept>"`를 사용한다.
- 코드 수정 뒤에는 `graphify update .`로 그래프를 갱신한다.

## Deployment

- 배포 대상은 기존 Docker 환경이며, Cloudflare Tunnel 컨테이너가 애플리케이션으로 라우팅한다.
- Tunnel ingress/도메인 라우팅은 운영자가 별도로 구성한다. 애플리케이션 초기화 단계에서 임의의 Tunnel 설정이나 배포 자동화는 만들지 않는다.
