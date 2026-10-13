# packages/ai-provider (`@genoffice/ai-provider`)

모델에게 한 턴을 맡기는 계층이다. 사용자가 PC에 설치해 로그인해 둔 Claude Code·Codex 프로그램을 "한 턴짜리 두뇌"로 띄우는 브리지와, 사용자가 직접 고른 API 키 프로바이더의 HTTP 프로토콜을 한 계약으로 묶는다.

## 맡은 범위

- 프로바이더 카탈로그와 설정: `AI_PROVIDERS`(`src/providers.ts`), 어댑터 표 `AI_PROVIDER_ADAPTERS`(`src/registry.ts`), 저장 파일 정규화 `normalizeAiSettings`(`src/legacy-settings.ts`), 렌더러가 보낸 설정 검사 `sanitizeAiSettings`(`src/ai-settings-guard.ts`).
- 어느 프로바이더로 실행할지: `selectAiProvider`·`subscriptionConnection`(`src/provider-selection.ts`). 순수 함수이며 렌더러(무엇을 보여 줄지)와 메인(무엇을 실행할지)이 같은 함수를 쓴다.
- 한 턴 라우팅: `streamForProvider`(`src/stream.ts`), `chatForProvider`(`src/chat.ts`), 실패의 기계 판독 원인 `AiRunError`·`aiStreamErrorFields`(`src/run-error.ts`).
- 구독 프로그램 공통 계층 `src/subscription/`: 실행 파일 찾기(`locate.ts`), 환경(`env.ts`), 시작·종료와 자식 등록부(`process.ts`), 강제 종료 뒤 정리(`leftovers.ts`), 연결 상태(`status.ts`, `service.ts`), 종량제 로그인 동의(`metered.ts`), 로그인·설치 창(`launch.ts`), IPC 계약과 메인 측 핸들러(`contract.ts`, `ipc.ts`).
- 두 브리지 `src/claude-code-cli.ts`, `src/codex-app-server.ts`와 키 기반 이미지·미디어 프로토콜(`src/media.ts`, `src/media-protocols.ts`, `src/image-backend.ts`).

## 맡지 않는 것 (경계)

- 도구 실행과 에이전트 루프는 이 모듈의 범위가 아니다. 브리지는 모델이 "요청한" 호출을 `onToolCall`로 넘길 뿐이고, 실행은 `packages/agent-core`의 루프와 각 에디터의 skill이 한다.
- 웹·이미지 검색, `generate_image`/`analyze_media` 도구, 화면 경로와 자동 호출 경로의 구분, 시간당 한도 장부는 `packages/ai-search`의 범위다. 여기에는 그 판단에 쓰이는 순수 함수(`resolveImageBackend`)만 둔다.
- 사용자에게 보이는 문장과 연결 카드·알림 컴포넌트는 `packages/ui`의 범위다. 이 모듈이 만드는 오류 문장은 영어 예비 문구이고, 화면은 `AiRunErrorKind`와 `subscriptionStatusErrorKind`로 번역한다.
- Electron을 import하지 않는다. `ipcMain`은 `SubscriptionIpcMain` 모양으로 주입받고, 어느 앱의 메인이 등록할지·설정 파일을 어디에 쓸지는 `apps/*/src/main`이 정한다.
- 벤더 프로그램 자체는 고치거나 감싸지 않는다. 앱 안에 Claude·ChatGPT 로그인 폼을 만드는 일도 범위 밖이며 하지 않는다.

## 항상 지켜야 하는 것

