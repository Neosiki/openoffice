# pdf-structure

## 맡은 범위

PDF를 다시 흐르는 글의 **문서 나무**로 바꾸고, 그 나무를 쓰는 출력과 작업을 모은다. PDF 편집기(`apps/pdf`), 셸의 구조 프로세스(`apps/shell/src/main/pdf-structure/`), 명령줄(`packages/cli`)이 같은 코드를 쓴다.

| 모듈                  | 하는 일                                                                                               | 진입점                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/tree`            | PDF → 문서 나무와 페이지 지문. 번역 나무·대역 나무 만들기                                             | `extractDocumentTree`, `deriveTranslatedTree`, `deriveBilingualTree`, `textUnits`                                   |
| `src/images`          | 페이지에 박힌 그림 객체를 원래 해상도의 PNG로 꺼내기                                                  | `extractEmbeddedImages`                                                                                             |
| `src/markdown`        | 나무 → Markdown 글, `assets/`의 그림, 앱 소유 목록(`.genoffice-assets.json`) 항목, 경고               | `treeToMarkdown`, `mergeAssetManifest`                                                                              |
| `src/epub`            | 나무 → EPUB 3 바이트. 문서 언어 추정                                                                  | `writeEpub`, `guessLanguageFromText`                                                                                |
| `src/structured-text` | 나무 → AI 창의 `read_pages`와 `pdf read --structured`가 쓰는 페이지별 구조화 글                       | `treeToStructuredText`, `formatStructuredPage`                                                                      |
| `src/store`           | 결과 보관소. AI가 읽은 페이지, 번역, 작업 기록. **Node 전용**                                         | `@genoffice/pdf-structure/store`의 `ResultStore`, `documentHash`                                                    |
| `src/jobs`            | 문서 작업 엔진. 호출 순서, 재시도, 멈춤, 이어하기, 문서마다 작업 하나                                 | `startAiReadJob`, `startTranslationJob`, `estimate*`, `plan*`, `runJobUnits`                                        |
| `src/ai-read`         | AI 페이지 읽기의 지시문·요청, 답 해석과 검사, 반복 걸러내기, 보관 형식, 나무에 반영, 미리 고를 페이지 | `buildAiReadRequest`, `createAiReadCallModel`, `applyStoredAiReadings`, `aiReadPreselectPages`, `aiReadVisionCheck` |
| `src/translate`       | 번역 단위·묶음, 자리 표시자, 지시문, 모델 호출과 다시 보내기, 기본 목표 언어, 번역·대역·부분 결과     | `translationJobParts`, `createTranslationModelCall`, `buildTranslatedTree`, `translationReport`                     |
| `src/writeback`       | 번역문을 원본 PDF의 사본에 블록마다 다시 써 넣기(번역 PDF)                                            | `writeTranslatedPdf`                                                                                                |

### 문서 나무 (`src/tree`)

`extractDocumentTree`가 PDF 바이트에서 나무와 페이지 지문을 만든다. 글자·표·그림은 `pdf2docx`의 `extractIrDocument`가 만든 IR에서 오고, 책갈피·문서 정보·지문은 PDFium에서 직접 읽는다.

- 나무 형식은 `types.ts`에 있다. 블록 목록 하나가 읽는 순서로 놓이고 페이지 경계 블록(`pageBreak`)이 원본 페이지 번호를 표시한다. 모든 블록이 원본 페이지 번호와 페이지 지문을 가진다.
- 번역 나무와 대역 나무도 같은 형식이다(`derive.ts`). 번역된 블록은 `원래 id@언어` id와 `translationOf`를 가진다. 번역 단위의 열쇠는 `textUnits`가 정한다.
- 표는 IR 표(`gridSpan`·`vMerge`)와 AI가 돌려준 HTML 표가 같은 모양(`TreeTable`)이다. HTML 쪽은 `tableFromSpans`로 만든다.

### 출력 (`src/markdown`, `src/epub`, `src/structured-text`, `src/images`)

- 세 나무(원본, 번역, 대역)를 모두 받는다. 대역 나무는 이미 원문 블록 다음에 번역 블록을 두고 있다.
- Markdown: 각주는 `[^n]`이고 정의는 문서 끝에 모은다. 표는 항상 파이프 표이고 병합 셀은 풀어 첫 칸에 내용을 둔다. 그림은 내용 해시 이름으로 `assets/`에 두고 앱 소유 목록 항목을 함께 돌려준다. 페이지 그림으로 넣은 페이지는 본문이 아니라 경고(`pageAsImage`)로 알린다. 경고의 `message`는 영어이고 화면은 `kind`로 번역한다. 파일 쓰기는 호출자의 일이다.
- EPUB: `mimetype`을 압축하지 않고 맨 앞에 둔다. 단계 1 제목마다 장 하나, 없으면 단계 2, 둘 다 없으면 한 파일이다. 표는 HTML이라 병합을 살린다. 수식은 KaTeX의 MathML이고 실패하면 LaTeX 원문을 코드 글자로 둔다. 표지 그림(`coverPng`)과 제목은 호출자가 준다. `modified`를 주면 결과가 바이트 단위로 같다.
- 구조화 글: 제목 `#`, Markdown 표, 페이지 끝 "각주" 묶음, 캡션은 `[figure]` 표시. 쪽당·호출당 글자 한도는 호출자가 지킨다.
- 그림 꺼내기: 32px(`MIN_IMAGE_PX`)보다 작은 것과 같은 내용의 중복은 건너뛴다. 아주 큰 그림은 `MAX_IMAGE_TOTAL_PX`에 맞춰 줄인다.

