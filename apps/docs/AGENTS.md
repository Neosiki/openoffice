# apps/docs (`@genoffice/docs`)

Word 문서(.docx) 에디터다. 그리고 배포되는 앱 전체에서 공용 `ai:*` 채널에 응답하는 "AI 호스트"이기도 하다. 문서·PDF·Markdown·HTML 에디터는 물론, shell 안에서는 시트와 슬라이드의 AI 요청도 이 모듈의 핸들러를 지난다.

## 맡은 범위

- docx 편집 화면(`src/renderer/`): Tiptap 편집기와 확장(`editor/`), 쪽 나눔(`pagination*.ts`), 머리글·바닥글, 변경 내용 추적, 메모, 리본과 대화 상자(`components/`).
- 메인 프로세스(`src/main/docs-main.ts`): 창과 뷰 생성, 열기·저장·내보내기·인쇄, 암호화된 docx(`docx-encryption.ts`), 큰 문서의 지연 미디어(`lazy-media.ts`), 디스크의 외부 변경 감지(`external-change.ts`), 최근 파일과 별표(`starred-files.ts`).
- 공용 AI 핸들러 `registerAiIpc`: `ai:get-settings`, `ai:set-settings`, `ai:stream`, `ai:stream-cancel`, `ai:chat`, `ai:web-search`, `ai:image-search`, `ai:fetch-image`, `ai:tool-capabilities`, `ai:codex-models`, `ai:custom-models` 등과 구독 IPC 채널. 그 규칙은 Electron 없이 테스트되는 `src/main/ai-run.ts`에 있다.
- 문서 에디터의 AI 패널과 skill(`src/renderer/ai/`): `AiPanel.tsx`, `docs-skill.ts`, 도구(`tools.ts`, `*-ops.ts`), 편집 대기 카드(`edit-queue.ts`), 전송(`transport.ts`).
- 다른 에디터가 쓰는 문서 생성 흐름 `createAiDocument`(시트와 PDF의 AI가 새 docx·pdf·md를 만들 때 이 함수로 들어온다)와 프로젝트 IPC(`registerProjectIpc`).

## 맡지 않는 것 (경계)

- docx의 해석·조각 생성·바이트 단위 문단 패치는 이 모듈의 범위가 아니다. `packages/docx-engine`이 한다. 형식 문제를 렌더러나 메인에서 우회해 고치지 않는다.
- 프로바이더 선택 규칙과 구독 프로그램 실행은 `packages/ai-provider`, 검색·이미지·미디어 도구는 `packages/ai-search`, 에이전트 루프는 `packages/agent-core`, 보내기 규칙과 연결 카드·알림은 `packages/ui`의 범위다. 이 모듈은 그것들을 배선한다.
- 탭, 홈 화면, 설정 화면, 구독 프로그램의 종료와 잔여 프로세스 정리는 `apps/shell`의 범위다. `initSubscriptionChildTracking`은 단독 실행 진입(`startDocsStandalone`)에서만 부르고 `registerAiIpc` 안에서는 부르지 않는다.
- 시트·슬라이드·PDF·HTML에만 있는 AI 채널(`sheets:…`, `slides:…`, `pdf:…`, `html:…` 접두사)은 각 에디터가 등록한다.

## 항상 지켜야 하는 것