- 로그인 정보(`~/.codex/auth.json`, Claude 자격 증명 저장소, 세션 토큰)를 읽거나 복사하거나 저장하지 않는다. 테스트와 디버깅에서도 같다. 연결 상태는 프로그램 자신의 답(`claude auth status --json`, `codex login status`, app-server의 `account/read`)으로만 판단한다.
- 프로그램이 출력한 글자는 상태·파일·로그 어디에도 복사하지 않는다. 출력은 `status.ts`가 나열한 값(`SUBSCRIPTION_LOGIN_KINDS`)과 대조만 하고, 모르는 값은 고정 토큰 `unknown`이 된다. 계정 이메일은 `codexAccountInfo`에서 버리고, 요금제 이름만 식별자 모양일 때 통과시킨다. "알려진 패턴을 지우는" 방식으로 바꾸지 않는다(예상 밖 형식의 출력에서 조직 이름이 새어 나간다).
- 구독 프로그램은 `spawnSubscriptionProgram`·`runSubscriptionProgram`으로만 시작한다. 찾아낸 실제 실행 파일 경로와 인자 배열로 시작하고 셸을 거치지 않는다. Windows의 npm `.cmd` shim은 직접 실행하지 않고 그 뒤의 실제 프로그램을 찾는다(`locate.ts`). 예외는 설치 버튼이 보이는 터미널에서 실행하는 고정 문자열 `SUBSCRIPTION_INSTALL_COMMANDS` 하나뿐이다.
- 사용자가 입력했거나 문서에 들어 있는 글자를 명령줄에 올리지 않는다. 프롬프트·대화·이미지는 stdin으로 보낸다. Claude 명령줄에 올라가는 가변 값은 `MODEL_NAME` 정규식을 통과한 모델 이름뿐이고, 로그인 창 스크립트(`LOGIN_WINDOW_SCRIPT`)는 상수이며 경로는 환경 변수 두 개로 값으로만 전달된다.
- 자식 환경은 `subscriptionChildEnv`로 만든다. `SUBSCRIPTION_STRIPPED_ENV_VARS`(API 키, base URL, 클라우드 플랫폼 스위치 등 구독에서 다른 과금 경로로 옮기는 변수)를 뺀 사본이며 `process.env`는 고치지 않는다. Windows에서는 변수 이름의 대소문자를 구분하지 않고 지운다. `CLAUDE_CODE_OAUTH_TOKEN`은 지우지 않는다. 그 로그인은 상태 확인에서 `unknown`으로 읽혀 `metered`가 된다.
- 사용자 설정·hook·plugin·MCP를 실행에 들이지 않는다. Claude는 `claudeCodeCliLaunchArgs`의 고정 플래그(`--tools ""`, `--restricted`, `--strict-mcp-config`, `--setting-sources ""`, `--disable-slash-commands`, `--no-session-persistence`)와 실행마다 새로 만든 빈 임시 폴더를 쓴다. `--bare`는 쓰지 않는다(구독 로그인을 읽지 못한다). `--json-schema`도 쓰지 않는다(`StructuredOutput` 도구가 세션에 추가되어 아래 0-도구 규칙이 깨진다). 스키마는 지시문으로 주고 답은 `parseClaudeCodeTurn`이 검증한다.
- Claude 턴은 프로그램이 도구 0개를 보고했을 때만 진행한다. `init` 이벤트의 `tools`가 빈 배열이고 `mcp_servers`가 없어야 `verified`가 되고, 그 전에 도착한 답, 도구 블록, `can_use_tool` 권한 요청은 모두 `unsafe-tools`로 프로세스 트리를 끝낸다. 플래그를 믿지 않고 보고를 확인하는 구조이므로 플래그를 추가했다고 이 확인을 빼지 않는다. 한계도 있다. Claude Code는 첫 메시지를 stdin으로 받은 뒤에야 도구 목록을 알리므로 확인은 그 시점에 이뤄지고, 실패하면 모델의 출력은 하나도 쓰지 않지만 Windows의 트리 종료는 비동기다.
- Codex에는 사용자 `config.toml`을 통째로 무시하는 스위치가 없다. 그래서 `CODEX_CONFIG_OVERRIDES`로 하나씩 덮고(`-c features.<name>=false`를 쓴다. `--disable` 뒤에 모르는 이름이 오면 Codex가 시작하지 못한다), MCP 서버는 스레드마다 `codexMcpServerOverrides`로 끈 뒤 `mcpServerStatus/list`로 실제로 꺼졌는지 확인한다. 확인할 수 없는 스레드는 안전하지 않은 것으로 보고 `unsafe-tools`로 끝낸다. 모델도 항상 명시한다(`defaultModelFor`). 비워 두면 Codex가 사용자 설정 파일의 모델을 쓴다. 덮지 못하는 것도 있다. Codex 홈 폴더(`~/.codex/`)의 사용자 지침 파일은 Codex가 여전히 대화에 넣고, Codex 자체의 진단 로그는 앱이 끄지 못한다.
- Codex 실행 직전에 로그인을 한 번 더 본다(`assertRunnableAccount`). 로그아웃됐으면 `signed-out`, 상태 확인이 마지막으로 본 것과 다른 종류의 종량제 로그인으로 바뀌어 있으면 `metered-not-accepted`로 멈춘다. 사용자가 동의한 것은 "그때 그 로그인"이기 때문이다.
- `auto`는 `ready`인 구독만 고른다. 순서는 `AI_SUBSCRIPTION_PROVIDERS`(Claude 다음 Codex)이고, 키 프로바이더와 종량제 로그인은 후보가 아니다. `ready`는 로그인 방식이 `subscription`일 때만이고 알 수 없는 로그인은 `metered`다. 종량제 로그인은 설정의 `meteredAccepted[provider]`와 상태의 `meteredAccepted`가 둘 다 참일 때만 쓴다(로그인이 바뀐 뒤 남은 플래그로 유료 실행이 시작되지 않게).
- 막힌 실행은 멈춘다. 명시적으로 고른 프로바이더가 실행될 수 없으면 `connected: false`와 원인을 돌려주고, 브리지는 `AiRunError`를 던진다. 어느 쪽도 다른 프로바이더로 스스로 넘어가지 않는다. `streamForProvider`에 `auto`를 넘기면 `Unknown provider: auto`로 실패한다. 호출자가 먼저 `selectAiProvider`로 풀어야 한다.
- 앱이 띄운 자식은 앱보다 오래 살지 않는다. 취소는 `killProcessTree`(Windows에서는 System32의 `taskkill.exe`를 전체 경로로 불러 `/T /F`), 종료는 동기 함수 `shutdownSubscriptionChildren`, 강제 종료된 뒤의 다음 시작은 `initSubscriptionChildTracking`이 `subscription-children-<앱 pid>.json` 기록을 읽어 pid·프로그램 파일·시작 시각이 모두 맞는 프로세스만 끝낸다. 사용자가 직접 띄운 claude·codex는 기록에 없으므로 건드리지 않는다.
- 입력을 말없이 자르지 않는다. Claude 브리지가 줄이는 것은 이미지 100장(`MAX_CLAUDE_CODE_IMAGES`) 초과분뿐이고, 오래된 것부터 빼며 반드시 `onInputTruncated`를 부른다. 글자는 자르지 않는다.
- 구독 IPC 채널은 프로세스당 한 번, `ensureSubscriptionIpc`로만 등록한다. 패키징된 앱은 여러 에디터의 메인 코드가 한 프로세스에서 돌고 같은 채널을 두 번 등록하면 예외가 나므로 `registerSubscriptionIpc`를 앱에서 직접 부르지 않는다. 등록은 상태 확인을 시작하지 않는다. 첫 `statuses` 요청이 첫 확인을 시작하므로, AI를 보여 주지 않는 프로세스(headless export 등)는 벤더 프로그램을 띄우지 않는다.

