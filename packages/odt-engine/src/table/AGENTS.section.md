## 표 층 (`src/table`)

- `registerTableConverters(registry)`: 글자 층 다음에 등록한다(T6 순서: 글자 → 표 → 개체 → 쪽). 블록 처리기 id는 `table`, 새 표를 쓰는 `FreeWriter`도 같은 id다.
- 맡는 것: 본문의 `table:table`, 한컴이 글상자에 넣은 표를 담은 문단(`text:p > draw:frame > draw:text-box > table:table`, 글상자 안에 표 하나만 있는 틀), 셀 안의 표(맨 표와 글상자 표 모두, 몇 겹이든).
- 다른 층과의 약속: `tableFrameOf(frame)`이 null이 아닌 `draw:frame`은 표 층 몫이다. 개체 층(T4)의 인라인·블록 처리기는 이 틀을 가져가지 않는다. 가져가면 그 표가 편집기에 보이지 않고, 저장 때 틀 안의 표를 바꿔 끼우지 못한다.

### 열기 (ODF → OOXML)

- 글상자 문단: 표 말고 보이는 것이 없으면(책갈피는 괜찮다) 표만 편집기 표로 보인다. 글자가 함께 있으면 그 글자를 문단 하나(`paragraphToOoxml`, owner `table`)로, 표를 그 앞이나 뒤에 보인다. 문단 글자가 첫 틀보다 앞에 있으면 문단이 먼저다(`paragraphFirst`). 그 문단 안의 틀은 글자 층의 `keep` 표시로 남는다.
- 격자: 열 너비는 열 스타일(`style:column-width`, 없으면 `style:rel-column-width`, 그것도 없으면 표 너비를 나눔), 고정 배치(`w:tblLayout fixed`). 행 높이는 행 스타일 `style:row-height`(exact) 또는 `style:min-row-height`(atLeast). `table:table-header-rows`의 행은 `w:tblHeader`. 병합은 `w:gridSpan`과 `w:vMerge`(가려진 칸 중 세로 병합이 이어지는 첫 칸만 `w:tc`가 된다). 한컴은 가려진 칸도 열마다 요소로 쓰므로 칸의 열 번호는 행 안의 순번이다.
- 셀 모양: 테두리(`fo:border*`, 대각선), 채우기(`fo:background-color`), 세로 정렬, 안쪽 여백(`w:tcMar`). 표 수준 테두리와 기본 셀 여백은 없음/0이다. 글자처럼 놓인 틀의 표는 담은 문단의 정렬을 따른다.
- `w:tcPr`는 docx 엔진이 모델에서 다시 만들 때와 같은 꼴(`tcW`, `gridSpan`, `vMerge`, `tcBorders`, `shd`, `tcMar`, `vAlign` 순, `top` 정렬은 쓰지 않음)로 쓴다. 편집기가 표를 다시 만들어도 손대지 않은 칸의 `w:tcPr`는 같다. 저장은 이것으로 손대지 않은 칸을 가린다.
- 셀 내용: 문단(셀 안 목록의 문단 포함, 목록 번호도 보인다), 셀 안의 표, 셀 안의 글상자 표 문단. 표로 끝나는 칸과 문단이 없는 칸에는 OOXML이 요구하는 빈 `w:p`를 더하고 `synthetic`(`trailing`/`empty`)으로 적는다. 저장 때 그 빈 문단이 비어 있으면 없는 것으로 본다.
- 셀 안 표는 잠긴 칸 안에 있으면 그 칸들도 잠긴 것으로 친다.

### 다리 지도 `ext.table` (JSON)

