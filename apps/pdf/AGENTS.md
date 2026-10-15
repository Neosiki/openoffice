# apps/pdf (`@genoffice/pdf`)

PDF 보기·주석·편집 에디터다. 화면은 PDF.js로 그리고, 저장은 pdf-lib로, 글자 편집과 영구 가림은 PDFium(WASM)으로 한다. AI는 공용 배선 위에 PDF용 skill만 얹은 얇은 구성이다.

## 맡은 범위

- 렌더러(`src/renderer/`): 쪽 렌더링과 글자 계층, 축소판, 주석·서식·그리기 덧그림, 메모 여백, 리본.
- 메인 프로세스(`src/main/pdf-main.ts`와 주변): 저장(`save-pdf.ts`), 글자 편집(`text-edit.ts`, 글꼴 찾기·부분 집합 `font-*.ts`), 영구 가림(`redaction.ts`), 이미지 편집·내보내기, 셸의 PDF 도구 창이 부르는 처리(그림 여러 장으로 PDF 만들기 `images-to-pdf.ts`, 양면 인쇄 맞추기 `print-prep.ts`, 배경 겹치기 `overlay.ts`, 주석 한꺼번에 지우기 `annot-strip.ts`, 빈 페이지 후보 찾기 `blank-pages.ts`(셸의 구조 작업 프로세스에서 돈다), 용량 줄이기 `compress.ts`(그림 처리는 셸이 넘긴 크로미움 코드)), OCR(`ocr.ts`), 전자 서명(`pdf-sign.ts`, `pdf-signatures.ts`, `signature-store.ts`), 빈 PDF 생성(`blank-pdf.ts`).
- IPC 계약 `src/shared/ipc.ts`(`PDF_CHANNELS`)와 편집 연산 설명(`src/shared/op-docs.ts`).
- 페이지 탭의 "PDF 도구" 메뉴(결정 0030): 저장하지 않은 편집을 먼저 저장한 뒤 `pdf:open-in-pdf-tools`로 그 뷰의 파일과 도구 이름(`PDF_TOOLS_HANDOFF`)을 넘긴다. 메인은 그 뷰에 허가된 파일만 받아 셸이 주입한 `openPdfTools`를 부른다. 단독 실행에는 이 주입이 없어 메뉴가 아무것도 열지 못한다고 알린다.
- PDF의 AI: 패널(`src/renderer/ai/AiPanel.tsx`), skill과 도구(`pdf-skill.ts`, `tools.ts`), 막힌 실행 판정(`ai-connection.ts`), 연결 상태 훅(`useSubscriptionConnection.ts`), preload가 내보내는 구독 API의 모양(`src/shared/subscription-api.ts`).
- Markdown·EPUB 변환 화면(`src/renderer/convert/`): 변환 창(`ConvertDialog.tsx`, 페이지 범위·저장 위치·진행·취소, EPUB은 표지와 책 정보), 책 정보 "AI로 채우기"(`BookInfoAiFill.tsx`, `book-info-ai.ts`), "이미지를 폴더로 내보내기"의 "페이지 안의 그림만"(`ExportImagesMenu.tsx`, `embedded-images.ts`).
- AI 페이지 읽기 화면(`src/renderer/ai-read/`): 페이지 고르기와 시작 전 확인(`AiReadDialog.tsx`), 작업·진행·이어하기 제안·이 문서의 보관분 지우기(`AiPageReading.tsx`), 페이지 그림 그리기(`render-page.ts`, 170dpi), 뷰어 검색의 "AI로 읽은 글에서 찾음"(`search-texts.ts`).
- 문서 번역 화면(`src/renderer/translate/`): 언어·범위·형식 고르기와 시작 전 확인(`TranslateDialog.tsx`), 작업·멈춘 뒤의 선택·결과 파일 쓰기(`DocumentTranslation.tsx`), 결과 보고(`TranslateReport.tsx`).
- 문서 작업 공용 부품(`src/renderer/doc-jobs/`): 탭의 작업 세션(`job-session.ts`), 쓸 제공자 정하기와 고정(`route.ts`), `ai:stream`으로 가는 모델 호출 하나(`model-call.ts`), 셸의 보관소 채널을 엔진의 보관소로 감싼 것(`ipc-store.ts`), 진행 줄(`JobProgressStrip.tsx`), 이어하기 제안(`ResumeOffer.tsx`), 작업에 고른 페이지 기억(`job-pages.ts`, 페이지 번호만).
- AI 창에서 작업을 여는 도구 `start_ai_page_reading`, `start_document_translation`(`tools.ts`). 창만 열고 바로 끝난다.