### 보관소 (`src/store`)

- 위치는 호출자가 준 데이터 폴더 아래 `pdf-store`(`STORE_DIR_NAME`)다. 앱은 `app.getPath('userData')`, 명령줄은 `genofficeUserDataDir()`를 준다. 둘이 같은 곳이어야 한다.
- 배치: `docs/<문서 해시>/ai-read/<페이지 지문>.json`, `translations/<언어>/translation.json`(제공자·모델), `translations/<언어>/blocks/<페이지 지문>/<글 해시>.<순번>.json`, `jobs/ai-read.json`·`jobs/translate.<언어>.json`.
- 문서 열쇠는 파일 바이트의 SHA-256, 번역 블록 열쇠는 시작 페이지의 지문 + 정규화한 원문 글의 해시 + 그 페이지 안에서 같은 해시의 순번이다(`keys.ts`). 페이지 범위를 바꿔도 글이 같으면 같은 블록이다.
- 작업 기록이 30초(`JOB_RUNNING_WINDOW_MS`) 안에 갱신되지 않은 `running`은 `stopped`/`interrupted`로 읽는다.
- `migrateDocument`는 앱 안 저장으로 해시가 바뀐 문서의 결과를 지문이 같은 페이지만 옮긴다(더 새 것이 이긴다). **작업 기록은 옮기지 않는다.** 셸의 `job-migration.ts`가 따로 옮긴다.

### 문서 작업 (`src/jobs`)

- 엔진은 환경에 기대지 않는다. 보관소는 `DocumentJobStore`로, 모델 호출은 함수로 받는다. 앱에서는 PDF 편집기 화면 안에서, 명령줄에서는 명령 프로세스 안에서 돈다.
- 한 번에 2개(`JOB_CONCURRENCY`)를 보낸다. 실패한 호출은 1.5초 뒤 한 번 다시 보내고, 다시 실패한 단위가 3개(`JOB_MAX_CONSECUTIVE_FAILURES`) 잇달아 나오면 `failures`로 멈춘다. 형식 검사에 걸린 단위(`JobUnitFailure`)는 이 셈에 넣지 않는다.
- `JOB_STOP_KINDS`(`rate-limit`, `signed-out`, `credits` 등)는 즉시 멈춘다. 보내는 중인 호출도 끊고 `resetsAt`을 남긴다.
- 단위는 보관소에 쓰인 뒤에야 끝난 것이다. 보관소 쓰기가 실패하면 `store-write-failed`로 멈춘다. 실패로 기록된 번역 블록은 끝난 것으로 치고, "처음부터 다시"만 다시 보낸다.
- 문서마다 작업 하나는 프로세스 안의 잠금(`documentJobs`)이 지킨다. 다른 프로세스와의 겹침은 호출자가 보관소의 작업 기록(`running`)으로 막는다.
- 엔진은 스스로 시작하지 않는다. 호출자가 사용자의 확인 뒤에 부른다.

