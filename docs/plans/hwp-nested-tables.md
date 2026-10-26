# 한글 표 안의 표 편집 — 핸드오프

상태: **핸드오프 준비됨(2026-10-26)**. 기능 구현은 시작하지 않았다.
작업 위치: `E:\github\openoffice\.dryforge\worktrees\hwp-nested-tables`
브랜치: `feat/hwp-nested-tables`
기준: `origin/main` = `6d79230a` (PR #95 `feat(hwp): Hancom table parity (1A–2B)` 병합 뒤)

## 0. 왜 이 작업을 하는가

이음오피스의 한글(HWP) 편집기는 표 안의 표를 **읽고 표시하고 지우는 것**까지는 한다. 그러나 표 안의 표를 새로 만들거나, 그 표의 행·열을 넣고 빼거나, 칸을 합치고 나누는 일은 아직 막혀 있다. 사용자는 학교·관공서 서식에서 표 안의 표를 흔히 만나므로, 한컴 한글에서 되는 이 편집을 이음오피스에서도 할 수 있어야 한다.

이 작업은 `docs/plans/hwp-table-parity.md`의 Phase 2 중 **표 안의 표** 부분이다. H/W의 병합 칸·표 안의 표 확장, 서식 있는 셀 복사는 이 작업 뒤에 별도로 다룬다.

## 1. 지금 되는 것과 안 되는 것

### 되는 것

- 문서를 열 때 표 안의 표를 읽고 그린다.
- `getTableDimensionsByPath`, `getCellInfoByPath`, `getTableCellBboxesByPath`, `getCellParagraphCountByPath`, `getTextInCellByPath` 등 경로 조회 API가 있다.
- 표 안의 표에 글자를 넣고 서식을 바꾸는 경로 API가 있다.
- `resizeTableCellsByPath`로 표 안의 표 칸 크기를 조절할 수 있다.
- `deleteCellTableControlByPath`로 칸 안의 표를 지울 수 있다.
- `apps/hwp/tests/fixtures/nested-form.hwp`에 실제 한컴이 만든 표 안의 표 견본이 있다(바깥 5×2, 안쪽 8×9 등).

### 안 되는 것

- 표 칸 안에 새 표를 만들기. AI 플러그인의 `insertTable`은 `inTable`이면 `in_table`으로 거절한다.
- 표 안의 표에 행/열 넣기·지우기. 엔진의 `insertTableRow`·`insertTableColumn`·`deleteTableRow`·`deleteTableColumn`은 `(sec, ppi, ci)` 평면 표만 가리킨다.
- 표 안의 표 칸 합치기·나누기. `mergeTableCells`·`splitTableCell`·`splitTableCellsInRange`도 평면 API만 있다.
- 표 안에서 `Ctrl+Enter`/`Ctrl+Backspace`는 플러그인이 키를 소비하지만 아무 일도 하지 않는다(`cellPath.length > 1` 분기).
- 표 안에서 `Ctrl+N,T`/표 만들기 메뉴는 표를 만들지 못한다.
- AI 플러그인의 `addTableLines`/`removeTableLines`/`mergeCells`/`splitCell` 같은 도구도 바깥 표만 다룬다.

## 2. 엔진에서 먼저 확인할 것

엔진 소스는 빌드 때 `node_modules/.cache/rhwp-core/v0.8.7`에 받아진다. `node tools/build-rhwp-core.mjs --keep`로 소스를 남길 수 있다.

확인할 파일:

- `src/document_core/commands/table_ops.rs`
  - `resolve_table_mut_by_cell_path`가 이미 표를 경로로 찾는다. `resize_table_cells_by_cell_path_native`가 이를 쓰는 선례다.
  - `insert_table_row_native`, `insert_table_column_native`, `delete_table_row_native`, `delete_table_column_native`, `merge_table_cells_native`, `split_table_cell_native`가 있다.
- `src/document_core/commands/object_ops/table.rs`
  - `create_table_with_options_native`가 본문 문단에 표를 만든다. 표 생성 부분을 **칸 문단에 삽입할 수 있게** 분리하거나, 칸 경로를 받는 새 native를 만들어야 한다.
- `src/wasm_api.rs`
  - 공개 WASM API를 추가한다. 새 함수 이름은 기존 규약처럼 `*ByPath`를 붙인다.
- `rhwp-studio/src/core/wasm-bridge.ts`
  - 새 WASM 호출을 브리지에 노출한다.
- `src/parser`·`src/serializer`
  - 표 안의 표를 저장·다시 읽을 때 내용이 유지되는지 확인한다. 저장 형식은 바꾸지 않는다.

권장 API(이름은 구현하면서 정한다):

```
insertTableRowByPath(sec, ppi, pathJson, rowIdx, below)
insertTableColumnByPath(sec, ppi, pathJson, colIdx, right)
deleteTableRowByPath(sec, ppi, pathJson, rowIdx)
deleteTableColumnByPath(sec, ppi, pathJson, colIdx)
mergeTableCellsByPath(sec, ppi, pathJson, startRow, startCol, endRow, endCol)
splitTableCellByPath(sec, ppi, pathJson, row, col)
splitTableCellsInRangeByPath(sec, ppi, pathJson, startRow, startCol, endRow, endCol, nRows, nCols, equalRowHeight)
createTableInCellByPath(sec, ppi, pathJson, charOffset, rowCount, colCount, optionsJson)
```

- `pathJson`은 기존 `[{controlIndex, cellIndex, cellParaIndex}, ...]` 형식이다. 마지막 항목이 조작할 표를 가리킨다.
- `insertTableRowByPath`는 대상 표를 경로로 찾은 뒤, 기존 행 삽입 로직을 **표 단위 함수**로 분리해 재사용한다. `(sec, ppi, ci)`를 다시 평면으로 풀지 않는다.
- `createTableInCellByPath`는 칸 문단의 지정 위치에 표 컨트롤을 넣는다. 표 생성 코드는 기존 `create_table_with_options_native`의 셀·테두리·높이 기본값을 그대로 쓴다.
- 엔진 동작을 바꾸는 패치는 `vendor/rhwp-core/patches/0017-...patch`로 만들고, `package.json`의 버전(`0.8.7-ieum.8`)·패치 목록·WASM 해시를 갱신한다.
- `rhwp-studio` 소스는 직접 고치지 않는다. `apps/hwp/scripts/rhwp-patches.mjs`에 브리지 패치를 더한다.

## 3. 앱 쪽 연결

### 플러그인(`apps/hwp/studio-plugin/agent-plugin.mjs`)

- `insertTable`: `box.inTable` 거절을 없애고, 표 안에서는 현재 칸 경로로 `createTableInCellByPath`를 호출한다. 표를 넣을 위치(문단/글자)와 표 크기를 경로와 함께 넘긴다.
- `addTableLines`/`removeTableLines`: `listTables`가 준 표 번호의 경로를 찾아 `*ByPath`를 호출한다. 표 안의 표 번호는 기존 `tablesOf`/`listTables` 경로 규칙을 따른다.
- 같은 도구가 `what`에 따라 행과 열을 모두 다룬다. 마지막 행/열은 지우지 않는다.
- `mergeCells`/`splitCell`: 표 안의 표 경로를 넘긴다. 병합 범위가 기존 병합을 부분적으로 가로지르는 경우는 지금처럼 거절한다.
- `deleteTable`: 이미 `deleteCellTableControlByPath`로 동작한다. 새 API와 충돌하지 않게 둔다.
- 모든 변경은 `host.transaction` 안에서 한 번의 실행 취소가 되게 한다.

### 한글 키(`apps/hwp/studio-plugin/hancom-keys.mjs`)

- `Ctrl+Enter`/`Ctrl+Backspace`: `pos.cellPath.length > 1`이면 **가장 안쪽 표**의 경로로 행 추가/삭제를 실행한다. 지금은 키를 소비하고 아무 일도 하지 않는다.
- 병합 칸에서 아래 줄 추가 규칙(2B)은 표 안의 표에도 적용한다. 새 줄의 같은 열 범위를 다시 병합한다.
- `Ctrl+N,T`(표 만들기)와 `Alt+Insert`(줄/칸 추가)는 표 안에서 새 경로 API를 부르게 한다.
- `Shift+Esc`는 지금처럼 표 안의 표에서 바깥 칸으로 나간다. 경로가 바뀌어도 유지한다.
- `F7`/`F8`, `Alt+화살표`, `Shift+화살표`, H/W는 이번 작업에서 표 안의 표까지 넓히지 않아도 된다. 단, 새 API를 쓰면서 기존 동작을 깨지 않는다.

### 표 명령과 대화 상자

- `table:insert-row-below` 같은 스튜디오 명령은 표 안에서 `ieum` 경로 명령으로 넘긴다. `Ctrl+Enter`와 같은 구현을 쓴다.
- “줄/칸 추가하기” 대화 상자의 `applyTableInsertRowColumn`도 표 안의 표 경로를 받게 한다.
- 명령 하나가 실행 취소 한 단계가 되도록 snapshot 안에서 처리한다.

## 4. 테스트와 확인

### 엔진·플러그인 단위 테스트

- `apps/hwp/tests/fixtures/nested-form.hwp`로:
  - 안쪽 표에 행을 넣고/지우고, 바깥 표의 글자와 구조가 그대로인지.
  - 안쪽 표에 열을 넣고/지우고, 안쪽·바깥 표 크기가 깨지지 않는지.
  - 안쪽 표의 칸을 합치고/나누고, 내용이 첫 칸에 남는지.
  - 각 변경이 한 번의 실행 취소로 돌아가는지.
  - HWP와 HWPX로 저장한 뒤 다시 열어 표 구조·글자가 같은지.
- 새 표를 칸 안에 만들고, 그 표에 글자를 넣고, 저장·다시 열기.
- 기존 `tests/agent-plugin-delete-table.test.ts`와 `tests/agent-plugin-tables.test.ts`의 경로 규칙을 재사용한다.

### E2E

- 빈 문서에서 바깥 표를 만들고, 한 칸 안에 표를 만든다.
- 안쪽 표에서 `Ctrl+Enter`/`Ctrl+Backspace`, 표 메뉴의 줄/칸 추가, 셀 합치기/나누기를 한다.
- 바깥 표의 다른 칸 글자가 그대로인지, 실행 취소가 한 단계인지 확인한다.
- 앱에서 저장한 `.hwp`·`.hwpx`를 다시 열어 구조를 확인한다.
- `window.__wasm`은 쓰지 않는다. production 빌드의 `window.rhwpStudio.automation`과 `ieum-agent` 플러그인을 쓴다.

### 한컴 한글 2024 왕복

- 앱에서 만든 표 안의 표 문서를 HWP/HWPX로 저장한다.
- 공식 자동화 `HWPFrame.HwpObject`로 열어 표 수·바깥/안쪽 표 크기·글자를 읽고, 다시 저장한다.
- 앱에서 다시 열어 글자와 표 구조가 같은지 확인한다.
- 저장 결과의 문서 식별자나 형식이 바뀌지 않아야 한다.

## 5. 받아들일 기준

- [ ] 표 칸 안에 새 표를 만들 수 있다.
- [ ] 표 안의 표에 행·열을 넣고 지울 수 있다.
- [ ] 표 안의 표 칸을 합치고 나눌 수 있다.
- [ ] 모든 변경이 한 번의 실행 취소로 돌아간다.
- [ ] 바깥 표와 다른 칸의 글자·구조가 유지된다.
- [ ] HWP·HWPX 저장 뒤 다시 열어도 표 구조와 글자가 같다.
- [ ] 한컴 한글 2024에서 열고 다시 저장해도 표 구조와 글자가 같다.
- [ ] `npm run test -w @genoffice/hwp`, HWP typecheck, 새 E2E가 통과한다.
- [ ] `docs/tracking/status.md`, `apps/hwp/AGENTS.md`, `docs/tracking/findings.md`를 갱신한다.

## 6. 하지 말 것

- `main`에 직접 커밋하지 않는다. 이 worktree와 브랜치에서만 작업한다.
- 다른 worktree(`dryforge/local-ai`, `main` 등)를 건드리지 않는다.
- 저장 형식·문서 식별자를 바꾸지 않는다.
- 엔진 패치 없이 `rhwp-studio` 소스를 저장소에 직접 넣지 않는다. `apps/hwp/scripts/rhwp-patches.mjs`만 쓴다.
- 병합 칸 H/W, 서식 있는 셀 복사, 표 스타일·계산식은 이번 범위가 아니다.
- 한컴의 내부 구현을 뜯어보지 않는다. 공식 도움말과 공식 자동화 창구만 본다.

## 7. 검증 명령

```powershell
npm ci
npm run test -w @genoffice/hwp
npm run typecheck -w @genoffice/hwp
npm run build -w @genoffice/hwp
npm run build -w @genoffice/shell
npx playwright test --config e2e/playwright.config.ts hwp-table.spec.ts --reporter=list
```

엔진을 고쳤으면:

```powershell
node tools/build-rhwp-core.mjs --keep
npm run test -w @genoffice/hwp
```

## 8. 새 세션에 그대로 넘길 프롬프트

```text
당신은 이음오피스의 한글(HWP) 표 안의 표 편집을 구현하는 작업을 맡는다.

작업 위치: E:\github\openoffice\.dryforge\worktrees\hwp-nested-tables
브랜치: feat/hwp-nested-tables
기준: origin/main = 6d79230a (PR #95 병합 뒤)
먼저 docs/plans/hwp-nested-tables.md를 끝까지 읽고, docs/standards.md · docs/engineering-notes.md · apps/hwp/AGENTS.md를 읽어라.

배경:
- 이음오피스는 rhwp-studio v0.8.7을 편집 화면으로 쓰고, apps/hwp/studio-plugin의 플러그인과 vendor/rhwp-core 엔진 패치로 한컴 한글 2024의 표 편집을 따라간다.
- 표 안의 표는 지금 읽기·표시·삭제·텍스트/서식 편집·칸 크기 조절까지 된다.
- 표 안의 표를 새로 만들기, 행/열 넣기·지우기, 칸 합치기·나누기는 아직 안 된다. 평면 표 API만 있기 때문이다.

이번 작업:
1. 엔진에 표 경로(pathJson) 기반 API를 더한다: 표 안의 표 행/열 넣기·지우기, 칸 합치기·나누기, 칸 안에 새 표 만들기. 기존 resolve_table_mut_by_cell_path와 native 표 로직을 재사용하고, 가능하면 표 단위 함수로 분리한다. 새 패치는 vendor/rhwp-core/patches/0017-*.patch로 만들고 package.json의 버전·패치 목록·WASM 해시를 갱신한다.
2. rhwp-studio는 직접 고치지 말고 apps/hwp/scripts/rhwp-patches.mjs의 브리지 패치로 새 WASM 호출을 연결한다.
3. apps/hwp/studio-plugin/agent-plugin.mjs의 insertTable, addTableLines/removeTableLines, mergeCells, splitCell을 표 안의 표 경로에서도 동작하게 한다. 모든 변경은 host.transaction 안에서 한 번의 실행 취소여야 한다.
4. apps/hwp/studio-plugin/hancom-keys.mjs의 Ctrl+Enter/Ctrl+Backspace가 표 안의 표에서 가장 안쪽 표를 대상으로 동작하게 한다. 2B의 “병합 칸 아래에 새 줄 + 새 줄 왼쪽 칸 다시 병합” 규칙도 표 안의 표에 적용한다. Ctrl+N,T/Alt+Insert도 새 경로 API를 쓰게 한다.
5. 테스트: apps/hwp/tests/fixtures/nested-form.hwp로 행/열/합치기/나누기/저장 왕복/실행 취소를 확인한다. 새 E2E는 production 빌드의 window.rhwpStudio.automation과 ieum-agent 플러그인만 쓴다. HWP와 HWPX를 모두 저장·다시 열어 본다.
6. 한컴 한글 2024의 공식 자동화 HWPFrame.HwpObject로 앱이 저장한 문서를 열고 다시 저장해 표 수·바깥/안쪽 표 구조·글자가 유지되는지 확인한다.
7. apps/hwp/AGENTS.md, docs/tracking/status.md, docs/tracking/findings.md를 갱신한다.

하지 말 것:
- main에 직접 커밋하지 말 것. 이 worktree 밖의 다른 worktree를 건드리지 말 것.
- 저장 형식·문서 식별자를 바꾸지 말 것.
- rhwp-studio 소스를 저장소에 직접 넣지 말 것. 반드시 apps/hwp/scripts/rhwp-patches.mjs만 쓸 것.
- 병합 칸 H/W, 서식 있는 셀 복사, 표 스타일·계산식은 이번 범위가 아니다.
- 한컴 내부 구현을 뜯어보지 말고 공식 도움말·공식 자동화만 볼 것.

시작:
  cd E:\github\openoffice\.dryforge\worktrees\hwp-nested-tables
  npm ci
  npm run test -w @genoffice/hwp
  npm run typecheck -w @genoffice/hwp

먼저 엔진의 기존 native 표 함수와 resolve_table_mut_by_cell_path를 읽고, 새 경로 API의 최소 목록을 정한 뒤 구현하라. 한 번에 모든 것을 끝내지 말고, 행/열 → 합치기/나누기 → 새 표 만들기 순서로 작게 나눠 각 단계마다 저장 왕복과 한컴 2024 확인을 하라. 완료하면 바뀐 파일, 통과한 시험, E2E 결과, 한컴 왕복 결과, 남은 한계를 짧게 보고하라.
```