- 요청은 다른 프로바이더로 넘어가지 않는다. `ai:stream`과 `ai:chat`은 `resolveAiRun`으로 대상을 정하고, 실행할 수 없으면 어떤 프로바이더도 부르지 않고 원인(`errorCode`, `errorProvider`)이 담긴 오류 조각으로 답한다. `auto`는 `ready`인 구독으로만 풀리고, 돈이 드는 것(키 프로바이더, 종량제 로그인)은 저장된 선택일 때만 실행된다.
- 렌더러가 보낸 설정은 저장할 때도, 요청마다도 `sanitizeAiSettings`를 거친다. 설정의 `cliPath`는 프로세스 실행에, `baseUrl`은 API 키 전송에 쓰이므로 렌더러의 사본을 그대로 믿지 않는다. 설정 파일을 읽을 때는 항상 `normalizeAiSettings`를 거친다(`storedAiSettings`). 사라진 선택을 덮어쓰거나 "고쳐서 다시 쓰는" 코드를 `ai:get-settings`에 넣지 않는다.
- 구독 IPC는 `ensureSubscriptionIpc`로만 등록한다. 여러 에디터의 메인이 한 프로세스에서 돌고, 먼저 부른 쪽이 등록한다. 이 모듈이 넘기는 `setMeteredAccepted`는 정규화된 설정 전체를 원자적으로 쓰고(`withMeteredAccepted`) `ai:settings-changed`를 모든 창에 알린다.
- 오류 조각은 `aiStreamErrorChunk`로 만든다. `errorCode`·`errorProvider`·`errorResetsAt`이 빠지면 렌더러가 "막힌 실행" 알림 대신 날것의 문장을 보여 준다. 구독 사용량과 입력 축소는 `subscriptionStreamCallbacks`가 `subscription-usage`·`input-truncated` 조각으로 넘긴다. 입력이 줄었는데 알리지 않는 경로를 만들지 않는다.
- 이미지·미디어 도구에는 `screenToolContext()`(`{ path: 'screen', statuses: sharedSubscriptionStatuses() }`)를 넘긴다. 컨텍스트 없이 부르면 구독이 연결되지 않은 것으로 취급된다.
- AI 도구 호출에서 온 주소는 `fetchRemoteImage`와 크기 상한을 거친다(웹 검색 결과를 통한 프롬프트 주입이 가능한 값이다). 사설·링크 로컬 주소와 http(s)가 아닌 스킴은 거절된다.
- 문서 내용은 테마가 다시 칠하지 않는다. 어두운 쪽 표시(`src/renderer/editor/dark-page.ts`)는 화면 전용 변환이다. 작성된 색은 실제 인라인 선언으로 남고, 변환된 값은 `--dk-*` 사용자 정의 속성으로 덧붙여 `.workspace.page-dark` 아래의 화면 전용 규칙이 바꿔 칠한다. 쪽 나눔 미리 보기, 인쇄, PDF 내보내기, 클립보드 HTML은 두 테마에서 같은 결과여야 한다.
- 저장은 좁은 패치다. 원본 파일이 진실의 원천이고, 고친 블록만 OOXML 조각으로 바꿔 원래 `document.xml`에 끼워 넣으며, 손대지 않은 블록과 다른 zip 항목은 바이트 그대로 남는다. 열기·저장 경로를 바꾸면 손대지 않은 내용이 그대로 살아남는지 왕복 테스트로 증명한다.
- UI 크롬 색은 토큰만 쓴다(`var(--surface)` 등). 렌더러 CSS에 새 `#hex`·`rgb()`를 넣으면 `npm run check:theme-colors`가 실패한다. 강조색(`--accent` 계열)은 이 앱의 `styles.css`에서 정의한다.
- 모델에게 주는 system prompt에서 제품을 가리키는 이름은 `brandText(…, 'en')`을 거친다(`ai/protocol.ts`, `ai/doc-writer.ts`). HTTP 사용자 에이전트는 `PRODUCT_NAME`으로 만든다.

## 이 모듈의 방식