### AI 페이지 읽기와 번역 (`src/ai-read`, `src/translate`)

- 받은 글은 문서 데이터다. 지시를 따르지 않고 도구를 부르지 않는다. 형식이 깨진 페이지 답은 한 번 다시 묻고, 그래도 깨지면 그 페이지를 실패로 둔다(보관하지 않는다). 같은 구절이 비정상적으로 되풀이되는 블록은 버린다.
- AI 읽기 결과는 **원본 나무에만** 반영한다(`applyStoredAiReadings`). 번역·대역 나무는 반영한 뒤에 만든다. 보관 형식은 페이지 지문을 열쇠로 한다.
- 번역 묶음은 약 2,500토큰(`TRANSLATION_BATCH_TOKENS`)이다. 굵게·기울임 경계, 링크, 각주 표시, 줄 안 수식은 자리 표시자로 바꿔 보내고(링크 주소는 보내지 않는다), 돌아온 자리 표시자의 종류와 개수가 맞지 않으면 두 번까지(`TRANSLATION_MAX_RESENDS`) 다시 보낸다. 해석할 수 없는 묶음은 `JobUnitFailure`라 보관하지 않고 이어 갈 때 다시 보낸다.
- 기본 목표 언어는 화면 언어이고, 문서 언어가 화면 언어와 같으면 영어다. 문서 언어는 문자 체계로 추정하므로 라틴 문자 문서는 모두 `en`으로 읽힌다(알려진 한계).

### 번역 PDF (`src/writeback`)

- 원본 바이트는 복사만 한다. 블록마다 원문 글자 객체만 지우고 같은 상자에 번역문을 쓴다. 벡터 그림, 이미지, 링크, 주석, 양식은 그대로 둔다. 글꼴은 목표 언어를 그릴 수 있는 설치 글꼴을 HarfBuzz wasm(`hbSubsetWasm`, 호출자가 준다)으로 부분 집합해 넣는다.
- 넘치면 원래 크기의 60%(`MIN_FONT_SCALE`)까지 줄이고, 그래도 넘치면 넘친 채 두고 보고에 넣는다. 스캔 페이지는 OCR 줄 상자를 바탕색으로 칠한 뒤 쓴다. OCR이 없거나 글자 편집이 안 되는 페이지는 원본 그대로 두고 보고에 넣는다.
- 암호가 걸린 PDF는 `WritebackEncryptedError`로 거절한다.

## 맡지 않는 것 (경계)

- PDF 분석 규칙(줄·문단·단·표·머리말 가려내기)은 `pdf2docx`의 것이다. 이 패키지는 IR을 읽기만 하고 `pdf2docx`를 고치지 않는다. IR에 없는 것(제목 단계, 캡션, 다단 이음)만 IR 위에서 추론한다.
- PDFium wasm 초기화는 호출자가 한다. 초기화된 모듈을 받는다. OCR 엔진, 폰트 부분 집합 wasm, 페이지 그림 그리기도 호출자가 준다.
- 모델 호출, 제공자 선택, 구독 프로그램 실행은 이 패키지의 일이 아니다. 앱은 `ai:stream`, 명령줄은 `ai-provider`의 `streamForProvider`로 부르고, 이 패키지는 그 함수를 받아 쓴다.
- 파일 저장 창, 출력 파일 쓰기, 진행 표시, 시작 전 확인은 호출자(`apps/pdf`, 셸, `packages/cli`)의 일이다.
- 별도 프로세스(`utilityProcess`)를 띄우는 일은 셸이 한다(`apps/shell/AGENTS.md`).
- `pdf2docx`의 분석 코드는 타입이 없는 `bidi-js`를 끌어온다. 이 패키지를 소스로 컴파일하는 곳은 `pdf2docx/src/bidi-js.d.ts`를 tsconfig `include`에 넣는다(`apps/pdf`, `apps/shell`과 같은 방식).