## 이 모듈의 방식

- 브리지는 "한 턴짜리 두뇌"다. 앱의 system prompt, 지금까지의 대화, 앱 도구 목록, 응답 JSON Schema를 주고 `{ text, toolCalls }` 객체 하나를 받는다. Claude는 턴마다 새 프로세스를 띄우고 끝나면 스스로 나가게 둔다(stdin을 닫고 5초 뒤에도 남아 있으면 트리 종료). Codex는 app-server 프로세스를 실행들이 공유하고 쓰는 실행이 없으면 끝낸다.
- Claude 턴은 매번 대화 전체를 사용자 메시지 하나로 다시 읽는 새 세션이다. 그래서 마지막 이벤트가 도구 결과이면 `AFTER_TOOL_RESULTS` 문단을 이벤트 블록들 뒤에 붙인다. 작은 모델이 첫 사용자 요청에 다시 답하며 이미 실행된 호출을 또 요청해, 문단 하나가 네 번 삽입된 일이 있었다. 이 문단은 반드시 이벤트 뒤에 둔다(앞선 턴의 블록이 이번 턴의 접두사로 남아야 프롬프트 캐시가 맞는다).
- 도구 호출 id는 브리지가 붙인다(`claude-<uuid>`). 세션이 매번 새것이라 모델이 고유성을 지킬 수 없다. 목록에 없는 도구 이름은 실행하지 않고 `inputError`를 달아 루프로 넘긴다.
- 루프와 문자열로 맺은 계약이 둘 있다. 오류 문장 끝의 `(empty stream)`은 "아무것도 전달되지 않았으니 같은 턴을 다시 보내도 된다", `while sending tool arguments`는 "도구 호출이 전달되지 않았으니 한 번 재시도한다"는 뜻이며 `packages/agent-core/src/loop.ts`가 이 글자를 찾는다. 문구를 고치면 재시도가 조용히 사라진다.
- 상태는 한 방향으로 흐른다. `detectSubscriptionLogin` → `createSubscriptionStatusService`(저장된 종량제 동의와 대조) → `ensureSubscriptionIpc`가 `SUBSCRIPTION_IPC_CHANNELS` 응답과 `changed` 방송 → preload는 `@genoffice/ai-provider/browser`의 채널 이름과 판독 함수(`subscriptionStatusMapOf`, `subscriptionLaunchResultOf`, `subscriptionMeteredResultOf`)로 읽는다. 핸들러가 없거나 답이 깨졌으면 연결이 아니라 `checking`으로 읽힌다. 실행 실패의 spawn 오류 문장은 실행 파일 경로를 담을 수 있어 판독 함수에서 버린다.
- `error` 상태의 문장은 `"<kind>: <코드에 적힌 영어 문장>"` 형식이다. 화면은 `subscriptionStatusErrorKind`로 종류만 읽어 번역한다.
- 종량제 동의는 불리언만으로는 "그때 그 로그인"인지 알 수 없고, 누가 로그인했는지는 저장하면 안 된다. 그래서 동의한 로그인의 종류만 `subscription-metered.json`에 남긴다. 값은 `METERED_LOGIN_FINGERPRINTS` 상수 중 하나이고 프로그램 출력으로 조립하지 않는다. 종류가 바뀌거나 로그아웃하면 동의가 지워진다.
- 설정을 읽는 문은 둘이다. 디스크의 파일은 `normalizeAiSettings`(절대 throw하지 않고, 모르는 id는 기본값으로 떨어진다), 렌더러가 보낸 값은 `sanitizeAiSettings`(모르는 프로바이더 id면 `null`). 설정 파일의 `cliPath`는 spawn으로, `baseUrl`은 API 키와 함께 나가므로 렌더러 값을 검사 없이 쓰지 않는다.
- 키 프로바이더를 추가하려면 `AiProviderId`(`src/types.ts`)에 id, `AI_PROVIDERS`에 메타, `AI_PROVIDER_ADAPTERS`에 어댑터를 넣는다. 표가 `Record<AiProviderId, …>`라 하나라도 빠지면 타입 오류다. 이미지 입력을 못 받는 모델 id는 `modelLacksVision`에 함께 넣는다.
- 진입점을 가려 쓴다. 렌더러와 preload는 `/browser`만 import한다(`contract.ts`가 타입만 import하는 이유다). `/subscription`, `/claude-code-cli`, `/codex-app-server`는 Node 전용이다. `/codex-image`는 비어 있고 `codexImageGenerationAvailable()`은 어느 프로세스에서도 `false`다. 이미지 생성은 지금 키 기반뿐이다.

