# 바깥에 내놓는 약속

이 프로그램을 밖에서 쓰는 쪽은 다섯이다. 터미널 명령어를 부르는 스크립트와 에이전트, 명령어 쪽 MCP 클라이언트, 앱 안 MCP 서버에 붙는 클라이언트, 사용자의 설정 파일, 그리고 원본 프로그램과 주고받는 문서.

## 공통

- 모든 바깥 이름은 `ieumoffice`다. 명령어, MCP 등록 이름, 에이전트 스킬 이름과 폴더, 홈 폴더 아래 `.ieumoffice`.
- 원본이 쓰는 이름(`genoffice` 명령어, `~/.genoffice`, `genoffice` 연동 항목과 스킬 폴더)은 읽지도 쓰지도 않는다. 두 프로그램은 한 PC에 함께 있을 수 있다.
- 문서 명령은 PC 안에서 끝난다. 밖으로 무언가를 보내는 명령은 `search`, `image`, `media` 셋뿐이다.

## 터미널 명령어 `ieumoffice`

**부르는 법.** 설치본은 명령어 폴더(`<설치 폴더>\resources\cli`)를 사용자 PATH에 넣는다. PATH에 없어도 `~/.ieumoffice/launcher`에 그 폴더의 위치가 적혀 있다. 전체 명령 목록은 `ieumoffice help`.

**출력.**

- 기본은 사람이 읽는 한 줄 요약이다. `--json`을 주면 JSON 객체 하나를 낸다.
- 성공: `{ status, command, summary, output_path?, warnings?, detail? }`. `status`는 `ok` 또는 `partial`이다. `partial`은 파일은 썼지만 묶음 안의 일부 편집이 빠졌다는 뜻이고, 빠진 것은 `detail.batch`·`detail.failures`에 있다. `warnings[]`는 `{ code, message, suggestion? }`이고, 성공했지만 알려 둘 것이 있을 때 온다.
- 실패: `{ status: "error", command, code, error, message, suggestion?, detail? }`. `command`는 명령을 알아내지 못했으면 `null`이다. `code`는 종료 코드, `error`는 바뀌지 않는 영어 소문자 이유(`unknown_op`, `target_not_found`, `out_of_range`, `sheet_not_found`, `file_open_in_gui`, `app_unavailable` 등)다. 다시 시도하는 데 필요한 사실(유효한 범위, 쓸 수 있는 식별자, 시트 이름, 사용법)은 `message` 안이 아니라 `detail`의 항목으로 온다.

**종료 코드.** `0` 성공, `1` 사용법 오류, `2` 파일 문제, `3` 변환 실패, `4` 앱이나 필요한 경로를 쓸 수 없음.

**파일 규칙.**

- `GENOFFICE_ALLOWED_ROOTS`가 있으면 그 폴더들 밖의 파일은 읽지도 쓰지도 않는다. 심볼릭 링크는 풀어서 본다. 벗어나면 종료 코드 2와 `detail.allowed_roots`.
- 이미 있는 다른 파일 위에 쓰려면 `--force`가 필요하다. 제자리 편집에는 필요 없다. 모르는 옵션은 무시하지 않고 거절한다.
- 앱의 탭에 열려 있는 파일은 제자리에서 고치지 않는다(종료 코드 2, `detail.gui_pid`). `--force`면 쓴다.
- 실행한 명령마다 `~/.ieumoffice/cli-audit.jsonl`에 한 줄을 남긴다(`ts`, `pid`, `command`, `argv`, `status`, `code`, `output_path`, `ms`, `cwd`). 2MB에서 돌린다.

## `search` · `image` · `media`와 `capabilities`

이 셋은 자동 호출이다. 화면을 보는 사람이 없는 요청이므로 갈 수 있는 길이 제한된다.