## 항상 지켜야 하는 것

- `pdf2docx`와 문서 엔진 패키지의 파일을 고치지 않는다. 기존 워드·PPT·엑셀 변환 결과는 바이트 단위로 같아야 한다.
- 형제 패키지는 상대 경로(`../../../pdf2docx/src/...`, `../../../i18n/src/index`)로 import한다. Electron을 import하지 않는다.
- Node 전용 코드(`node:fs` 등)는 `src/store` 안에만 둔다. 보관소는 패키지 루트에서 내보내지 않고 `@genoffice/pdf-structure/store`(`src/store/index.ts`)로만 내보낸다. 화면 코드가 루트를 가져와도 Node 모듈이 끌려 들어오지 않아야 한다. `keys.ts`는 순수 코드라 엔진이 직접 가져온다.
- IR 객체를 바꾸지 않는다. 구조 판단은 작업용 사본(`draft.ts`)에만 적는다.
- 강등·스캔 페이지는 페이지 그림 블록으로 넣는다. 깨진 글자를 조용히 넣지 않는다.
- 페이지 지문은 페이지 내용(글자, 그림 객체 원본 바이트, 객체 수, 크기)만으로 만든다. 페이지 위치가 들어가면 순서 변경과 범위 분석에서 보관소 열쇠가 깨진다.
- 원본 PDF 바이트를 바꾸지 않는다. 페이지 범위는 메모리 안의 사본으로 분석하고, 번역 PDF는 사본에 쓴다.
- 보관소 항목은 통째로 원자적으로 쓴다. 읽을 수 없는 항목은 없는 것으로 보고, 읽기 함수는 예외를 던지지 않는다. 열쇠 모양과 배치를 바꾸면 이미 보관된 결과를 잃는다. 바꿔야 하면 형식 번호를 올리고 옮기는 길을 만든다.
- 아랍어·히브리어·힌디어(`ar`, `he`, `hi`)는 번역 PDF에 쓸 수 없다. 번역문에 그 문자 체계(복잡한 문자 배치가 필요한 문자)가 있으면 그 블록은 `script-unsupported`로 원문을 둔다. 호출자는 이 세 언어에서 번역 PDF 형식을 고르지 못하게 한다(PDF 편집기의 번역 창, 명령줄의 `PDF_UNWRITABLE_LANGUAGES`).
- 저장되는 식별자를 바꾸지 않는다. Markdown의 앱 소유 목록 이름은 `.genoffice-assets.json`이다. 목록에 없는 `assets/`의 파일은 덮어쓰지 않는다(`mergeAssetManifest`).
- 엔진과 모델 호출 함수는 스스로 시작하거나 이어 가지 않는다. 다른 제공자로 바꾸지 않는다.

## 이 모듈의 방식

