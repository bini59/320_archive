# Ubiquitous Language

## Archive

외부 URL에서 확보해 보존하는 하나의 웹 콘텐츠 단위. 원본 URL, 정규화 URL, 생성 시각, 보존 상태를 가진다. 같은 정규화 URL은 하나의 Archive를 재사용한다.

## Normalized URL

Archive의 중복을 판정하기 위한 URL. HTTP(S) URL의 호스트 대소문자와 기본 포트를 정리하며, 경로·쿼리·프래그먼트는 서로 다른 콘텐츠를 가리킬 수 있으므로 보존한다. 로컬호스트, 사설 IP, 링크 로컬 주소 등 내부망 대상은 지원하지 않는다.

## Pending

Archive가 생성되었지만 아직 원문 콘텐츠를 확보하지 않은 보존 상태.

## Snapshot

Archive를 저장한 시점의 원문 HTML과 읽기용으로 정제한 본문 및 메타데이터.

## Asset

Snapshot이 참조하는, 로컬로 내려받아 보관한 이미지 또는 첨부파일.

## Share link

Archive를 외부에 열람시키는 공개 URL. MVP에서는 Archive가 기본 공개이며, 추후 개별 공유 제어와 SSO를 추가할 수 있다.