- `TableExt = { version: 1, tables: TableRecord[], elements: { [bridge element id]: table id }, protectedCells: ProtectedCellRef[] }`.
- `TableRecord`: 원래 `table:table` 범위, `block`(다리 블록), `element`(최상위 표의 `w:tbl` 다리 요소 id, 셀 안 표는 null), `host`(셀 안 표: `{ table, row, col, index }`), `frame`(글상자 표: 문단 범위, `draw:frame` 범위, 그래픽 스타일 이름, 고정 방식), `headerRows`, `rows`(범위, 머리글 여부, 행 스타일, 높이 cm), `columns`(격자 열마다: 요소 범위, 스타일, 반복 여부, 너비 twips), `cells[row][col]`, `widthTwips`, `structureLocked`.
- 칸 주소는 (표의 다리 요소 id, 격자 행, 격자 열)이다. 행 번호는 머리글 행을 포함한 0부터, 열 번호는 칸의 첫 열.
- `CellRecord`(격자 칸마다, 기본값은 적지 않아 작다):
  - `cell`: 실제 칸. 범위(`start`/`openEnd`/`closeStart`/`end`/`selfClosing`), `tc`(`w:tr` 안 `w:tc` 순번), `style`, `units`, 병합이면 `colSpan`/`rowSpan`, 잠겼으면 `protected: true`, `synthetic`.
  - `covered`: 병합으로 가려진 칸. `start`/`end`, `anchor`(덮는 칸의 [행, 열]), `tc`(세로 병합이 이어지는 `w:tc`면 그 순번, 아니면 null).
  - `orphan`(어느 병합도 덮지 않는 가려진 칸)과 `filler`(행이 짧아 요소가 없는 자리, 범위 -1): 편집기에는 빈 칸으로 보이고, 거기 친 글자는 저장하지 않는다(경고).
- `units`: `p`(문단 기록 id와 범위), `t`(셀 안 표 id), `f`(글상자 표 문단: 범위, 글자 문단 id 또는 null, `paragraphFirst`, 표 id들). 셀 모양(테두리·채우기·정렬)은 저장하지 않고 저장 때 원래 셀 스타일에서 다시 계산한다.
- 블록 `data`: `{ kind: 'table' | 'frames', paragraph, paragraphFirst, tables }`.

### 잠긴 칸 (`protectedCells`)

- 판정: 칸의 `table:protected="true"`, 칸 스타일의 `style:cell-protect`에 `protected`가 든 값, 표의 `table:protected="true"`(모든 칸), 잠긴 칸 안에 든 표의 모든 칸.
- 목록 항목 하나: `{ table: <최상위 w:tbl의 다리 요소 id>, path: [{ row, col, index }…], row, col, tc }`. `path`는 바깥 표부터 셀 안 표로 들어가는 길(그 표의 칸 (row, col)의 `index`번째 표)이고 최상위 표면 `[]`다. `row`/`col`은 가장 안쪽 표의 격자 칸, `tc`는 그 행의 `w:tc` 순번(docx 엔진 `TableModel.rows[row][tc]`). 병합된 잠긴 칸은 왼쪽 위 칸 하나만 적는다.
- 읽기: `protectedCellsOf(map)`, `isProtectedCell(map, { table, path?, row, col | tc })`. 편집기(셀 편집 막기)와 명령줄·MCP가 이것만 읽으면 된다.
- 저장은 잠긴 칸을 절대 쓰지 않는다. 내용이나 모양이 바뀌었으면 원래 칸을 그대로 두고 경고한다. 쓰기 함수를 부르지도 않는다(새 스타일이 생기지 않게). 격자 변경이 잠긴 칸의 자리나 병합을 바꾸면(그 행·열 삭제, 병합, 나누기) 표 전체를 원래대로 두고 경고한다.

### 저장 (OOXML → ODF)