| 명령     | 가는 길                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search` | 기본은 무료 경로(Parallel 무료 검색 → DuckDuckGo). 이미지 검색은 DuckDuckGo. 앱 설정에서 고른 키 방식 검색 제공자가 있고 키가 있으면 그것. 구독은 쓰지 않는다 |
| `image`  | 키 방식 이미지 제공자만. 없으면 "쓸 수 없음". `--model`은 무시된다(성공 결과의 `detail.note`에 적힌다)                                                        |
| `media`  | 사진은 대화에 쓰는 AI 제공자 또는 고른 키 방식 분석 제공자. 영상·소리는 영상 분석이 되는 키 방식 제공자만                                                     |

- 구독은 사용자가 설정에서 허용했을 때만 쓰인다(기본 꺼짐). 꺼져 있으면 구독이 없는 것처럼 답한다. 켜져 있으면 한 번에 하나, 한 시간에 20건이고, 횟수는 모든 명령 실행과 MCP 호출에 걸쳐 합산된다.
- 사용자가 허용하고 직접 고른 종량 로그인은 구독이 아니라 키 경로로 친다.
- 구독에 로그인된 계정(이메일)과 프로그램의 모델 목록은 이 명령들의 출력 어디에도 나오지 않는다. `capabilities`의 답, 도구 결과, 실행 기록(`cli-audit.jsonl`) 모두 같다. 계정은 앱의 설정 화면에만 보인다.

**`ieumoffice capabilities --json`** 은 모델을 부르지 않고, 위 세 명령이 지금 무엇을 할지 알려 준다. `detail`:

| 항목                                                                                               | 값                                                                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `search`, `image_search`, `image_generation`, `image_analysis`, `video_analysis`, `media_analysis` | 각각 `{ available, via, route, metered?, message? }`                                       |
| `via`                                                                                              | 누가 답하는지(검색 경로, 키 제공자, 대화용 AI 제공자). 없으면 `null`                       |
| `route`                                                                                            | 비용이 어디로 가는지. `free` \| `key` \| `subscription`. 쓸 수 없으면 `null`               |
| `metered`                                                                                          | `true`면 쓴 만큼 요금이 나가는 로그인                                                      |
| `message`                                                                                          | 쓸 수 없을 때만 온다. 명령이 실제로 답할 글 그대로다                                       |
| `automatic_calls`                                                                                  | `{ subscription_enabled }`. 켜져 있으면 `{ used, limit, remaining, resetsAt? }`가 더해진다 |
| `app`                                                                                              | `{ available }`. 화면이 필요한 변환에 쓸 앱 실행 파일을 찾았는지                           |
| `settings_path`                                                                                    | 이 답을 읽어 온 설정 파일                                                                  |

- `media_analysis`는 예전 호출자를 위해 남긴 항목이다. `image_analysis`와 같고, 영상만 될 때는 `video_analysis`와 같다.
- 웹·이미지 검색은 키 제공자를 고르지 않는 한 항상 `available`이고 `route`는 `free`다.

**실패.** 세 명령이 실행될 수 없으면 종료 코드 4, `error: "app_unavailable"`.

| `detail.errorCode`                                                                                                                                    | 뜻                           | 다시 시도                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------- |
| `unavailable`                                                                                                                                         | 그 기능에 설정된 것이 없다   | 하지 않는다. 설정을 바꿔야 한다     |
| `headless-limit`                                                                                                                                      | 자동 호출의 시간당 한도 초과 | `detail.resetsAt`(밀리초 시각) 이후 |
| `rate-limit`                                                                                                                                          | 구독 한도 소진               | `detail.resetsAt`이 있으면 그 이후  |
| `not-connected`, `signed-out`, `not-installed`, `metered-not-accepted`, `needs-update`, `unsafe-tools`, `timeout`, `network`, `overloaded`, `credits` | 실행이 그 이유로 실패        | 이유에 따라                         |

## MCP 서버 (`ieumoffice mcp`)

- 표준 입출력으로 같은 명령들을 도구로 내놓는다. `--http <포트>`를 주면 Streamable HTTP로 내놓는다(`--host`, `--token`).
- 등록 예: `claude mcp add --transport stdio ieumoffice -- ieumoffice mcp`. `ieumoffice mcp install <에이전트|all>`이 각 에이전트의 설정 파일에 `ieumoffice` 항목만 쓴다. 같은 이름의 항목이 다른 프로그램을 가리키면 `occupied`로 알리고 `--force` 없이는 건드리지 않는다.
- 도구는 명령 동사마다 하나다(`docs_read`, `docs_apply`, `sheet_apply`, `slides_render`, `convert` 등). 매개변수는 명령의 옵션 목록에서 그대로 나온다. 두 표면이 어긋나지 않는다.
- 결과는 `--json`이 내는 것과 같은 객체다. 실패는 `isError`와 같은 `error` 이유로 온다.
- 환경변수 `GENOFFICE_MCP_COMPACT_SCHEMAS`는 예전 철자를 유지한다. `--http`의 토큰은 `--token`, 없으면 `GENOFFICE_MCP_TOKEN`에서 읽고, 둘 다 없으면 인증 없이 받는다. 에이전트 설정 폴더를 찾을 때의 홈 폴더는 `GENOFFICE_HOME`으로 바꿀 수 있다.
- 안내 자료는 리소스로도 내놓는다(`ieumoffice://guide/docs`, `…/sheets`, `…/slides`, `…/slides/design`, `…/slides/spec`, `…/slides/templates`, 내장 템플릿마다 `…/slides/templates/<id>`).
- 내장 디자인 템플릿은 `ieumoffice guide slides templates [<id>]`로 고른다. 목록의 `--json`은 `detail.templates`(`[{ id, name, scheme, description, fonts }]`, 정해진 순서), 템플릿 하나는 `detail`(`{ id, name, scheme, description, fonts, styleSheet }`)이다. 모르는 id는 종료 코드 1, `error: "invalid_argument"`, `detail.templates`에 쓸 수 있는 id 목록이다. MCP `guide` 도구는 세 번째 위치 인자 `name`으로 id를 받는다.
- 앱의 설정 → 연동 화면이 지금 설치본에 맞는 등록 예시를 보여 준다.

