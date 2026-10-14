# 구조

## 한 프로그램으로 배포되는 여러 조각

설치되는 것은 Electron 프로그램 하나다. 그 안에 껍데기 앱 하나와 편집기 여섯 개가 들어 있고, 편집기들은 화면과 무관한 공용 패키지(문서 엔진, AI 연결부)를 가져다 쓴다.

```
apps/shell      껍데기 앱. 창, 탭, 홈 화면, 설정, 첫 실행 안내, 자동 업데이트, 파일 색인과 지식 자료 검색,
                앱 안 MCP 서버, 명령어가 실행 중인 앱에 말을 거는 제어 창구
apps/docs       워드(.docx) 편집기. 뒷단이 공용 AI 창구(`ai:*`)를 등록한다. 설치본에서는 여섯 편집기의
                모델 호출·설정·검색 요청을 모두 이 뒷단이 받는다
apps/sheets     엑셀(.xlsx) 편집기        ┐ 모델 호출용 뒷단 코드는 편집기를 혼자 띄울 때만 돈다. 설치본에서는
apps/slides     파워포인트(.pptx) 편집기  ┘ 전용 AI 창구만 등록한다. 엑셀은 이름 앞에 `sheets:`를 붙인다. PPT는 예외로
                이름을 붙이지 않은 `ai:generate-image`·`ai:analyze-media` 등을 직접 등록한다(워드는 같은 일에 `docs:`를 붙인다)
apps/pdf        PDF 편집기
apps/markdown   마크다운·텍스트 편집기
apps/html       HTML 편집기
packages/ai-provider   제공자 목록, 제공자 선택 규칙, 구독 프로그램 실행부, 키 방식 제공자 연결
packages/ai-search     검색·이미지 생성·미디어 분석 도구, 자동 호출 경로의 구독 요청 차례
packages/agent-core    AI 실행 반복(모델 → 도구 → 모델), 화면↔뒷단 전송 통로, 가리기
packages/ui            편집기들이 함께 쓰는 AI 화면 부품과 그 문구(21개 언어)
packages/i18n          화면 언어 목록, 제품 이름 한 곳 정의
packages/cli           터미널 명령어 `ieumoffice`, MCP 도구, 에이전트 스킬 설치
packages/electron-utils 편집기 뒷단 공용 도구(메뉴, 저장소 주소, 원격 이미지 받기 등)
packages/pdf-structure PDF의 문서 나무(다시 흐르는 글), Markdown·EPUB 쓰기, 그림 원본 꺼내기, AI 페이지 읽기,
                       번역, 번역 PDF 써 넣기, 문서 작업 엔진, 결과 보관소. pdf2docx의 IR을 읽기만 한다
packages/docx-engine, pptx-engine, pptx-ops, pptx-render, xlsx-gateway,
         pdf2docx, html2docx, file-parse, zip-gate, font-metrics, pipelines, project-store
                       문서 엔진과 그 주변. 원본(GenOffice)에서 온 그대로 두는 영역
apps/sheets/native/xlsx-engine   엑셀 계산·입출력을 맡는 별도 프로그램(Rust). 표준 입출력으로 대화한다
```

- 의존 방향은 한쪽이다. `apps/*` → `packages/*`. 패키지끼리는 `ai-provider` → `agent-core`·`i18n`(그래서 `agent-core`는 `ai-provider`를 가져올 수 없다), `ai-search` → `ai-provider`·`electron-utils`, `ui` → `ai-provider`·`agent-core`·`i18n`·`pptx-render`, `cli` → 엔진 패키지·`pdf-structure`·`ai-search`·`ai-provider`·`i18n`, `electron-utils` → `i18n`. `pdf-structure`는 `pdf2docx`와 `i18n`의 소스를 상대 경로로 가져오고, `apps/pdf`·`apps/shell`·`cli`도 `pdf-structure`를 상대 경로로 가져온다. `pdf-structure`는 다른 작업 공간 패키지를 이름으로 가져오지 않고 Electron에 기대지 않는다. `i18n`과 `agent-core`는 다른 작업 공간 패키지에 기대지 않는다.
- `ai-provider`는 진입점이 나뉘어 있다. 화면(renderer)과 preload가 **값**으로 가져오는 것은 `@genoffice/ai-provider/browser`뿐이다. 대표 진입점에서는 형(`import type`)만 가져온다. 프로그램을 실행하는 코드(`/subscription`, `/claude-code-cli`, `/codex-app-server`)는 뒷단에서만 가져온다.
- 편집기 여섯 개의 뒷단 코드는 따로 실행되지 않는다. 껍데기 앱을 빌드할 때 함께 묶여, 껍데기 앱의 한 프로세스 안에서 돈다. 그래서 창구 이름(IPC 채널)은 프로세스 전체에서 하나뿐이어야 한다.
- 편집기 화면은 껍데기 창 위에 얹히는 별도 화면(WebContentsView)이다. 홈 탭만 껍데기 앱 자신의 화면이다.

