# apps/pdf (`@genoffice/pdf`)

PDF 보기·주석·편집 에디터다. 화면은 PDF.js로 그리고, 저장은 pdf-lib로, 글자 편집과 영구 가림은 PDFium(WASM)으로 한다. AI는 공용 배선 위에 PDF용 skill만 얹은 얇은 구성이다.

## 맡은 범위

- 렌더러(`src/renderer/`): 쪽 렌더링과 글자 계층, 축소판, 주석·서식·그리기 덧그림, 메모 여백, 리본.
- 메인 프로세스(`src/main/pdf-main.ts`와 주변): 저장(`save-pdf.ts`), 글자 편집(`text-edit.ts`, 글꼴 찾기·부분 집합 `font-*.ts`), 영구 가림(`redaction.ts`), 이미지 편집·내보내기, OCR(`ocr.ts`), 전자 서명(`pdf-sign.ts`, `pdf-signatures.ts`, `signature-store.ts`), 빈 PDF 생성(`blank-pdf.ts`).
- IPC 계약 `src/shared/ipc.ts`(`PDF_CHANNELS`)와 편집 연산 설명(`src/shared/op-docs.ts`).
- PDF의 AI: 패널(`src/renderer/ai/AiPanel.tsx`), skill과 도구(`pdf-skill.ts`, `tools.ts`), 막힌 실행 판정(`ai-connection.ts`), 연결 상태 훅(`useSubscriptionConnection.ts`), preload가 내보내는 구독 API의 모양(`src/shared/subscription-api.ts`).

## 맡지 않는 것 (경계)

- AI 요청의 실행은 이 모듈의 범위가 아니다. `ai:stream`·`ai:get-settings` 등 공용 채널과 구독 IPC 채널은 `apps/docs/src/main/docs-main.ts`의 `registerAiIpc`가 등록한다. 이 모듈은 그중 어느 것도 등록하지 않는다. 그래서 단독 실행(`startPdfStandalone`)에는 AI 핸들러가 없고, 그때 패널의 연결 상태는 계속 `checking`이다. 배포되는 앱에는 항상 핸들러가 있다.
- 제공자 선택은 `packages/ai-provider`, 보내기 규칙과 연결 카드·알림은 `packages/ui`, 에이전트 루프는 `packages/agent-core`의 범위다.
- PDF를 Word·PowerPoint·Excel로 바꾸는 변환은 `packages/pdf2docx`와 shell(`apps/shell/src/main/pdf2docx-local.ts` 등)의 범위다. AI가 새 docx·md를 만드는 흐름은 문서 에디터의 `createAiDocument`가 하고 shell이 `configurePdfRuntime`으로 주입한다.
- 탭, 창, 암호 입력 창, 구독 프로그램의 수명은 `apps/shell`의 범위다.

## 항상 지켜야 하는 것

- 파일 경로는 허가된 것만 다룬다. 뷰마다 읽기가 허용된 경로와 "다른 이름으로 저장" 대상이 따로 기록되고(메인 프로세스의 대화 상자가 고른 것만), 핸들러는 그 밖의 경로를 거절한다. 렌더러가 보낸 경로를 그대로 읽거나 쓰는 핸들러를 추가하지 않는다.
- 쪽 비트맵은 문서 내용이다. 테마가 다시 칠하지 않는다. 야간 읽기는 쪽 비트맵에만 CSS 필터를 거는 화면 전용 표시이고(덧그림은 DOM에서 분리돼 있다) 저장·내보내기·인쇄 결과에는 영향이 없어야 한다. 리본 등 크롬 색은 토큰만 쓴다.
- 영구 가림은 되돌릴 수 없는 내용 제거다. `redactPdf`는 영역과 겹치는 글자·그림을 PDFium으로 실제로 지운 사본을 만든다. 검은 사각형을 위에 그리는 것으로 대체하지 않는다. 입력 영역은 `validateRedactionRegions`를 거친다.
- 문서 안에 쓰이는 값은 바꾸지 않는다. 주석 작성자(`/T`)의 기본값 `GenOffice`(`save-pdf.ts`)는 파일에 저장되는 데이터라 제품 이름으로 치환하지 않는다. 화면에 보이는 문구와 모델에게 주는 system prompt의 제품 이름만 `brandText`를 거친다(`ai/pdf-skill.ts`).
- 이 모듈이 갖는 AI 채널은 `PDF_CHANNELS.generateImage` 하나다. 슬라이드의 `ai:generate-image`는 슬라이드 뷰가 있어야 등록되므로 PDF는 자기 채널을 갖는다. 호출할 때 `{ path: 'screen', statuses: sharedSubscriptionStatuses() }`를 넘기고, 읽을 수 있는 로컬 경로는 열린 파일의 폴더와 붙여 넣기 임시 폴더로 제한한다(`documentMediaRoots`).
- 이미지 생성 도구는 추측으로 내놓지 않는다. 메인의 가용성 보고(`AI_TOOL_CAPABILITIES_CHANNEL`)를 `imageGenerationAvailableOf`로 읽고, 핸들러가 없거나 답이 이상하면 "불가"로 본다.
- 구독 API는 preload가 `window.pdfApi.subscription`으로 내보내며 채널 이름과 판독 함수는 `@genoffice/ai-provider/browser`의 것을 쓴다. 이 모듈에 판독 함수의 사본을 만들지 않는다. 모든 호출은 실패를 견딘다(핸들러 없음 = `checking`, 동작 없음).
- 보내기 판단을 따로 만들지 않는다. 패널은 `useAiSendGate`를 쓰고, 막힌 실행은 `aiBlockedRunOf`가 `isAiBlockedRunKind`로 판정한다. 다른 제공자로 저절로 넘어가는 코드를 넣지 않는다.

