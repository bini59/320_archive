# Ubiquitous Language

## Archive

외부 URL에서 확보해 보존하는 하나의 웹 콘텐츠 단위. 원본 URL, 정규화 URL, 생성 시각, 보존 상태를 가진다. 같은 정규화 URL은 하나의 Archive를 재사용한다.

## Normalized URL

Archive의 중복을 판정하기 위한 URL. HTTP(S) URL의 호스트 대소문자와 기본 포트를 정리하며, 경로·쿼리·프래그먼트는 서로 다른 콘텐츠를 가리킬 수 있으므로 보존한다. 로컬호스트, 사설 IP, 링크 로컬 주소 등 내부망 대상은 지원하지 않는다.

## Pending

Archive가 생성되었지만 아직 원문 콘텐츠를 확보하지 않은 보존 상태.

## Snapshot

Archive를 저장한 시점의 표현 집합과 메타데이터. `original.html`은 받은 원문을
그대로 보존하고, `readable.html`은 안전한 읽기용 표현이며, 선택적인
`rendered.html`은 캡처 시점에 격리된 브라우저가 실행한 뒤의 DOM 표현이다.

## Rendered snapshot

CSR hydration이 끝난 DOM과 캡처된 CSS·font·image를 archive asset 경로로
재작성한 self-contained HTML. 열람 시에는 JavaScript를 다시 실행하지 않는다.

## Browser capture

인증 상태나 사용자 쿠키를 주입하지 않은 격리된 Playwright Chromium context에서
bounded timeout/request/response/page 제한을 적용해 Snapshot의 rendered 표현을
만드는 과정. 브라우저는 보존 시점에만 실행된다.

## Self-contained rendered view

`rendered.html`과 같은 archive의 manifest asset만 참조하는 sandbox iframe 열람
화면. script, connect, form, remote fallback은 허용하지 않는다.

## Resource manifest

snapshot이 사용하는 digest-keyed local asset와 원본·최종 URL, MIME, byte length의
목록. 기존 image/PDF/text 자산에 CSS와 font 자산을 포함할 수 있다.

## Asset

Snapshot이 참조하는, 로컬로 내려받아 보관한 이미지·첨부파일·CSS·font. 원격
파일명은 key에 사용하지 않고 내용 digest와 허용된 확장자로만 식별한다.

## Share link

Archive를 외부에 열람시키는 공개 URL. MVP에서는 Archive가 기본 공개이며, 추후 개별 공유 제어와 SSO를 추가할 수 있다.

## Avoid

- `rendered snapshot`을 viewer에서 다시 실행하는 “live preview”라고 부르지 않는다.
- capture context에 로그인 쿠키·auth header를 넣거나 인증 페이지를 보존 대상으로
  확장하지 않는다.
- rendered 결과에 recursive cross-origin iframe, video/streaming, Shadow DOM을
  포함시키지 않는다.
