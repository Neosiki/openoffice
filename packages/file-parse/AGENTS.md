# file-parse

## 맡은 범위

첨부 파일을 모델에 보낼 평문으로 바꾼다. `parseFileToText(경로)`가 확장자와 매직 바이트를 보고 PDF, docx, doc, pptx, ppt, xlsx/xlsm, 텍스트 계열 파일을 글자로 풀고, 이미지는 내용을 읽지 않고 `kind: 'image'`와 MIME만 돌려준다. Docs·Sheets·Slides·HTML 메인 프로세스의 첨부 처리와 셸의 파일 색인·지식 베이스가 쓴다.

## 맡지 않는 것 (경계)

- 편집용 파싱이 아니다. 서식, 위치, 왕복 보존에 필요한 정보는 버린다. 문서를 열고 저장하는 일은 `packages/docx-engine`, `packages/pptx-engine`, `packages/xlsx-gateway`와 Rust 사이드카가 한다.
- 이미지를 모델에 넘기는 일은 호출자와 `packages/ai-provider`가 한다.
- 첨부 개수와 크기 제한, 모델 입력 길이에 맞춘 자르기는 호출자가 한다. 이 패키지에는 파일 크기 상한이 없다.
- 스캔한 PDF의 글자 인식은 하지 않는다. PDF를 문서로 되살리는 일은 `packages/pdf2docx`다.

## 항상 지켜야 하는 것

- `parseFileToText`는 실패를 던지지 않고 `{ ok: false, error }`로 돌려준다. 깨진 파일 하나가 채팅 요청 전체를 막으면 안 된다. 따로 내보낸 `docxToText` 같은 개별 함수는 던진다.
- 확장자를 믿지 않는다. 매직 바이트와 어긋나면 `Content mismatch`로 거부한다. 예외는 `.doc` 이름의 zip 하나이고 OOXML로 읽는다. `.ppt` 이름의 zip은 거부한다.
- zip 기반 형식은 풀기 전에 관문을 거친다. pptx와 xlsx는 `assertZipInflatesWithinLimits`를 먼저 부르고 그다음에 선언 크기 검사를 한다. docx는 `parseDocx` 안에서 같은 검사가 돈다. 순서를 바꾸거나 선언 크기 검사만 남기지 않는다.
- 관계(rels) 대상은 `resolveTarget`으로만 푼다. `..`은 zip 루트에서 멈추고, 스킴이 붙은 대상과 디코딩할 수 없는 대상은 빈 문자열이 된다. Windows 계열 생성기가 쓰는 역슬래시 구분자도 여기서 처리한다.
- 글자를 바꾸지 않는다. XML 파서 설정은 `trimValues: false`, `parseTagValue: false`로 둔다. `02139` 같은 값이 숫자로 바뀌거나 런 사이의 공백이 사라지면 안 된다.
- 적대적인 xlsx에 메모리를 내주지 않는다. 열 번호가 16,384(`MAX_XLSX_COLS`) 이상이거나 참조가 잘못된 셀은 그 자리를 채우지 않고 뒤에 붙이고, 빈 칸이 8개 넘게 이어지면 `(N empty)`로 줄인다.
- 입력 바이트를 바꾸지 않는다. pdfjs는 받은 버퍼의 소유권을 가져가므로 복사본을 넘긴다.

## 이 모듈의 방식

- 출력 모양은 테스트가 고정한다. docx는 제목을 `#`, 목록을 `-`, 표의 칸 구분을 `|`로 적고 각주와 미주를 끝에 붙인다. pptx와 ppt는 슬라이드마다 `## Slide N`, 발표자 노트는 `### Notes`다. xlsx는 시트마다 `# 시트이름`, PDF는 페이지 사이에 빈 줄을 둔다.
- pptx의 슬라이드 순서는 파일 이름이 아니라 `presentation.xml`의 슬라이드 목록을 따른다. 목록에 없는 슬라이드 파트는 빼고, 목록 파일이 없을 때만 파일 번호순으로 읽는다.
- 글자가 없고 그림만 있는 슬라이드와 시트는 제목만 남기지 않고 그림 수와 함께 추출할 글자가 없다는 표시를 넣는다. 표시가 없으면 모델과 사용자가 내용이 전달되지 않은 슬라이드를 읽힌 것으로 여긴다.
- 텍스트 파일은 BOM을 보고 UTF-8과 UTF-16을 풀고, UTF-8로 읽히지 않으면 windows-1252로 읽는다. BOM이 UTF-32라고 알리는 파일만 거부한다.
- 설치본에서만 깨지는 문제를 막는 우회가 두 군데 있고, 개발 실행에서는 드러나지 않으므로 지우지 않는다. pdfjs는 `DOMMatrix`가 없으면 import 단계에서 죽어서 순수 JS 대체 구현을 먼저 설치하고, 워커 모듈을 글자 그대로의 경로로 import해 번들에 넣는다. `ppt-to-text`는 의존성을 번들러가 따라가지 못하는 require 뒤에 숨기므로 `globalThis.CFB`와 `cptable`을 먼저 채운 뒤 지연 import한다.
- 옛 PPT의 글자 디코딩은 코드페이지 1200(UTF-16LE)만 지원한다.

## 테스트

- `npm run test -w @genoffice/file-parse`, 또는 패키지 폴더에서 `npx vitest run`. 타임아웃은 20초다.
- OOXML 픽스처는 `tests/helpers/fixtures.ts`가 JSZip으로 그때그때 만들어 임시 폴더에 쓴다. 파일로 들어 있는 것은 옛 형식 두 개(`tests/fixtures/legacy-sample.doc`, `legacy-sample.ppt`)뿐이다. `npm run fixtures`는 필요 없다.
- 형식 처리를 바꾸면 정상 추출, 깨진 파일이 던지지 않고 `ok: false`가 되는 경우, 글자 원형 보존(앞자리 0, 런 사이 공백)을 덮는다. zip을 여는 경로를 건드리면 `tests/zip-bomb-gate.test.ts`도 함께 본다.
- Windows에서 원본 코드 그대로도 실패하는 테스트는 없다.