- 제목 단계 근거의 우선순위: 책갈피와 맞는 줄 → 인쇄된 목차 항목이 가리키는 줄 → 본문보다 뚜렷이 큰(1.15배) 글자 크기 단계. 앞의 근거가 정한 크기 단계의 단계는 글자 크기 판정에서도 그대로 쓴다. 단계는 6을 넘지 않는다.
- 목차 항목이 3개 이상이고 글 블록의 절반 이상인 페이지는 목차 페이지다. 본문에서 빼고 `toc`에 남긴다.
- 페이지 넘김 잇기는 `pdf2docx`의 `stitchCrossPageParagraphs` 기준값을 그대로 옮겨 쓴다(`stitch.ts`). 값을 바꾸지 않는다. 그 함수가 건너뛰는 다단 페이지는 마지막 단의 끝과 다음 페이지 첫 단의 시작을 보고, 왼쪽 정렬은 단 기준으로 잰다. 이미 IR이 이은 경계(`flowsFromPrev`)는 다시 보지 않는다.
- 페이지 범위는 pdf-lib로 고른 페이지만 복사해 분석한다. 암호가 걸린 문서는 pdf-lib가 복호화하지 못하므로 PDFium의 페이지 가져오기로 복사한다.
- 진행은 페이지마다 알리고, 취소 신호를 받으면 다음 페이지 경계에서 바로 멈춘다. 분석은 동기라서 같은 스레드의 취소는 진행 콜백 안에서만 들어온다. 앱은 별도 프로세스를 끝내는 것으로 취소한다.
- 보관소의 쓰기는 같은 폴더의 임시 파일에 쓰고 rename한다. Windows는 다른 프로세스가 열어 둔 파일 위로 rename하지 못하므로, 거절되면 예전 항목을 옆으로 옮기고 새 항목을 그 이름으로 옮긴다. 같은 항목을 쓰는 쪽끼리는 옆의 잠금 파일로 차례를 지킨다. 10초 넘은 잠금은 죽은 쓰기의 것으로 보고 넘겨받는다.
- 조정 가능한 값은 이름 붙은 상수로 둔다(`JOB_CONCURRENCY`, `TRANSLATION_BATCH_TOKENS`, `MIN_FONT_SCALE`, `MIN_IMAGE_PX`, `AI_READ_REPETITION` 등). 값을 바꾸면 spec과 문서의 숫자도 고친다.

## 테스트

- `npm run test -w @genoffice/pdf-structure`, `npm run typecheck -w @genoffice/pdf-structure`. PDFium wasm과 합성 PDF 생성기는 `pdf2docx/tests/helpers`를 상대 경로로 쓴다(`tests/helpers/fixtures.ts`). `pdf-lib`는 저장소 루트의 `node_modules`에 설치된 것을 쓴다.
- 규칙마다 해당 사례와 인접 사례를 둔다. 같은 크기의 줄이 같은 폭이 되도록 다단·페이지 넘김 사례는 고정폭 글꼴(Courier)과 다섯 글자 낱말로 만든다.
- 제공자는 항상 가짜다. 테스트는 실제 `claude`·`codex`나 네트워크에 닿지 않는다.
- **보관소 동시 쓰기**(`tests/store-concurrency.test.ts`)는 Node 프로세스 두 개를 `node --import tsx`로 띄워 같은 항목을 번갈아 쓰게 하고, 다른 핸들이 항목을 열어 둔 채로도 바꿔 쓸 수 있는지 본다. Windows의 rename 거절을 실제로 겪는 것은 Windows에서 돌릴 때뿐이다. 보관소의 쓰기 방식을 바꾸면 Windows에서 이 파일을 여러 번 돌려 본다. 시간이 걸리는 테스트라 시간 제한이 길다(60초).
- **epubcheck**는 테스트 의존성이 아니다. 개발 PC에서 `PDF_STRUCTURE_EPUB_SAMPLE=<경로.epub>`를 두고 `tests/epub.test.ts`를 돌리면 모든 요소를 담은 표본을 쓴다. 그 파일을 `java -jar epubcheck.jar <경로.epub>`로 검사해 오류 0이어야 한다. EPUB 쓰기를 바꾸면 이 검사를 다시 한다. 테스트 자체는 모든 XHTML·OPF가 잘 짜인 XML인지 `saxes`로 본다.
- 번역 PDF 테스트(`tests/writeback.test.ts`)는 결과 PDF를 다시 읽어 원문 글자가 사라지고 번역문이 나오는지, 링크·그림·도형이 그대로인지 본다. 설치 글꼴에 기대는 사례는 그 PC의 글꼴에 따라 달라질 수 있다.