- 편집기는 바뀐 표를 두 가지로 저장한다(`apps/docs` `pmDocToSavePlan`): 칸 글자만 바뀌면 `patchTableCellTexts`(손대지 않은 칸·문단은 바이트 그대로), 구조나 모양이 바뀌면 `generateTableModelXml`(표 전체를 모델에서 다시). 둘 다 다리 요소와 XML이 달라 `identify`로 짝을 찾는다(같은 틈의 표 후보 중 칸 글자가 가장 많이 같은 것).
- 격자(행 수, 열 수, 병합)가 같으면 칸마다 비교한다.
  - 다리의 `w:tc`와 같으면 그대로. 아니면 문단마다: 다리 `w:p`와 같거나(숨은 `_odt` 책갈피 빼고) 글자가 같고 `paragraphToOdf` 결과를 다시 읽은 모양(글자별 span·링크 태그, 표시, 문단 시작 태그)이 원래와 같으면 원래 바이트, 아니면 새로 쓴 문단.
  - 바뀐 칸만 그 범위를 갈아 끼운다. 행·표 태그, 다른 칸, 틀은 바이트 그대로다.
  - 칸 문단 대응: 글자가 같은 공통 앞·뒤, 그 사이는 순서대로. 문단 수가 다르면(칸 안 Enter·Backspace) 글자 층과 같은 규칙으로 `placeMarkers`가 누름틀·책갈피를 글자를 따라 옮긴다(쌍은 글자가 더 많이 남은 문단에, 경고). 새 문단은 앞의 원래 문단 바로 뒤(목록 안이면 같은 목록 항목 안)에 넣고 그 문단 스타일을 따른다. 지운 문단은 범위째 지운다.
  - 칸 모양: `w:tcPr`(너비·병합 제외)가 다르면 엔진 모델의 채우기·세로 정렬·테두리를 원래 스타일에서 다시 계산한 값과 비교해, 바뀐 속성만 원래 셀 스타일의 복사본(`<이름>_io<n>`)에 덮어쓴다. 한 변의 테두리가 바뀌면 `fo:border`를 네 변 속성으로 풀어 쓴다.
  - 열 너비가 바뀌면 그 열의 스타일 복사본과 표 스타일 너비(원래 `style:width` + 변화량), 틀 너비를 고친다.
- 격자가 바뀌면 표를 원래 조각으로 다시 짠다.
  - 짝짓기: 행 수가 같으면 그대로, 다르면 행의 칸 글자 서명으로 LCS를 잡고 그 사이는 순서대로 짝짓는다(`mapSequence`). 열도 짝지은 행들로 같은 방법.
  - 원래 행과 짝지어졌고 칸이 모두 그대로면 행 바이트 그대로. 짝지은 칸은 바뀌지 않았으면 바이트 그대로, 병합 크기만 바뀌었으면 시작 태그의 `table:number-*-spanned`만 고친다.
  - 새 행은 이웃 행(위, 없으면 아래)의 행 시작 태그(행 스타일)와 같은 열 칸의 시작 태그(칸 스타일), 새 열은 이웃 열의 열 요소(너비가 다르면 그 열 스타일의 복사본)와 칸 시작 태그를 쓴다. 새 칸에는 `table:protected`를 옮기지 않는다. 새 칸 문단은 본뜬 칸의 첫 문단 스타일을 따른다.
  - 칸 합치기: 왼쪽 위 칸이 주인이고, 덮인 원래 칸들의 문단은 그 뒤에 붙어 원래 스타일과 표시를 지닌 채 쓰인다. 나누기: 새 칸은 나뉜 칸의 태그를 본뜬다. 가려진 칸은 원래 가려진 요소가 있으면 그것, 없으면 `<table:covered-table-cell/>`.
  - 머리글 행은 맨 앞의 연속한 머리글 행만 `table:table-header-rows`(원래 시작 태그)에 넣는다.
  - 표 시작 태그와 첫 열 앞의 내용은 원래 그대로다. 행 사이의 다른 요소(쪽 나눔 표시 등)는 다시 짤 때 빠진다.