## AI 요청 한 번의 흐름 (화면 경로)

1. 사용자가 편집기의 AI 창에 요청을 적는다. 화면 쪽 문지기(`packages/ui`의 `aiSendGate`)가 설정과 구독 연결 상태를 보고 넷 중 하나로 정한다. 실행, 확인 중이라 보류, 첫 연결 안내 먼저, 연결 안내 표시.
2. 실행이면 화면에서 AI 실행 반복(`agent-core`의 `AgentLoop`)이 시작된다. 반복은 화면 프로세스 안에 있다.
3. 반복의 한 차례마다 화면이 전송 통로(`createIpcTransport`)로 뒷단에 "모델에게 물어 달라"고 보낸다. 실리는 것은 시스템 지시문, 지금까지의 대화, 앱 도구 목록이다.
4. 뒷단은 저장된 설정을 정리하고(`normalizeAiSettings`), 연결 상태와 함께 제공자를 정한다(`selectAiProvider`). 쓸 제공자가 없으면 모델을 부르지 않고 오류 종류(`not-connected` 등)를 돌려준다.
5. 제공자가 정해지면 그 제공자의 연결부로 넘긴다.
   - Claude 구독: 차례마다 Claude Code 프로그램을 하나 새로 띄운다. 빈 임시 폴더에서, 내장 도구를 모두 끈 채로. 표준 입력으로 지시문과 대화를 넣고 표준 출력의 조각을 읽는다. 답이 끝나면 프로그램도 끝난다.
   - Codex 구독: Codex의 `app-server`를 띄워 두고 차례마다 임시 대화를 연다. 쓰지 않은 채 2분이 지나면 스스로 끝낸다.
   - 키 방식 제공자: 그 회사의 주소로 직접 요청한다.
6. 뒷단은 글 조각, 도구 호출 요청, 사용량, "입력을 줄였다"는 알림, 오류(종류·제공자·풀리는 시각)를 화면으로 흘려보낸다.
7. 모델이 도구 호출을 요청하면 **화면 쪽의 앱이** 그 도구를 실행한다(문서 읽기·고치기, 검색 등). 결과를 대화에 붙여 3으로 돌아간다. 도구 호출이 없으면 반복이 끝난다.
8. 사용자가 중단하면 화면이 통로에 중단을 알리고, 뒷단이 띄워 둔 프로그램을 하위 프로세스까지 끝낸다.

구독 프로그램은 "한 차례의 답"만 내는 두뇌다. 앱의 도구를 직접 실행하지 못하고 요청만 한다. 문서 변경, 변경 내용 표시, 되돌리기는 모두 7번의 앱 쪽에서 일어난다.

## 구독 연결 상태가 화면에 닿는 길

- 뒷단: 상태 서비스가 두 프로그램에 "설치됐나, 로그인됐나, 어떤 방식인가"를 묻는다(버전·로그인 상태 명령. 모델 호출이 아니다). 결과는 프로세스에 하나뿐인 저장소에 있고, AI 요청의 제공자 선택(위 4번)이 같은 값을 읽는다.
- 앱이 쓸 수 있는 로그인(구독, 또는 허용된 종량)의 프로그램에는 모델 목록도 묻는다. 상태가 먼저 화면에 나가고, 목록은 도착하는 대로 변경 알림에 실려 같은 길로 간다. 목록을 얻지 못해도 상태는 그대로다.
- 창구: `ensureSubscriptionIpc`가 채널을 등록한다. 한 프로세스에서 여러 번 불러도 한 번만 등록된다. 첫 조회가 올 때 첫 확인을 시작한다.
- 화면: 각 편집기와 껍데기 앱의 preload가 조회·다시 확인·로그인 띄우기·설치 띄우기·종량 허용 기록·변경 알림을 화면에 내준다. 로그아웃은 껍데기 앱의 preload만 내준다. 화면은 받은 값을 공용 검사 함수(`subscriptionStatusMapOf`)로 거른 뒤 쓴다. 계정 이메일과 모델 목록도 이 함수가 모양을 확인한 것만 통과시킨다.