## 앱 안 MCP 서버

명령어 쪽 서버와 다른 것이다. 실행 중인 앱이 직접 여는 서버이고, 열려 있는 문서를 다룬다.

- 설정 → 연동에서 켠다. 기본은 꺼짐이다. 기본 포트는 3093이고 이 PC(`127.0.0.1`)에서만 닿는다. 인증은 없고, 요청의 Host·Origin이 이 PC의 것이 아니면 거절한다.
- 도구: `get_app_info`, `open_documents`, `open_in_genoffice`(이 이름은 예전 철자를 유지한다), `create_session`, `save_session`, `read_document`, `read_docx`, `read_sheet`, `read_deck`, `read_pdf`, `create_docx`, `create_xlsx`, `create_pptx`, `apply_ops`, `apply_sheet_ops`, `apply_slide_ops`, `insert_content`, `replace_blocks`.
- 에이전트 설정에 넣는 항목 이름은 `ieumoffice-editor`다. 명령어 쪽 서버의 `ieumoffice`와 겹치지 않는다.

## 에이전트 스킬

- 이름과 폴더는 `ieumoffice`다. 저장소의 `skills/ieumoffice/SKILL.md`가 원본이고, 앱의 설정 → 연동에서 고른 에이전트에 설치한다. 터미널에서는 `npx skills add pblsketch/openoffice`.
- 스킬 문서는 사용자의 에이전트 폴더로 복사되고, 문서의 `metadata.version`이 커졌을 때만 새것으로 바뀐다. 본문을 고치고 버전을 올리지 않으면 고친 내용이 아무에게도 닿지 않는다(검사 `npm run check:skill-version`).
- 스킬과 도움말이 에이전트에게 알려 주는 명령은 모두 `ieumoffice`로 시작한다.

## 설정 파일 (`ai-settings.json`)

데이터 폴더(`%APPDATA%\IeumOffice`, 개발 실행은 `IeumOffice-Dev`)에 있다. 사람이 직접 고칠 수 있고, 명령어와 MCP는 읽기만 한다.

| 값                                  | 종류                                             | 기본                                                       |
| ----------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `provider`                          | `auto` 또는 제공자 식별자                        | `auto`                                                     |
| `providers`                         | 제공자별 `{ apiKey, model, baseUrl?, cliPath? }` | 빈 표                                                      |
| `meteredAccepted`                   | 구독 제공자별 참/거짓                            | 거짓                                                       |
| `headlessSubscriptionEnabled`       | 참/거짓. 자동 호출 경로의 구독 사용              | 거짓                                                       |
| `subscriptionNoticeSeen`            | 참/거짓. 첫 연결 안내를 봤는지                   | 거짓                                                       |
| `customEndpoints`, `customEndpoint` | 직접 운영하는 서버 목록과 지금 쓰는 것의 식별자  | 없음                                                       |
| `maxOutputTokens`                   | 모델 한 차례의 출력 상한                         | 코드의 기본값                                              |
| `media`, `search`                   | 이미지·분석·검색 제공자 선택과 그 키             | 이미지 분석은 `chat`, 영상 분석은 `none`, 검색은 무료 경로 |