## 이 모듈의 방식

- 메인 코드는 shell 번들에 들어간다(`../../../pdf/src/main/pdf-main`을 상대 경로로 import한다). `src/main`을 고친 뒤에는 shell을 다시 빌드한다.
- AI 편집은 연산 목록으로 한다. 연산의 한 줄 설명은 `src/shared/op-docs.ts`가 유일한 원천이고 테스트가 등록된 연산과 정확히 일치하는지 확인한다. 연산을 추가하면 이 표에 넣는다. 좌표는 PDF 사용자 공간의 포인트(y가 위쪽)이고 쪽 번호는 원본의 0부터 시작하는 번호다.
- 패널은 다른 에디터와 같은 부품으로 조립한다. 연결이 없으면 `AiConnectPrompt`, 구독 첫 사용이면 `AiFirstConnectionNotice`(Codex가 진단 기록을 남길 수 있다는 문장을 켠 채로, `codexKeepsHistory`), 문장은 `aiRunErrorText`다. 대기열의 메시지는 `admitQueued`를 지나고, 연결이 없으면 대기열을 멈춘다.
- PDF.js의 CMap·표준 글꼴·wasm은 `electron.vite.config.ts`가 렌더러 출력에 복사한다. 임베드되지 않은 한중일 글꼴의 문서가 이것으로 그려진다. 복사 경로는 POSIX 구분자여야 한다(Windows에서 `join`은 깨진다).
- OCR은 플랫폼 도우미 실행 파일을 쓴다(Windows는 `Windows.Media.Ocr`). 도우미가 없는 빌드에서는 엔진이 없는 것으로 풀리고 뷰어는 OCR 없이 동작한다.
- 문자열은 `src/renderer/i18n/strings.ts`(한 파일에 21개 언어, `zh`가 키 집합)와 `cert-sign-strings.ts`에 있다. 구독 연결 문장과 AI 진입 이름은 `@genoffice/ui`의 것을 쓴다.

## 테스트

- 실행: `npm run test -w @genoffice/pdf`(또는 이 폴더에서 `npx vitest run`), `npm run typecheck -w @genoffice/pdf`. 환경은 `jsdom`이다.
- AI 배선(`tests/ai-connection.test.ts`, `tests/ai-panel-subscription.test.ts`, `tests/subscription-api.test.ts`, `tests/ai-transport.test.ts`): 막힌 실행 판정, 핸들러가 없을 때의 상태, 가용성 답이 깨졌을 때 이미지 도구가 빠지는지. 이 모듈의 테스트는 제공자를 부르지 않는다.
- 저장·가림·글자 편집을 바꾸면 결과 PDF를 다시 읽어 확인하는 테스트를 붙인다. 가림은 지운 글자가 추출 결과에 남지 않는지를 본다.
- Windows에서 `tests/generated-output.test.ts`의 "sanitizes characters that are invalid in file names" 한 건은 변경과 무관하게 실패한다(`a:b?.pdf`에서 `basename`이 Windows의 드라이브 표기로 `a:`를 떼어 낸다).
- 실제 렌더링, 서명 검증, OCR은 단위 테스트로 다 확인되지 않는다. 빌드한 앱에서 확인한다.