## 바깥에서 들어오는 길 (자동 호출 경로)

```
터미널의 `ieumoffice …`  ──┐
MCP 클라이언트(`ieumoffice mcp`) ─┴→ packages/cli → 문서 엔진(파일 읽기·만들기·변환, PC 안에서 끝남)
                                         ├→ packages/pdf-structure (PDF 변환·그림·보관소, PC 안에서 끝남)
                                         ├→ packages/ai-search (search / image / media, 밖으로 나감)
                                         └→ packages/ai-provider (pdf ai-read / translate, `--yes`일 때만 밖으로 나감)
```

- 이 경로는 창을 띄우지 않는다. 앱의 설정 파일과 종량 허용 기록을 읽기만 한다. PDF 명령은 앱과 같은 보관소(데이터 폴더의 `pdf-store`)를 읽고 쓴다.
- `ai-search`의 도구는 호출 맥락을 받는다. 화면 경로는 `{ path: 'screen', statuses }`, 이 경로는 `{ path: 'headless', statuses, dataDir }`. 구독을 쓸지, 요청을 차례에 세울지가 이 값으로 갈린다.
- 차례는 데이터 폴더의 잠금 파일로 지킨다. 구독 요청 하나가 잠금을 쥐고 도는 동안 다른 프로세스의 요청은 기다린다. 횟수 한도는 없고, 장부 파일에는 최근 한 시간의 요청 시각이 정보로만 남는다.
- PDF의 AI 페이지 읽기와 번역은 이 경로에서 `pdf-structure`의 작업 엔진을 명령 프로세스 안에서 돌린다. 모델 호출은 한 번마다 `ai-provider`의 `streamForProvider`로 가고, 구독이면 같은 잠금으로 차례를 기다린다(`runHeadlessSubscriptionCall`). 터미널 명령은 작업이 끝날 때까지 앞에서 돌고, MCP 도구는 작업을 MCP 서버 프로세스 안에 띄우고 바로 답한다. 서버가 끝나면 작업은 `interrupted`로 멈춘다.

## PDF 구조 작업과 문서 작업 (화면 경로)

PDF를 문서 나무로 분석하고 Markdown·EPUB·번역 PDF를 쓰는 일은 셸 메인 프로세스 밖에서 돈다. 큰 문서에서 창이 멈추지 않게 하려는 것이다. 기존 워드·PPT·엑셀 변환(`pdf2docx-local.ts` 등)은 예전처럼 메인 프로세스에서 돈다.

```
PDF 편집기 화면 ── pdfApi.structure.* ──→ 셸 메인(pdf-structure-ipc.ts) ── 작업마다 utilityProcess 하나 ──→ pdf-structure
               ── pdfApi.store.*     ──→ 셸 메인(ResultStore, <userData>/pdf-store)
               ── ai:stream          ──→ 공용 AI 창구 → 제공자(구독 프로그램 등)
```

