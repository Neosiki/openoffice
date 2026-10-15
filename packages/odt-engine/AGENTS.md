# odt-engine (`@genoffice/odt-engine`)

OpenDocument Text(`.odt`)를 워드 편집기가 다루는 docx로 바꾸고, 편집 결과를 원본 ODT에 고친 곳만 끼워 넣어 저장한다. 원본 ODT가 없는 문서는 ODT로 통째로 바꾼다.

## 맡은 범위

- 핵심 층(`src/core`, 진입점 `src/core/index.ts`): 나머지 층(글자, 표, 개체, 쪽, 조립)이 모두 이 위에 선다.
  - `openOdt`: zip 관문 → 패키지 읽기 → `mimetype` 검사 → 암호 검사 → 본문 위치 지도 → 스타일 표 → 생성 프로그램 판별.
  - `readOdtPackage`: 항목마다 원래 바이트(압축 푼 것), 원래 압축 방식, 원래 순서(로컬 헤더 위치 순)를 지닌다. 다시 묶을 때 이것을 쓴다.
  - `scanOdtBody`: `office:text`의 최상위 요소와 그 안의 문단·목록·구역·색인·표·행·셀·가려진 셀·글상자·그림·개체·도형·책갈피·메모·각주를 원본 문자열의 위치(`start`/`openEnd`/`closeStart`/`end`)로 기록한다.
  - `readOdtStyles`: 공용 스타일, 기본 스타일, 목록 스타일, 쪽 모양, 바탕쪽(머리글·꼬리글과 왼쪽·첫쪽 변형), 두 파트의 자동 스타일을 위치와 함께 담고 상속을 풀어 준다(`resolve`).

## 맡지 않는 것 (경계)

- docx의 해석과 저장은 `packages/docx-engine`이 한다. 이 패키지는 그 엔진을 고치지 않고 공개 API만 쓴다.
- 편집 화면, 저장 창, 꺼 둔 기능의 안내는 `apps/docs`가 한다.

## 항상 지켜야 하는 것

- 렌더러 번들에 들어가므로 `node:*`를 import하지 않는다.
- 받은 ODT에서 고치지 않은 부분은 바이트 그대로 남긴다. 고친 것이 없는 저장은 원본 바이트를 그대로 돌려준다.

## 이 모듈의 방식

- XML을 DOM으로 만들었다가 다시 쓰지 않는다. `XmlScanner`/`walkElements`가 원본 문자열의 위치만 돌려주고, 범위로 자른 문자열이 그 요소의 원문과 정확히 같다. 저장은 바뀐 범위만 갈아 끼운다.
- 읽기는 너그럽다. `mimetype`이 맨 앞이 아니거나 압축돼 있어도, `office:version`이 없어도, 닫히지 않은 태그가 있어도 연다. 깨진 태그는 `body.warnings`에 남기고 넘어간다.
- 거부는 `OdtOpenError`의 `code`로 구분한다: `encrypted`(manifest에 `manifest:encryption-data`), `not-odt-text`(`mimetype`이 ODT 글 문서가 아님, `.ott` 포함), `zip-rejected`(docx와 같은 한도의 압축 관문), `corrupt`.
- 파트 글자는 BOM을 지운 채가 아니라 U+FEFF로 남겨 디코드한다. 그래서 위치가 다시 인코딩한 바이트와 어긋나지 않는다.
- 접두사가 표준과 다른 문서도 뿌리 요소의 `xmlns:` 선언으로 표준 이름(`text:p`)에 맞춰 읽는다. 노드의 `name`은 표준 이름, `tag`는 파일에 쓰인 그대로다.
- 스타일 이름은 쓰인 그대로 둔다(띄어쓰기, 한글, `+`). 엔티티는 풀어서 `name`에, 원문은 `rawName`에 둔다. 한컴은 정의하지 않은 부모(`Standard`, `Frame`)를 가리키는데, 이것은 오류가 아니라 `missingParent`로 알린다.
- 자동 스타일은 다른 스타일의 부모가 되지 못한다. 부모는 공용 스타일에서만 찾고, 자동 스타일은 파트별 범위(`content`/`styles`)로 따로 찾는다. 두 파트에 같은 이름(`P1`)이 있을 수 있다.
- 한컴의 `draw:equation`은 수식이 아니라 도형(`draw:custom-shape`)의 모양 계산식이다. 노드로 잡지 않는다. 수식 개체는 `draw:object`다.

## 테스트

- `npm run test -w @genoffice/odt-engine`. 실제 정부 파일은 저장소에 넣지 않고, 한컴 ODT의 특징을 흉내 낸 합성 파일로 시험한다.
- 합성 파일 생성기는 `tests/helpers/`에 있다. 모든 층의 테스트가 함께 쓴다.
  - `build-odt.ts`: `buildOdt(options)`/`buildOdtPackage(options)`. 기본값이 한컴과 같다(항목 이름순이라 `mimetype`이 맨 앞이 아니고 압축됨, `office:version` 없음, 문단마다 자동 스타일과 탭 목록, 머리글·꼬리글이 있는 바탕쪽 둘). `body`, `extraContentAutomaticStyles`, `extraCommonStyles`, `masterStyles`, `pictures`, `extraEntries`, `overrideParts`, `encrypted`, `mimetype`, `generator`로 무엇이든 바꿔 넣는다.
  - `hancom-fragments.ts`: 한컴 모양의 조각(`hPara`, `hTable`, `hCell`, `hFramedTable`, `hFieldBookmark`, `hFootnote`, `hAnnotation`, `hImageFrame`, `hFormulaObject`, `hCustomShape` 등). 조각은 쓴 문자열을 그대로 돌려주므로 테스트가 "범위로 자른 원문 = 조각"을 바로 비교할 수 있다.
  - `hancom-sample.ts`: 위 특징을 모두 담은 문서 하나(글상자 안의 표, 본문 표, 셀 안의 표, 병합·가려진 셀, 잠긴 셀, 누름틀 책갈피, 그림, 각주, 메모, 수식 개체, 도형, 목록, 구역, 차례, 같은 바탕쪽을 쓰는 여러 구역).
- 실제 파일 점검은 저장소 밖에서만 한다: `ODT_CORPUS=<폴더> npm run test -w @genoffice/odt-engine`. 변수가 없으면 `tests/core-corpus.test.ts`는 건너뛴다.