- 틀 크기: 한컴 틀의 그래픽 스타일 `fo:min-height`는 표 행 최소 높이의 합과 같다(말뭉치 1,819개 틀에서 중앙값 차이 0). 그래서 새 높이 = 원래 `fo:min-height` + (새 행 높이 합 − 원래 행 높이 합)이다. 행 높이는 행 스타일 값, 새 행은 본뜬 이웃 행의 값. 너비도 열 너비 합의 변화만큼. 원래 그래픽 스타일의 복사본을 만들어 `draw:style-name`을 바꾸고, 틀 태그에 `svg:height`/`svg:width`/`fo:min-*`가 있으면 그것도 고친다. 틀의 나머지(문단, 위치, `draw:text-box`)는 바이트 그대로다.
- 틀 문단: 표가 바뀌면 원래 문단 안의 틀 범위만 갈아 끼운다. 혼합 문단의 글자가 바뀌면 글자 층이 쓴 문단(틀은 `keep` 표시로 원문 그대로 들어 있다)에서 원래 틀을 새 틀로 바꾼다. 표를 지우면 틀을 지우고, 순수 틀 문단의 표가 모두 지워지면 문단도 지운다.
- 구조 잠금(`structureLocked`): 반복 행(`table:number-rows-repeated`), 반복 칸, 행 묶음·열 묶음이 있는 표는 칸 글자만 고칠 수 있다. 격자 변경은 경고하고 원래대로 둔다. 한컴 파일에는 없다.
- 새 표(원래 없음): 본문 수준 `table:table`과 새 자동 스타일(표 너비·정렬, 열 너비, 행 높이, 칸 테두리·채우기·세로 정렬·안쪽 여백). 칸 테두리가 없으면 표 수준 테두리, 그것도 없으면 0.5pt 검은 실선. 칸 문단은 새 문단 규칙(`paragraphToOdf`, origin 없음)을 따른다.

### 알려진 한계

- docx 엔진의 `generateTableModelXml`은 칸 문단의 `w:pStyle`을 쓰지 않는다. 그래서 스타일 id가 없는 칸 문단은 "스타일이 바뀌지 않음"으로 본다. 편집기에서 표 구조를 바꾼 저장에서는 칸 문단의 스타일 변경이 전해지지 않는다.
- 행 높이 편집은 쓰지 않는다(새 행은 이웃 행 높이).
- 혼합 글상자 문단의 글자는 표의 앞이나 뒤 한 곳에만 보인다. 그 글자 문단만 지우는 편집은 무시하고 글자를 남긴다(경고). 한 틀 문단의 표들 사이에 친 새 내용은 그 문단 뒤에 쓴다(경고).
- 목록 항목 안의 글상자 표 문단(말뭉치 2개)은 글자 층이 문단으로 바꾸므로 표로 보이지 않는다(바이트 그대로 남는다).
- 머리글·꼬리글(styles.xml)의 표는 맡지 않는다.
- 핵심 층 `alignItems`의 `identify`는 다리 요소의 최상위 블록 owner로 후보를 거른다. 구역이나 목록 안의 표는 `identify`를 받지 못하고, 같은 틈에 짝 없는 요소가 하나뿐일 때의 1:1 대응으로만 이어진다.
- 합쳐진 다른 칸의 셀 안 표는 원래 바이트가 아니라 새 표로 쓴다.
- 인라인 처리기(`handler` 표시, 예: 그림)가 든 칸 문단은 모양 비교를 하지 않는다. 표를 다시 만든 저장에서 그 문단은 글자 층이 다시 쓴다.
- `ext.table`은 격자 칸마다 기록하므로 큰 문서에서 크다(말뭉치에서 가장 큰 content.xml 12.8MB 문서에 5.7MB).

### 테스트

- `tests/table-bridge.test.ts`(세 가지 배치, 병합·너비·높이·모양, 잠긴 칸 목록과 JSON 왕복, 편집 없는 왕복과 다시 만든 표의 왕복), `table-edit.test.ts`(칸 하나, 칸 안 누름틀, 칸 안 나누기, 잠긴 칸, 셀 안 표, 혼합 틀 문단, 칸 채우기, 새 표), `table-structure.test.ts`(행·열 추가·삭제, 합치기·나누기, 틀 크기, 잠긴 칸이 있는 구조 변경), `table-cells.test.ts`(칸 안 목록, 구역 안 표, 빈 칸).
- `tests/helpers/table-editor.ts`: 편집기의 두 저장 방식(`patchCells` = `patchTableCellTexts`, `regenerate` = `generateTableModelXml`)과 등록 순서(`tableRegistry`). `table-fixtures.ts`: 한컴 모양의 표 문서.
- `tests/table-corpus.test.ts`(`ODT_CORPUS`): 모든 표 변환, 편집 없는 저장이 원본과 같음, 첫 표를 편집기가 그대로 다시 만들어도 쓰는 것이 없음, 첫 표의 칸 하나를 고치면 그 칸만 바뀜.