## 맡지 않는 것 (경계)

- AI 요청의 실행은 이 모듈의 범위가 아니다. `ai:stream`·`ai:get-settings` 등 공용 채널과 구독 IPC 채널은 `apps/docs/src/main/docs-main.ts`의 `registerAiIpc`가 등록한다. 이 모듈은 그중 어느 것도 등록하지 않는다. 그래서 단독 실행(`startPdfStandalone`)에는 AI 핸들러가 없고, 그때 패널의 연결 상태는 계속 `checking`이다. 배포되는 앱에는 항상 핸들러가 있다.
- 제공자 선택은 `packages/ai-provider`, 보내기 규칙과 연결 카드·알림은 `packages/ui`, 에이전트 루프는 `packages/agent-core`의 범위다.
- PDF를 Word·PowerPoint·Excel로 바꾸는 변환은 `packages/pdf2docx`와 shell(`apps/shell/src/main/pdf2docx-local.ts` 등)의 범위다. AI가 새 docx·md를 만드는 흐름은 문서 에디터의 `createAiDocument`가 하고 shell이 `configurePdfRuntime`으로 주입한다.
- 탭, 창, 암호 입력 창, 구독 프로그램의 수명은 `apps/shell`의 범위다.
- 구조 작업과 보관소의 채널(`PDF_CHANNELS`의 `structure*`, `store*`)은 이 모듈이 이름과 모양만 정하고(`src/shared/ipc.ts`), 처리는 셸이 등록한다(`apps/shell/src/main/pdf-structure-ipc.ts`). 구조 작업은 셸이 작업마다 띄우는 별도 프로세스에서 돈다. 단독 실행에는 이 채널이 없어 `not-available`로 답한다. 화면은 preload의 `window.pdfApi.structure`(`pickTarget`, `tree`, `text`, `convert`, `extractImages`, `writeBack`, `cancel`, `onProgress`)와 `window.pdfApi.store`(`docHash`, `aiReadPages`, `translations`, `translation`, `unfinishedJobs`, `write`, `migrate`, `deleteDocument`)로 부른다. 답은 `{ ok: true, … }` 또는 `{ ok: false, error, message?, validRange? }`다.
- 문서 나무, 변환, AI 읽기·번역의 규칙과 작업 엔진은 `packages/pdf-structure`의 범위다. 이 모듈은 그것을 화면에 잇는다.

## 항상 지켜야 하는 것

