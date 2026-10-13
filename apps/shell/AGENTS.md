# apps/shell (`@genoffice/shell`)

실제로 배포되는 앱이다. Electron 프로세스 하나, 창 하나에 홈 화면과 일곱 에디터를 탭(`WebContentsView`)으로 띄운다. 설치 프로그램에 들어가는 것은 이 앱뿐이고, 에디터들의 메인 프로세스 코드는 이 앱의 메인 번들 안에서 돈다.

## 맡은 범위

- 앱의 수명 주기(`src/main/index.ts`): 단일 인스턴스 잠금, userData 위치, 확장자에 따른 파일 라우팅, 탭별 메뉴 전환, 종료 처리, `--headless-export` 진입.
- 탭과 창: `src/main/tab-manager.ts`, 떼어 낸 창(`detached-windows.ts`), 닫기 확인(`window-close-guard.ts`), 렌더러 자원 감시(`renderer-watchdog.ts`).
- 홈 화면과 설정(`src/renderer/src/`): `Home.tsx`, `Onboarding.tsx`, `SettingsModal.tsx`, AI 설정 `SettingsAiSection.tsx`·`settings-ai.ts`, 통합 탭 `IntegrationsPane.tsx`, 별표 파일에 묻는 `KbAskPanel.tsx`, 앱 안 도움말(`i18n/help/`).
- 파일 색인과 지식 기반(`src/main/file-index/`, `knowledge-base.ts`), 최근 파일, 폴더 트리.
- 자동 업데이트(`updater.ts`, `update-window.ts`, `update-resume.ts`)와 패키징 설정 `electron-builder.cjs`.
- 외부에서 들어오는 입구: 앱 안 MCP 서버(`src/main/mcp/`), 명령줄용 제어 채널(`control-server.ts`), 열린 문서 목록 게시(`open-documents.ts`), 명령줄 PATH 연결과 실행기 위치 기록(`cli-link.ts`), 스킬·MCP 등록 IPC(`integrations-ipc.ts`).
- 기본 앱 등록과 파일 연결(`default-app.ts`).

## 맡지 않는 것 (경계)

- 문서 편집과 형식별 저장·내보내기는 이 모듈의 범위가 아니다. 각 에디터(`apps/docs`, `apps/sheets`, `apps/slides`, `apps/pdf`, `apps/markdown`, `apps/html`, `apps/hwp`)가 한다. shell은 그 메인 모듈의 내보낸 함수(`createDocsView`, `configureSheetsRuntime` 등)를 부른다.
- AI 요청의 실행은 범위가 아니다. `ai:*` 채널과 구독 IPC 채널은 `apps/docs/src/main/docs-main.ts`의 `registerAiIpc`가 등록한다. shell은 그것을 한 번 호출할 뿐이고, AI와 관련해 직접 응답하는 채널은 `home:open-subscription-install-help`(벤더의 설치 안내 페이지 열기)와 `ai:open-model-settings`(홈 탭의 설정 화면 열기)뿐이다.
- 제공자 선택 규칙, 구독 프로그램 실행은 `packages/ai-provider`, 연결 카드와 알림 컴포넌트는 `packages/ui`의 범위다.
- 명령줄과 그 MCP 서버의 구현은 `packages/cli`의 범위다. 앱 안 MCP 서버의 창 없는 도구들은 그 명령줄을 프로세스로 실행해 결과 봉투를 옮길 뿐, 문서 엔진을 다시 구현하지 않는다(`src/main/mcp/cli-runner.ts`).
- 제품 이름과 저장소 좌표의 정의는 `packages/i18n/src/product.ts`의 범위다.

## 항상 지켜야 하는 것

