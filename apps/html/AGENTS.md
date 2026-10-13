# apps/html (`@genoffice/html`)

HTML 에디터다. HTML 원문이 기준이고, 옆에서 실시간 미리 보기가 돈다. AI는 쪽 전체를 새로 쓰거나 원문을 좁게 고치며, 공용 AI 배선 위에 HTML용 skill을 얹은 구성이다.

## 맡은 범위

- 렌더러(`src/renderer/`): 원문 편집기(`source/`), 미리 보기와 검사기(`preview/`), 문서 모델(`document/`의 `patch.ts`, `parse-map.ts`, `ops.ts`, `brief.ts`), 발표 보기(`PresentView.tsx`), 리본과 스타일 패널(`components/`).
- 메인 프로세스(`src/main/html-main.ts`와 주변): 열기·저장, 미리 보기 스킴(`preview-protocol.ts`, `preview-document.ts`), 문서가 소유한 자산 폴더(`asset-lifecycle.ts`, `asset-mime.ts`), 단일 파일 내보내기(`single-file-html.ts`), PDF 인쇄와 Word 내보내기의 숨은 창.
- IPC 계약 `src/shared/ipc.ts`(`HTML_CHANNELS`).
- HTML의 AI(`src/renderer/ai/`): 패널, skill과 도구(`html-skill.ts`, `tools.ts`), 쪽 전체 생성(`page-writer.ts`, `brief-writer.ts`), 빈 문서의 의도(`intent.ts`), 가림(`redact.ts`, `redact-guard.ts`, `document/redact-edit.ts`), 막힌 실행 판정(`connection.ts`), 연결 상태(`subscription-client.ts`).

## 맡지 않는 것 (경계)

- AI 요청의 실행은 이 모듈의 범위가 아니다. 공용 `ai:*` 채널과 구독 IPC 채널은 `apps/docs/src/main/docs-main.ts`의 `registerAiIpc`가 등록하고 이 모듈은 등록하지 않는다. 단독 실행(`startHtmlStandalone`)에는 AI 핸들러가 없다.
- HTML을 Word로 바꾸는 변환기는 `packages/html2docx`의 범위다. 이 모듈은 숨은 창과 드라이버를 제공하고 결과를 저장한다.
- 제공자 선택은 `packages/ai-provider`, 보내기 규칙과 연결 카드·알림은 `packages/ui`, 가림 규칙의 공통 부분과 `streamText`는 `packages/agent-core`의 범위다.
- 탭, 창, 구독 프로그램의 잔여 프로세스 정리는 `apps/shell`의 범위다.

## 항상 지켜야 하는 것