- 이미지 생성 제공자의 저장값 기본은 `codex`다. Codex 구독 이미지 생성이 들어 있지 않은 지금은 `none`(선택 없음)과 똑같이 동작한다.
- 구독 제공자의 식별자는 `claude-code`, `codex`다. 인증 방식은 `claude-subscription`, `codex-chatgpt`, `api-key` 셋이다.
- 모르는 제공자 식별자나 없어진 값이 있어도 오류 없이 읽는다. 그 자리는 기본값이 되고, 다음에 앱이 저장할 때 지워진다.
- `providers` 표가 아예 없는 파일은 제공자 설정 이전의 파일로 읽혀, 다른 값까지 기본값이 된다.
- 종량 허용은 이 파일의 값만으로는 유효하지 않다. 같은 폴더의 기록(`subscription-metered.json`)에 적힌 로그인 종류가 지금 감지된 것과 같아야 한다.
- 구독 제공자의 `model`에는 프로그램이 받는 값이 그대로 들어간다(Claude의 `opus`·`claude-opus-5-5` 같은 별칭이나 식별자, Codex의 모델 식별자). 빈 값은 프로그램의 기본 모델이다. 화면에 보이는 표시 이름은 저장하지 않는다.
- 구독에 로그인된 계정은 이 파일에도, `subscription-metered.json`에도 적히지 않는다. 그 기록에 남는 것은 로그인 방식의 종류뿐이다.

## 구독 연결 상태 (앱 안의 창구)

앱 안에서 뒷단이 화면에 주는 값이다. 바깥 프로그램에는 나가지 않는다.

| 항목              | 값                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------ |
| `provider`        | `claude-code` \| `codex`                                                             |
| `state`           | `checking` \| `not-installed` \| `signed-out` \| `ready` \| `metered` \| `error`     |
| `version`         | 프로그램 버전(있을 때)                                                               |
| `loginMethod`     | `subscription` \| `metered` \| `unknown`                                             |
| `planName`        | 요금제 이름(프로그램이 알려 줄 때, 표시용)                                           |
| `account`         | 로그인된 계정의 이메일(프로그램이 알려 줄 때, 표시용, 저장 금지)                     |
| `models`          | 프로그램이 알려 준 모델 목록(있을 때). 항목은 `{ id, label, resolved?, isDefault? }` |
| `meteredAccepted` | 참/거짓                                                                              |
| `error`           | 오류 내용(`error`일 때)                                                              |

- `account`와 `models`는 `ready`·`metered`일 때만 있다. `account`는 이메일 주소 모양이 아니면 빠진다.
- `models`의 `id`는 프로그램이 받는 값이자 저장되는 선택값이다. 빈 `id`는 프로그램의 기본 모델을 뜻하고, 그것이 가리키는 모델이 `resolved`에 온다. 목록은 50개까지다.
- 창구 이름은 `ai:subscription-statuses`, `-recheck`, `-login`, `-logout`, `-install`, `-metered`, `-codex-image`와 변경 알림 `ai:subscription-changed`다. `-logout`은 껍데기 앱의 화면에서만 부른다.

## 문서 호환

- `.docx`·`.xlsx`·`.pptx`·PDF·마크다운·HTML 파일은 원본 프로그램과 같은 방식으로 읽고 쓴다. 한쪽에서 만든 문서를 다른 쪽에서 열 수 있다.
- 가리기 표시는 문서 안에 저장되고, 그 이름공간 주소는 원본과 같다. 원본으로 가린 문서를 열면 가리기가 그대로 인식된다.
- 문서 곁에 저장되는 보조 파일의 이름(`.genoffice-assets.json` 등)도 원본과 같다.
- 문서 안에 적히는 작성자 이름(PDF 주석 작성자, 엑셀 메모 작성자, 명령어가 넣는 메모 작성자)은 지금 "GenOffice"다.
- 파워포인트 편집기에서 고른 디자인 템플릿은 문서 안이나 곁에 쓰지 않는다. 문서에 남는 것은 평범한 도형·글·글꼴 이름뿐이다.
- 저장한 스타일 파일(`<데이터 폴더>/style-templates/<이름>.json`)에는 선택 항목 `basedOn`(기본 템플릿의 id)이 붙을 수 있다. 이 값을 모르는 예전 버전은 무시하고 그대로 읽는다.

## 설치본과 업데이트

- 설치 파일 이름은 `IeumOffice-Setup-<버전>.exe`, 설치 식별자는 `io.github.pblsketch.ieumoffice`, 실행 파일은 `IeumOffice.exe`다.
- 파일 연결의 등록 이름은 `IeumOffice.<종류>` 꼴이다(`IeumOffice.WordDocument` 등).
- 자동 업데이트는 `pblsketch/openoffice`의 GitHub 릴리스에서 `latest.yml`과 설치 파일을 읽는다. 릴리스는 `v<버전>` 태그여야 한다.