- 구독 프로그램을 끝내는 책임은 이 프로세스에 있다. `src/main/index.ts`는 `app.whenReady` 뒤 userData 경로가 확정된 다음 `initSubscriptionChildTracking(app.getPath('userData'))`를 한 번 부르고(강제 종료된 이전 실행이 남긴 프로세스를 정리하고 이번 실행의 기록을 시작한다), `will-quit`와 `process.on('exit')` 양쪽에서 `shutdownSubscriptionChildren()`을 부른다. `app.exit()`·`process.exit()`은 `will-quit`를 건너뛰므로(headless 내보내기가 그렇게 끝난다) 둘 중 하나만으로는 부족하다. 에디터 코드에서 `initSubscriptionChildTracking`을 또 부르지 않는다.
- 구독 IPC 채널(`SUBSCRIPTION_IPC_CHANNELS`)을 shell에서 등록하지 않는다. 같은 채널을 두 번 등록하면 예외가 난다. preload는 채널 이름과 판독 함수를 `@genoffice/ai-provider/browser`에서 가져와 `window.aiOfficeSubscription`으로 내보낸다. 핸들러가 없으면 상태는 `checking`으로 읽힌다.
- preload는 로그인·설치 실패의 원문 오류를 렌더러에 넘기지 않는다(`subscriptionLaunchResultOf`). 실행 파일 경로가 들어 있을 수 있어서다. 화면은 번역된 일반 문장을 쓴다.
- PC에 등록되는 이름은 이 제품의 것이고 원본 GenOffice와 겹치지 않는다. 앱 id `io.github.pblsketch.ieumoffice`, 제품 이름 `IeumOffice`, 패키징된 앱 이름 `ieumoffice`(업데이트 캐시 폴더 이름이 여기서 나온다), userData는 설치본 `<appData>/IeumOffice`, 패키징되지 않은 실행 `<appData>/IeumOffice-Dev`다. 원본 앱의 프로필 폴더를 물려받거나 읽지 않는다. `electron-builder.cjs`의 상수, `package.json`의 `productName`, `packages/i18n`의 상수는 서로 같아야 한다.
- 원본이 PC에 등록한 것(`genoffice` 명령, `~/.genoffice`, 원본의 MCP 항목과 스킬 폴더)은 건드리지 않는다. 실행기 위치 기록은 `~/.ieumoffice/launcher`에만 쓴다.
- 패키징되지 않은 실행은 설치본과 userData·단일 인스턴스 잠금을 공유하지 않는다. 공유하면 개발 실행이 조용히 종료되면서 인자를 설치된 앱으로 넘겨 버린다. 테스트 드라이버는 `GENOFFICE_USER_DATA`로 임시 폴더를 지정한다.
- headless 진입은 모듈 최상위에서 처리한다. `parseHeadlessExportArgv`와 `setHeadlessMode(true)`가 에디터 모듈이 무엇이든 등록하기 전에 실행되어야 한다. 구독 상태 확인은 첫 `statuses` 요청 때 시작하므로 headless 실행은 벤더 프로그램을 띄우지 않는다. 이 순서를 깨는 "시작 시 미리 확인"을 넣지 않는다.
- 업데이트는 이 제품의 공개 저장소의 GitHub Releases에서만 받는다. 저장소는 `electron-builder.cjs`의 `publish`에서 `app-update.yml`로 구워지고, 빌드 시 주입되는 값이나 토큰이 없다. 확인 실패(릴리스 없음, 네트워크 없음)는 조용히 넘긴다. 설치 프로그램은 서명하지 않는다.
- 앱 안 MCP 서버와 제어 채널은 로컬 전용이다. MCP 서버는 루프백에만 바인드하고 Host 헤더를 검사한다(인증이 없으므로). 제어 채널은 userData의 소켓·명명된 파이프와 실행마다 새로 만든 토큰을 쓰고, 명령은 "이 위치를 보여 줘"와 "선택을 읽어 줘"뿐이다. 요청으로 파일을 쓰거나 코드를 실행하는 명령을 추가하지 않는다.
- 스킬과 MCP 등록은 통합 탭에서 사용자가 누를 때만 쓴다. 시작 시 자동으로 에이전트 설정 파일을 고치지 않는다.
- "GenOffice를 기반으로 합니다" 고지(문자열 키 `setBasedOn`, 값에 `{{GenOffice}}`)는 21개 언어 모두에 남긴다. 원본 이름이 화면에 나오는 곳은 이 한 줄뿐이어야 한다. 다른 문자열과 도움말 제목·본문에 `{{GenOffice}}`를 쓰면 `tests/product-identity.test.ts`가 실패한다.
- 없앤 기능(사용 통계 전송, 자체 계정 로그인, 클라우드 프로젝트 목록 등)의 모듈·IPC·호출부를 되살리지 않는다. `tests/removed-features.test.ts`가 지킨다. 원본의 변경을 병합할 때 특히 본다.
- 모든 창은 `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`다. `shell.openExternal`은 `safeExternalUrl`을 거친 값만 받는다.

## 이 모듈의 방식