- 모든 편집은 원문의 글자 범위 치환(`Patch`) 하나로 내려간다. 수동 편집, 검사기, AI, 서식 변경이 모두 같다. 원문을 파싱해 다시 직렬화하는 편집 경로를 만들지 않는다. 이 앱에는 JavaScript 파서나 포매터가 없고, 그래서 사용자가 쓴 표기와 아래의 가림 표시가 고쳐지지 않고 살아남는다.
- 저장되는 파일에 미리 보기용 수정을 넣지 않는다. 미리 보기 사본에는 상대 경로 자산이 `html-asset://`로 풀리도록 `<base>`를 넣지만(작성자가 이미 선언했으면 넣지 않는다) 저장 파일에는 들어가지 않는다. 이미지를 data URL로 넣는 것도 단일 파일 내보내기 때에만 한다. 작업 문서는 이미지를 `assets/`에 둔다(수 MB짜리 base64 줄은 원문과 AI 편집을 깨지기 쉽게 만든다).
- 문서 안에 저장되는 식별자를 바꾸지 않는다. 가림 표시 `data-gx-redact="label"`, `data-gx-redact-<attr>="label"`, 스크립트 안의 `/*gx:redact:label*/` 주석, 생성 개요를 담는 `<meta name="genoffice:brief">`(`BRIEF_META_NAME`), 자산 폴더의 `.genoffice-assets.json`은 사용자 문서에 들어 있는 데이터다. 이름을 바꾸면 이미 만든 문서의 가림과 개요, 자산 소유 기록을 읽지 못한다.
- 가림은 암호화가 아니고 "실수로 넘기는 것"을 막는다. 글자는 파일에 남고 쪽은 똑같이 그려지며 모델에게만 `{{label}}`이 나간다. 모델용 원문은 단순 문자열 치환으로 만들지 않는다. 줄 번호와 요소 id로 읽고 고치는 도구가 있으므로, 길이가 바뀐 구간의 위치를 양방향으로 옮겨 주는 투영을 유지한다. 모델의 편집은 표식 검사를 통과해야 원문에 들어간다.
- AI가 만들었거나 신뢰할 수 없는 HTML을 그리는 창은 적대적인 내용으로 취급한다. 숨은 창은 `sandbox: true`, preload 없음, IPC 없음이다. 인쇄용 창은 스크립트를 끈다(`javascript: false`). Word 내보내기용 창은 스크립트를 켠 채 `executeJavaScript`로만 몰고, 시간 제한(`HTML_EXPORT_TIMEOUT_MS`)이 지나면 창을 없앤다. 스크립트가 끝나지 않는 쪽이 숨은 창을 붙잡아 두지 못하게 한다.
- 미리 보기의 두 스킴(`html-preview`, `html-asset`)은 앱 준비 전에 프로세스당 한 번 등록한다. 렌더러 스킴과 한 목록으로 등록해야 하고(`registerPrivilegedSchemes`), shell도 앱 전체의 스킴을 이 함수 하나로 등록한다. 그러니 다른 곳에서 `registerSchemesAsPrivileged`를 또 부르지 않는다. 둘 다 secure로 등록한다. 아니면 미리 보기 문서의 스타일시트와 스크립트가 혼합 콘텐츠로 막힌다.
- 이 모듈이 갖는 AI 채널은 `html:ai-generate-image` 하나다. 호출할 때 `{ path: 'screen', statuses: sharedSubscriptionStatuses() }`를 넘기고 로컬 경로는 문서 폴더와 붙여 넣기 임시 폴더로 제한한다. 이 에디터는 가용성 보고를 미리 묻지 않는다. 경로가 없으면 도구가 `unavailable` 오류로 답한다.
- 구독 API의 채널 이름과 판독 함수는 `@genoffice/ai-provider/browser`의 것을 쓰고 사본을 만들지 않는다. 보내기 판단은 `useAiSendGate`만 쓴다. 다른 제공자로 저절로 넘어가는 코드를 넣지 않는다.
- 모델에게 주는 프롬프트에서 제품을 가리키는 이름은 `brandText`를 거친다(`tests/ai-prompts-brand.test.ts`가 확인한다). 크롬 색은 토큰만 쓴다. 미리 보기 안의 쪽은 문서 내용이라 토큰의 영향을 받지 않는다.

## 이 모듈의 방식