## 테스트

- 실행: `npm run test -w @genoffice/ai-provider`(또는 이 폴더에서 `npx vitest run`), `npm run typecheck -w @genoffice/ai-provider`.
- 어떤 테스트도 실제 `claude`·`codex`에 닿으면 안 된다. 닿으면 개발자의 구독 사용량이 소모된다. 주입 지점을 쓴다: `ClaudeCodeCliDeps`(`spawn`, `resolveProgram`, `registry`, `killTree`), `setCodexAppServerRuntime`, 상태 확인의 `locate`·`run`·`detect`, IPC의 `resetSharedSubscriptionIpc`. 라우터 테스트는 `vi.mock('../src/claude-code-cli')`로 브리지를 통째로 바꾼다.
- 바꾸면 반드시 테스트하는 것: 시작 인자(플래그 하나가 빠지면 사용자 hook·MCP가 들어온다), 환경에서 지우는 변수 목록, 0-도구 확인의 모든 거절 경로, 상태 파서에 "예상과 다른 형식"의 출력을 넣었을 때 계정 정보가 상태·오류 문장·동의 파일 어디에도 남지 않는지(`tests/subscription-identity.test.ts`), `selectAiProvider`가 돈이 드는 경로를 스스로 고르지 않는지.
- 경계 사례: 재전송된 답(`message_start`가 두 번 오면 이미 내보낸 글자를 건너뛴다), `max_tokens`로 잘린 구조화 답, 코드 펜스로 감싼 JSON, 개행 없이 4MB를 넘는 줄, pid 재사용(시작 시각이 다르면 건드리지 않는다), 손상된 동의 파일.
- Windows에서 `tests/ai-settings-guard.test.ts`의 "keeps Windows-style paths with spaces and non-ASCII" 한 건은 변경과 무관하게 실패한다(임시 폴더 아래에 `C:\…` 경로를 이어 붙여 파일을 만들려다 ENOENT).
- 실제 프로그램에 대한 확인(플래그가 버전에서 유효한지, 실제 한도 이벤트의 모양)은 사용자 구독을 쓰므로 자동 테스트에 넣지 않는다. 최소 지원 버전은 `SUBSCRIPTION_MIN_VERSIONS`에 있고, 플래그를 추가하면 그 값도 함께 본다.