- 에디터의 메인 코드는 패키지가 아니라 상대 경로로 가져온다(`../../../docs/src/main/docs-main`). `electron.vite.config.ts`는 메인에 대해 아무것도 외부화하지 않고 전부 한 번들로 묶는다. 그래서 `apps/*/src/main`을 고친 뒤에는 shell을 다시 빌드해야 한다. 안 하면 변경이 조용히 실행되지 않는다. 렌더러와 preload는 각 에디터의 빌드 결과(`apps/<앱>/out`, 패키징 시 `resources/modules/`)에서 불러오므로 그쪽도 먼저 빌드되어 있어야 한다(`npm run shell`은 `build:all` 뒤에 실행한다).
- 개발 모드에서 preload를 고쳤으면 다시 빌드한다. 낡은 preload는 렌더러를 빈 화면으로 만든다(`npm run dev`의 `predev`가 `tools/build-stale-preloads.mjs`를 돌린다).
- 에디터는 `configure<앱>Runtime({ preloadPath, rendererUrl, rendererFile, … })`으로 자기 빌드 결과의 위치를 주입받는다. 공용 `ai:*` 핸들러는 `registerAiIpc()` 한 번으로 모든 창(문서, 시트, 홈)을 담당한다. 시트 뷰를 `createSheetsView({ includeAiHandlers: false })`로 만드는 이유다.
- 설정 화면에서 쓰는 AI는 "사용할 AI" 선택 하나로 정해진다. 고급 영역의 제공자 드롭다운은 어느 제공자의 입력란을 보여 줄지만 고른다. 설정은 읽을 때(`readAiSettings`)와 쓸 때(`writeAiSettings`) 모두 `normalizeAiSettings`를 거쳐, 사라진 선택이 다시 저장되지 않는다.
- 홈의 질문 패널은 에디터와 같은 보내기 규칙을 작은 사본(`askSendGate`, `src/renderer/src/kb-ask-connection.ts`)으로 갖는다. 첫 연결 안내은 홈 화면이 띄우고 패널은 그동안 보내지 않는다. `packages/ui`의 규칙을 바꾸면 이 사본도 맞춘다.
- 첫 연결 안내의 Codex 문장은 `CODEX_MAY_KEEP_HISTORY`로 켜져 있다. 브리지가 대화 이력 파일은 끄지만 Codex가 자체 진단 로그를 남기고, 앱은 그것을 읽을 수도 막을 수도 없기 때문이다.
- 문자열은 세 군데에 있다. 렌더러 사전 `src/renderer/src/strings.ts`(언어 21개가 한 파일에 있고 `zh`가 키 집합을 정한다), 메인 프로세스의 인라인 사전(`src/main/index.ts`의 `tMain`), 도움말 `i18n/help/topics/<id>.<lang>.md`. 도움말 항목은 `help-registry.ts`의 `HELP_TOPICS`에 등록해야 보이고, 모든 언어 파일의 구조는 영어 원본과 같아야 한다(`npm run check:help-langs`).
- 렌더러 CSS의 크롬 색은 토큰만 쓴다(`npm run check:theme-colors`). shell의 강조색(`--accent` 계열)은 `src/renderer/src/home.css`에서 정의한다.
- 패키징은 저장소 루트에서 한다: `npm run dist:win -- -- --publish never`. `--`가 두 번 필요하고, `--publish never`가 없으면 electron-builder가 업로드를 시도한다. xlsx 사이드카는 `target/x86_64-pc-windows-gnu/release/`에 있어야 하므로 Windows에서 MSVC로 빌드했다면 `target/release/xlsx-sidecar.exe`를 그리로 복사한다. OCR 도우미 컴파일에는 Windows SDK가 필요하다. Windows만 빌드·검증하며 Linux 패키징에는 원본의 이름이 남아 있다.

## 테스트

- 실행: `npm run test -w @genoffice/shell`(또는 이 폴더에서 `npx vitest run`), `npm run typecheck -w @genoffice/shell`. 환경은 `node`다.
- `src/main/index.ts`는 실행 중인 Electron이 있어야 불러올 수 있다. 그래서 배선은 소스 글자를 읽어 고정한다(`tests/subscription-lifetime.test.ts`, `tests/main-locale-tables.test.ts`). 종료 처리나 인라인 사전의 모양을 바꾸면 이 테스트들이 깨진다. 로직은 Electron을 import하지 않는 모듈로 빼서 테스트한다(`settings-ai.ts`, `kb-ask-connection.ts`, `app-routing.ts`).
- 바꾸면 반드시 테스트하는 것: preload가 내보내는 구독 API(핸들러 없음, 깨진 답), 설정 저장 뒤 다시 읽은 값, 제품 정체성(`tests/product-identity.test.ts`: 빌더 설정·`package.json`·HTML 제목·ProgId·저장소 좌표의 일치), 업데이트 피드 설정, 탭 IPC의 인자 검증.
- Windows에서 변경과 무관하게 실패하는 테스트: `tests/headless-export.test.ts`(16건, `/docs/a.docx` 같은 POSIX 경로를 전제로 한다)와 `tests/default-app.test.ts`의 Linux 사례 한 건. `tests/update-resume.test.ts`와 `tests/third-party-notices.test.ts`는 부하가 큰 PC에서 가끔 실패하므로 단독으로 다시 돌려 확인한다.
- E2E(`npm run test:e2e`, 저장소 루트의 `e2e/`)는 전체 빌드가 필요하다. 실행기(`e2e/helpers.ts`)는 `ai-settings.json`에 `{ providers: {}, subscriptionNoticeSeen: true }`를 미리 써서, Claude·Codex에 로그인된 PC에서 첫 연결 안내이 화면을 가리지 않게 한다(`providers`가 없으면 파일 전체가 기본값으로 읽힌다).
- 실제 릴리스에서의 업데이트 내려받기·설치, 설치 프로그램 자체는 자동 테스트로 확인하지 못한다. 실제 빌드로 확인한다.