- **구조 작업.** 화면이 `structure*` 채널로 나무 만들기, 구조화 글, 변환, 그림 꺼내기, 번역 PDF 쓰기를 부탁하면, 셸이 작업마다 Electron `utilityProcess`를 하나 띄운다(`apps/shell/src/main/pdf-structure/pdf-structure-process.ts`, 빌드 결과 `out/main/pdf-structure-process-*.js`). 그 프로세스가 PDFium과 Windows OCR을 준비해 작업 하나를 하고 답한다. 답하거나, 실패하거나, 화면이 취소하거나, 그 탭이 닫히거나, 앱이 끝나면 프로세스를 끝낸다. 진행은 `structureProgress`로 화면에 간다.
- **보관소.** `store*` 채널은 가벼운 일이라 셸 메인에서 바로 `ResultStore`로 처리한다. 화면은 경로를 주고 해시를 받으며(`storeDocHash`), 읽기·쓰기는 그 창에 열린 파일에서 셸이 계산한 해시로만 받아들인다. 설정 화면의 용량·모두 지우기는 셸 자신의 채널(`result-store-ipc.ts`)이다.
- **문서 작업(AI 페이지 읽기, 번역).** 작업 엔진(`pdf-structure`의 `startAiReadJob`·`startTranslationJob`)은 PDF 편집기 **화면** 안에서 돈다. 탭마다 세션(`apps/pdf/src/renderer/doc-jobs/job-session.ts`)이 작업을 쥐고, 탭이 사라지면 `interrupted`로 멈춘다.
  1. 사용자가 시작을 확인하면 세션이 작업을 띄운다. 쓸 제공자는 확인 전에 한 번 정해 고정한다(`doc-jobs/route.ts`).
  2. 페이지 그림은 화면이 PDF.js로 그린다. 문서 나무와 AI 읽기 결과를 반영한 나무는 구조 작업으로 받는다.
  3. 모델 호출 하나는 AI 창과 같은 `ai:stream` 채널로 간다(`doc-jobs/model-call.ts`). 도구 없이 지시문과 글·그림만 보내고, 답은 글로 받아 작업이 검사한다. 중단하면 스트림이 끊기고 뒷단이 구독 프로그램을 끝낸다.
  4. 결과는 `pdfApi.store.write`로 셸에 보내 보관소에 쓴다(`doc-jobs/ipc-store.ts`). 보관소에 쓰인 뒤에야 끝난 것으로 센다.
  5. 번역 PDF는 끝난 뒤 구조 작업(`structureWriteBack`)으로 쓴다. Markdown·EPUB도 구조 작업이다.
- 앱 안에서 저장해 파일 내용이 바뀌면, 화면이 `storeMigrate`를 불러 같은 페이지의 결과와 끝나지 않은 작업의 기록을 새 해시로 옮긴다.
- 한 문서에 작업 하나는 세 겹으로 지킨다. 탭의 세션, 화면 프로세스 안의 잠금(`documentJobs`), 다른 프로세스가 최근 30초 안에 갱신한 작업 기록.

## 프로세스 경계를 넘는 것과 넘지 않는 것

| 경계                    | 넘어가는 것                                                                                                                                               | 넘어가지 않는 것                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 앱 → 구독 프로그램      | 시스템 지시문, 대화, 앱 도구 목록, 첨부 이미지(표준 입력으로). 문서 작업이면 PDF 페이지 그림, 번역할 글 블록(도구 목록 없이)                              | 사용자 글이 든 명령줄 인자, 요금 경로를 바꾸는 환경변수, 사용자 PC의 개인 설정·훅·MCP 연결 |
| 구독 프로그램 → 앱      | 글 조각, 구조화된 도구 호출 요청, 사용량, 오류, 계정 이메일(설정 화면 표시용. 저장하지 않는다), 모델 목록                                                 | 로그인 정보, 조직 이름(읽은 즉시 버린다)                                                   |
| 앱 → 인터넷(직접)       | 키 방식 제공자 요청, 검색어, 검색된 이미지 받기, 업데이트 확인. 사용자가 켠 경우에만: 파일 검색 재정렬(찾은 문서의 발췌), 마크다운 편집기의 이미지 올리기 | 사용 통계(보내지 않는다)                                                                   |
| 화면 ↔ 뒷단             | 설정(정리된 사본), 연결 상태, 스트림 조각. PDF 편집기는 문서 나무, 보관소 읽기·쓰기(뒷단이 계산한 문서 해시로만)                                          | 프로그램 실행 권한(뒷단에만 있다)                                                          |
| 셸 메인 ↔ 구조 프로세스 | 작업 하나의 요청(파일 경로, 암호, 페이지 범위, 출력 경로), 진행, 결과                                                                                     | 다른 작업. 프로세스는 작업 하나가 끝나면 끝난다                                            |

## 바깥 의존

- 사용자 PC의 **Claude Code**(2.1.248 이상)와 **Codex** 프로그램. 없으면 구독 연결이 "설치되지 않음"이 되고 나머지 기능은 그대로 동작한다.
- 무료 검색: Parallel의 무료 검색, 실패하면 DuckDuckGo.
- GitHub 릴리스(`pblsketch/openoffice`): 자동 업데이트와 설치 파일 배포.
- 키 방식 제공자와 키 방식 검색·이미지 서비스, 파일 검색 재정렬 서비스, 마크다운 편집기의 이미지 올리기 대상: 사용자가 설정에 넣은 경우에만.
- 문서가 스스로 부르는 것: HTML 문서는 자기 코드가 가리키는 온라인 자원을 불러오고, 마크다운 내보내기는 주소로 걸린 그림을 받아 온다.