- 파일 경로는 허가된 것만 다룬다. 뷰마다 읽기가 허용된 경로와 "다른 이름으로 저장" 대상이 따로 기록되고(메인 프로세스의 대화 상자가 고른 것만), 핸들러는 그 밖의 경로를 거절한다. 렌더러가 보낸 경로를 그대로 읽거나 쓰는 핸들러를 추가하지 않는다.
- 쪽 비트맵은 문서 내용이다. 테마가 다시 칠하지 않는다. 야간 읽기는 쪽 비트맵에만 CSS 필터를 거는 화면 전용 표시이고(덧그림은 DOM에서 분리돼 있다) 저장·내보내기·인쇄 결과에는 영향이 없어야 한다. 리본 등 크롬 색은 토큰만 쓴다.
- 영구 가림은 되돌릴 수 없는 내용 제거다. `redactPdf`는 영역과 겹치는 글자·그림을 PDFium으로 실제로 지운 사본을 만든다. 검은 사각형을 위에 그리는 것으로 대체하지 않는다. 입력 영역은 `validateRedactionRegions`를 거친다.
- 문서 안에 쓰이는 값은 바꾸지 않는다. 주석 작성자(`/T`)의 기본값 `GenOffice`(`save-pdf.ts`)는 파일에 저장되는 데이터라 제품 이름으로 치환하지 않는다. 화면에 보이는 문구와 모델에게 주는 system prompt의 제품 이름만 `brandText`를 거친다(`ai/pdf-skill.ts`).
- 이 모듈이 갖는 AI 채널은 `PDF_CHANNELS.generateImage` 하나다. 슬라이드의 `ai:generate-image`는 슬라이드 뷰가 있어야 등록되므로 PDF는 자기 채널을 갖는다. 호출할 때 `{ path: 'screen', statuses: sharedSubscriptionStatuses() }`를 넘기고, 읽을 수 있는 로컬 경로는 열린 파일의 폴더와 붙여 넣기 임시 폴더로 제한한다(`documentMediaRoots`).
- 이미지 생성 도구는 추측으로 내놓지 않는다. 메인의 가용성 보고(`AI_TOOL_CAPABILITIES_CHANNEL`)를 `imageGenerationAvailableOf`로 읽고, 핸들러가 없거나 답이 이상하면 "불가"로 본다.
- 구독 API는 preload가 `window.pdfApi.subscription`으로 내보내며 채널 이름과 판독 함수는 `@genoffice/ai-provider/browser`의 것을 쓴다. 이 모듈에 판독 함수의 사본을 만들지 않는다. 모든 호출은 실패를 견딘다(핸들러 없음 = `checking`, 동작 없음).
- 보내기 판단을 따로 만들지 않는다. 패널은 `useAiSendGate`를 쓰고, 막힌 실행은 `aiBlockedRunOf`가 `isAiBlockedRunKind`로 판정한다. 다른 제공자로 저절로 넘어가는 코드를 넣지 않는다.
- **문서 작업(AI 페이지 읽기, 번역)은 사용자가 시작 전 확인에서 "시작"을 눌렀을 때만 보낸다.** 확인은 예상 호출 수, 쓰일 제공자, 이미 해 둔 분량을 보여 주고, 요금 경로면 요금 부과 문구를 붙인다. 확인을 건너뛰는 길을 만들지 않는다. AI 창의 도구는 창을 열 뿐 작업을 시작하지 않는다(`requestOpen`은 바로 돌아온다). 작업 창과 책 정보 채우기도 패널처럼 `useAiSendGate`를 거친다.
- 쓸 제공자는 확인 전에 `documentJobRoute`로 한 번 정하고 작업 내내 그 제공자에 고정한다. 호출마다 `jobRouteRefusal`이 같은 제공자인지, 아직 쓸 수 있는지, 새로 요금 경로가 되지 않았는지 보고, 아니면 그 호출을 실패시켜 작업을 멈춘다.
- 모델 호출에는 도구를 주지 않는다. 답은 문서 데이터로만 쓰고, 모델이 도구를 요청해도 무시한다.
- 한 문서에 문서 작업 하나. 탭의 세션(두 작업이 공유), 화면 프로세스의 잠금(`documentJobs`), 다른 프로세스가 30초 안에 갱신한 `running` 기록 셋을 모두 본다.
- 작업은 탭에 묶인다. 탭이 사라지면(탭 닫기, 앱 종료) 세션이 모든 작업을 `interrupted`로 멈추고, 셸이 그 탭의 스트림과 구독 프로그램을 끝낸다. 작업을 스스로 시작하거나 이어 가는 코드를 넣지 않는다.
- **이어하기 제안**(`ResumeOffer`)은 문서를 열 때 끝나지 않은 작업 기록이 있으면 한 번 보인다. "이어서 하기"는 그 작업의 시작 전 확인을 열 뿐이다. 이어 갈 페이지는 `job-pages.ts`에 기억해 둔 것을 쓴다.
- 앱 안에서 저장해 파일 내용이 바뀌면 `store.migrate`로 보관분과 끝나지 않은 작업 기록을 새 해시로 옮긴다. 다른 이름으로 저장한 사본과 영구 가림 사본은 옮기지 않는다(알려진 한계).
- 번역 PDF는 목표 언어가 `ar`, `he`, `hi`이거나 문서에 암호가 걸렸으면 고를 수 없게 하고 이유를 보인다. 저장 위치는 보내기 전에 고른다. 페이지 범위를 줘도 번역 PDF는 모든 페이지를 담고, 고른 페이지만 번역된다.
- AI로 읽은 글은 뷰어 검색에서 위치 있는 글(본문 글자와 OCR)에 검색어가 없는 페이지에만 페이지 단위 결과로 더한다. 글자 선택과 워드·PPT·엑셀 변환에는 쓰지 않는다.
- 첫 연결 안내는 이 모듈에서 `codexKeepsHistory`와 `sendsWholeDocument`를 켠 채로 띄운다(패널, AI 읽기 창, 번역 창, 책 정보 채우기). 페이지 그림과 문서 전체 글이 보내질 수 있다는 문장은 PDF 편집기만 보인다.

## 이 모듈의 방식