- 메인 코드는 shell 번들에 들어간다(`../../../html/src/main/html-main`을 상대 경로로 import한다). `src/main`을 고친 뒤에는 shell을 다시 빌드한다. 단독 실행 진입은 `will-quit`에서 `shutdownSubscriptionChildren`을 부른다.
- 쪽 전체 생성은 도구 호출이 아니라 `streamText`로 한다. 답의 본문이 곧 HTML이고, 글자가 오는 대로 미리 보기가 채워진다. 쪽 크기의 내용을 도구 인자로 받으면 JSON이 끝날 때까지 서버가 붙잡고 있어 중간 게이트웨이의 유휴 제한에 걸리고 빈 스트림으로 도착한다. `</html>` 전에 끊긴 답은 잘린 것으로 표시한다.
- 생성 전에 사용자와 합의한 개요(`Brief`)는 문서 머리의 meta 태그에 JSON으로 고정된다. 이후 편집과 다시 열기가 그것을 기준으로 삼는다. 빈 문서에서 고른 의도(디자인된 쪽 / 내용 쓰기)는 첫 생성에만 영향을 준다.
- 패널은 다른 에디터와 같은 부품으로 조립한다(`AiConnectPrompt`, `AiFirstConnectionNotice`, `AiBlockedNotice`, `aiRunErrorText`). 막힌 실행의 원인은 전송이 알려 준 구조화된 원인의 문장이 방금 실패한 문장과 같을 때만 쓴다(다르면 이전 스트림의 것이다).
- 기기 목록의 "인쇄 용지"는 같은 DOM을 인쇄될 쪽으로 나눠 보여 준다. 검사기가 미리 보기 사본의 루트를 쪽 내용 상자 높이의 다단으로 바꾸고(`column-height`, `column-wrap`), `print` 미디어 조건을 CSSOM에서 켜고, 강제 쪽 나눔을 단 나눔 규칙으로 옮긴다. 마크업은 건드리지 않으므로 편집 경로와 저장 파일은 그대로다. 프레임 너비는 쪽 내용 상자와 같아야 한다(인쇄에서 `vw`와 너비 미디어 조건의 기준이 그것이다). 그래서 용지의 좌우 여백은 호스트가 그리고(`styles.css`의 `data-device='paper'`), 용지 크기와 여백은 원문의 `@page`에서 읽는다(`document/page-setup.ts`).
- 인쇄 용지 보기 왼쪽의 쪽 축소판(`preview/PageRail.tsx`)은 PDF 내보내기가 쓰는 바로 그 PDF를 메모리로 받아(`html:print-preview`) pdf.js로 그린 것이다. 그래서 축소판에는 쪽 번호 꼬리말까지 인쇄 그대로 나온다. pdf.js는 축소판을 처음 그릴 때 불러온다.
- AI의 쪽 점검(`check_pages`, 그리고 `@page`가 있는 쪽을 새로 쓴 직후의 도구 결과)은 추측이 아니라 측정이다. 보이는 미리 보기와 별개의 프레임(`preview/page-probe.ts`)에 같은 사본을 용지로 배치해 재고, 프레임의 답은 `readPageMeasure`로 한 칸씩 확인한 뒤 `formatPageReport`가 sid와 쪽 번호의 문장으로 바꾼다. 측정하지 못하면 도구가 오류로 답하고 쪽수를 지어내지 않는다.
- 인쇄 대화 상자는 모달이다. `runGuardedPrint`가 대화 상자가 열려 있는 동안의 두 번째 인쇄 요청을 막는다.
- 문자열은 `src/renderer/i18n/`의 언어별 조각(`ai/`, `app/`)이고 `zh.ts`가 키 집합을 정한다. 21개 언어 모두에 넣는다. 구독 연결 문장과 AI 진입 이름은 `@genoffice/ui`의 것을 쓴다.

## 테스트

- 실행: `npm run test -w @genoffice/html`(또는 이 폴더에서 `npx vitest run`), `npm run typecheck -w @genoffice/html`. Windows에서 전부 통과한다.
- 편집 경로를 바꾸면 패치 집합의 검증(낡은 버전, 범위 밖, 겹침)과 "고치지 않은 원문이 글자 그대로인지"를 테스트한다.
- 가림을 바꾸면 세 가지 표시 각각에 대해, 줄 번호로 읽은 결과가 실제 줄과 맞는지, 가려진 구간을 가로지르는 치환, 쪼개진 표식이 거절되는지를 테스트한다(`tests/redact*.test.ts`).
- AI 배선(`tests/ai-connection.test.ts`, `tests/ai-panel-connection.test.ts`, `tests/subscription-bridge.test.ts`, `tests/subscription-client.test.ts`): 막힌 실행 판정, 핸들러가 없을 때의 상태, preload가 내보내는 구독 API. 이 모듈의 테스트는 제공자를 부르지 않는다.
- 미리 보기 스킴, 숨은 창의 내보내기, 실제 Word 결과는 단위 테스트로 확인되지 않는다. 빌드한 앱에서 확인한다.
