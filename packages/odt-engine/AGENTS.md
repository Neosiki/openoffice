# odt-engine (`@genoffice/odt-engine`)

OpenDocument Text(`.odt`)를 워드 편집기가 다루는 docx로 바꾸고, 편집 결과를 원본 ODT에 고친 곳만 끼워 넣어 저장한다. 원본 ODT가 없는 문서는 ODT로 통째로 바꾼다.

## 맡은 범위

(구현과 함께 채운다.)

## 맡지 않는 것 (경계)

- docx의 해석과 저장은 `packages/docx-engine`이 한다. 이 패키지는 그 엔진을 고치지 않고 공개 API만 쓴다.
- 편집 화면, 저장 창, 꺼 둔 기능의 안내는 `apps/docs`가 한다.

## 항상 지켜야 하는 것

- 렌더러 번들에 들어가므로 `node:*`를 import하지 않는다.
- 받은 ODT에서 고치지 않은 부분은 바이트 그대로 남긴다. 고친 것이 없는 저장은 원본 바이트를 그대로 돌려준다.

## 테스트

- `npm run test -w @genoffice/odt-engine`. 실제 정부 파일은 저장소에 넣지 않고, 한컴 ODT의 특징을 흉내 낸 합성 파일로 시험한다.