- 메인 코드는 shell 번들에 들어간다(`../../../pdf/src/main/pdf-main`을 상대 경로로 import한다). `src/main`을 고친 뒤에는 shell을 다시 빌드한다.
- AI 편집은 연산 목록으로 한다. 연산의 한 줄 설명은 `src/shared/op-docs.ts`가 유일한 원천이고 테스트가 등록된 연산과 정확히 일치하는지 확인한다. 연산을 추가하면 이 표에 넣는다. 좌표는 PDF 사용자 공간의 포인트(y가 위쪽)이고 쪽 번호는 원본의 0부터 시작하는 번호다.
- 패널은 다른 에디터와 같은 부품으로 조립한다. 연결이 없으면 `AiConnectPrompt`, 구독 첫 사용이면 `AiFirstConnectionNotice`(Codex 진단 기록 문장 `codexKeepsHistory`와 페이지 그림·문서 전체 글 문장 `sendsWholeDocument`를 켠 채로), 문장은 `aiRunErrorText`다. 대기열의 메시지는 `admitQueued`를 지나고, 연결이 없으면 대기열을 멈춘다.
- PDF.js의 CMap·표준 글꼴·wasm은 `electron.vite.config.ts`가 렌더러 출력에 복사한다. 임베드되지 않은 한중일 글꼴의 문서가 이것으로 그려진다. 복사 경로는 POSIX 구분자여야 한다(Windows에서 `join`은 깨진다).
- OCR은 플랫폼 도우미 실행 파일을 쓴다(Windows는 `Windows.Media.Ocr`). 도우미가 없는 빌드에서는 엔진이 없는 것으로 풀리고 뷰어는 OCR 없이 동작한다.
- 문자열은 `src/renderer/i18n/strings.ts`(한 파일에 21개 언어, `zh`가 키 집합)와 `cert-sign-strings.ts`에 있다. 새 기능의 문자열은 언어별 조각으로 나뉘어 있다(`i18n/convert/`, `i18n/ai-read/`, `i18n/translate/`, 각각 `zh`가 키 집합). 구독 연결 문장과 AI 진입 이름은 `@genoffice/ui`의 것을 쓴다.
- 문서 작업 엔진은 화면 프로세스에서 돈다. 페이지 그림은 화면이 자기 PDF.js 사본으로 그리고, 모델 호출은 AI 창과 같은 `ai:stream`으로 간다. 결과 쓰기는 `ipc-store.ts`를 거쳐 셸의 보관소로 간다. 셸은 그 창에 열린 파일에서 자기가 계산한 해시만 받아들인다.
- `src/shared/ipc.ts`의 `structure*`·`store*` 채널 모양을 바꾸면 셸의 처리 코드(`apps/shell/src/main/pdf-structure/`)도 함께 고치고 셸을 다시 빌드한다.

## 테스트

- 실행: `npm run test -w @genoffice/pdf`(또는 이 폴더에서 `npx vitest run`), `npm run typecheck -w @genoffice/pdf`. 환경은 `jsdom`이다.
- AI 배선(`tests/ai-connection.test.ts`, `tests/ai-panel-subscription.test.ts`, `tests/subscription-api.test.ts`, `tests/ai-transport.test.ts`): 막힌 실행 판정, 핸들러가 없을 때의 상태, 가용성 답이 깨졌을 때 이미지 도구가 빠지는지, 첫 연결 안내의 문장. 이 모듈의 테스트는 제공자를 부르지 않는다.
- 새 기능: 변환 창(`convert-dialog`, `convert-ai-fill`, `convert-export-images`, `convert-helpers`), 구조 채널의 preload 모양(`structure-api`), AI 페이지 읽기(`ai-page-reading`, `ai-read-pages-structured`, `ai-read-search-tool`), 번역(`document-translation`). 확인 전에 아무것도 보내지 않는지, 한 문서에 작업 하나, 탭이 사라지면 멈추는지, 이어하기 제안이 아무것도 시작하지 않는지, 한도 소진에서 바로 멈추는지는 이 테스트들이 지킨다. 바꾸면 함께 고친다.
- 저장·가림·글자 편집을 바꾸면 결과 PDF를 다시 읽어 확인하는 테스트를 붙인다. 가림은 지운 글자가 추출 결과에 남지 않는지를 본다.
- Windows에서 `tests/generated-output.test.ts`의 "sanitizes characters that are invalid in file names" 한 건은 변경과 무관하게 실패한다(`a:b?.pdf`에서 `basename`이 Windows의 드라이브 표기로 `a:`를 떼어 낸다).
- 실제 렌더링, 서명 검증, OCR은 단위 테스트로 다 확인되지 않는다. 빌드한 앱에서 확인한다.