- 메인 코드는 shell 번들에 들어간다. shell이 `../../../docs/src/main/docs-main`을 상대 경로로 import하므로 `src/main`을 고친 뒤에는 shell을 다시 빌드해야 변경이 실행된다. 단독 실행(`src/main/index.ts` → `startDocsStandalone`)은 개발용이다.
- 채널 이름으로 소유를 구분한다. `ai:*`는 앱 전체가 공유하고 여기서 한 번 등록된다. 다른 에디터와 겹칠 수 있는 것은 `docs:` 접두사를 붙인다(`docs:analyze-media`, `docs:ai-generate-image`). 슬라이드가 같은 프로세스에서 자기 `ai:generate-image`·`ai:analyze-media`를 등록하기 때문이다.
- 스트림 중에는 5초 간격으로 `ping` 조각을 보낸다. 렌더러의 침묵 감시가 "느린 턴"과 "죽은 턴"을 구별하는 근거다. 렌더러가 사라지면 `abortOnDestroyed`가 요청을 끊는다.
- `ai:stream-cancel`은 그 id의 스트림과 함께, 보낸 창이 진행 중인 이미지 생성·미디어 분석 호출도 끊는다(`abortMediaCalls`). 도구가 실행되는 동안의 중단은 이미 끝난 턴의 id로 오기 때문에 호출을 창으로 찾는다. shell 안에서는 이 핸들러가 모든 에디터의 중단에 응답하므로, 이미지·미디어 핸들러는 어느 에디터의 것이든 `withMediaCallSignal`로 감싼다.
- 렌더러의 패널은 공용 부품으로 조립한다. 보내기는 `useAiSendGate`의 `admit`을 지나고, 연결이 없으면 `AiConnectPrompt`, 구독 첫 사용이면 `AiFirstConnectionNotice`(Codex가 진단 기록을 남길 수 있다는 문장을 켠 채로, `codexKeepsHistory`), 막힌 실행이면 `AiBlockedNotice`를 그린다. 전송은 `errorText: (cause) => aiRunErrorText(lang, cause)`를 넘겨 다른 에디터와 같은 문장을 쓴다. 구독 API는 preload가 `window.aiOfficeSubscription`으로 내보내고, 없거나 실패하면 상태는 `checking`으로 남는다.
- 문자열은 언어별 조각이다. `i18n/strings-ai.ts`·`strings-app.ts`·`strings-ribbon.ts`는 `i18n/<영역>/<lang>.ts`를 모으는 집계 파일이고 `zh.ts`가 키 집합을 정한다. 키를 추가하면 21개 조각 모두에 넣는다. 구독 연결 문장은 `@genoffice/ui`의 공용 문자열을 쓰고 여기에 복제하지 않는다. `useI18n()`의 `t`는 훅 의존성 배열에 넣지 않는다.
- `electron.vite.config.ts`의 `externalizeDepsPlugin`은 `dependencies`의 패키지를 번들 밖에 둔다. `@genoffice/*` 패키지는 TS 소스라 밖에 두면 실행 시 해석에 실패하므로, `dependencies`에 workspace 패키지를 추가하면 `exclude` 목록에도 넣는다.
- 문서 바이트는 IPC 응답이 아니라 미디어 프로토콜의 일회용 주소로 렌더러에 건넨다(`byte-handoff.ts`). IPC 직렬화가 버퍼를 통째로 복사해 1GB 파일에서 메인 프로세스가 죽었기 때문이다.

## 테스트

- 실행: `npm run test -w @genoffice/docs`(또는 이 폴더에서 `npx vitest run`), `npm run typecheck -w @genoffice/docs`. 환경은 `jsdom`이다. docx 픽스처가 필요한 테스트가 있으므로 처음 한 번, 그리고 `packages/docx-engine`을 바꾼 뒤에는 저장소 루트에서 `npm run fixtures`를 돌린다.
- `vitest.config.ts`는 workspace 패키지를 `node_modules`가 아니라 이 체크아웃의 소스 경로로 해석한다. 다른 체크아웃의 낡은 코드로 테스트되는 일을 막기 위해서다.
- AI 배선에서 바꾸면 반드시 테스트하는 것(`tests/ai-run.test.ts`, `tests/ai-subscription-panel.test.ts`): 연결되지 않은 요청이 프로바이더를 부르지 않고 원인과 함께 거절되는지, 오류 조각에 원인 필드가 실리는지, 사용량·입력 축소가 전달되는지, 설정 읽기가 정규화되는지.
- `claude-code`·`codex` 프로바이더로 가는 테스트는 브리지를 반드시 mock한다. 안 하면 실제 프로그램이 떠서 개발자의 구독 사용량을 쓴다.
- Windows에서 `tests/protect-dialog.test.ts`의 "setting a modify password…" 한 건은 변경과 무관하게 실패한다.
- 실제 화면(쪽 나눔, 인쇄 결과, 어두운 쪽)은 단위 테스트로 다 확인되지 않는다. 빌드한 앱에서 확인한다.
