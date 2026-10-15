# odt-engine (`@genoffice/odt-engine`)

OpenDocument Text(`.odt`)를 워드 편집기가 다루는 docx로 바꾸고, 편집 결과를 원본 ODT에 고친 곳만 끼워 넣어 저장한다. 원본 ODT가 없는 문서는 ODT로 통째로 바꾼다.

## 맡은 범위

- 핵심 층(`src/core`, 진입점 `src/core/index.ts`): 나머지 층(글자, 표, 개체, 쪽, 조립)이 모두 이 위에 선다.
  - `openOdt`: zip 관문 → 패키지 읽기 → `mimetype` 검사 → 암호 검사 → 본문 위치 지도 → 스타일 표 → 생성 프로그램 판별.
  - `readOdtPackage`: 항목마다 원래 바이트(압축 푼 것), 원래 압축 방식, 원래 순서(로컬 헤더 위치 순)를 지닌다. 다시 묶을 때 이것을 쓴다.
  - `scanOdtBody`: `office:text`의 최상위 요소와 그 안의 문단·목록·구역·색인·표·행·셀·가려진 셀·글상자·그림·개체·도형·책갈피·메모·각주를 원본 문자열의 위치(`start`/`openEnd`/`closeStart`/`end`)로 기록한다.
  - `readOdtStyles`: 공용 스타일, 기본 스타일, 목록 스타일, 쪽 모양, 바탕쪽(머리글·꼬리글과 왼쪽·첫쪽 변형), 두 파트의 자동 스타일을 위치와 함께 담고 상속을 풀어 준다(`resolve`).
  - 변환 뼈대(`convert.ts`, `flow.ts`, `docx-package.ts`): 양방향 변환의 문맥, 다리 지도, 처리기 등록, 본문 흐름 걷기, 다리 docx 묶기. 아래 "변환 뼈대" 절.
- 글자 층(`src/text`, 진입점 `src/text/index.ts`): 문단·제목·글자 묶음(`text:span`)·공백·탭·줄 바꿈·쪽 나누기·하이퍼링크·목록·누름틀 책갈피, 공용 스타일과 기본 스타일. 아래 "글자 층" 절.

## 맡지 않는 것 (경계)

- docx의 해석과 저장은 `packages/docx-engine`이 한다. 이 패키지는 그 엔진을 고치지 않고 공개 API만 쓴다.
- 편집 화면, 저장 창, 꺼 둔 기능의 안내는 `apps/docs`가 한다.
- 표(`src/table`), 그림·개체·각주·메모(`src/objects`), 쪽·머리글·구역(`src/page`), 공개 API와 다시 묶기(`src/index.ts`, `src/assemble`)는 각 작업이 맡는다. 글자 층은 이들을 처리기 등록으로만 만난다.

## 항상 지켜야 하는 것

- 렌더러 번들에 들어가므로 `node:*`를 import하지 않는다.
- 받은 ODT에서 고치지 않은 부분은 바이트 그대로 남긴다. 고친 것이 없는 저장은 원본 바이트를 그대로 돌려준다.
- 다리 지도(`BridgeMap`)는 JSON 그대로다. 함수, 클래스 인스턴스, `Map`, 타입 배열을 넣지 않는다. 렌더러와 뒷단, 명령줄 프로세스 사이를 오간다.
- 누름틀(`text:bookmark-start text:name="NormalField…"` … `text:bookmark-end`)의 쌍과 이름은 문단이 남아 있는 한 바이트 그대로 남는다. 이름 있는 책갈피를 조용히 버리지 않는다.
- 한컴 스타일 이름과 탭 목록은 그대로 둔다. 고친 문단은 원래 자동 스타일을 복사한 새 자동 스타일을 쓰고, 원래 스타일은 건드리지 않는다.

## 이 모듈의 방식

- XML을 DOM으로 만들었다가 다시 쓰지 않는다. `XmlScanner`/`walkElements`가 원본 문자열의 위치만 돌려주고, 범위로 자른 문자열이 그 요소의 원문과 정확히 같다. 저장은 바뀐 범위만 갈아 끼운다.
- 읽기는 너그럽다. `mimetype`이 맨 앞이 아니거나 압축돼 있어도, `office:version`이 없어도, 닫히지 않은 태그가 있어도 연다. 깨진 태그는 `body.warnings`에 남기고 넘어간다.
- 거부는 `OdtOpenError`의 `code`로 구분한다: `encrypted`(manifest에 `manifest:encryption-data`), `not-odt-text`(`mimetype`이 ODT 글 문서가 아님, `.ott` 포함), `zip-rejected`(docx와 같은 한도의 압축 관문), `corrupt`.
- 파트 글자는 BOM을 지운 채가 아니라 U+FEFF로 남겨 디코드한다. 그래서 위치가 다시 인코딩한 바이트와 어긋나지 않는다.
- 접두사가 표준과 다른 문서도 뿌리 요소의 `xmlns:` 선언으로 표준 이름(`text:p`)에 맞춰 읽는다. 노드의 `name`은 표준 이름, `tag`는 파일에 쓰인 그대로다.
- 스타일 이름은 쓰인 그대로 둔다(띄어쓰기, 한글, `+`). 엔티티는 풀어서 `name`에, 원문은 `rawName`에 둔다. 한컴은 정의하지 않은 부모(`Standard`, `Frame`)를 가리키는데, 이것은 오류가 아니라 `missingParent`로 알린다.
- 자동 스타일은 다른 스타일의 부모가 되지 못한다. 부모는 공용 스타일에서만 찾고, 자동 스타일은 파트별 범위(`content`/`styles`)로 따로 찾는다. 두 파트에 같은 이름(`P1`)이 있을 수 있다.
- 한컴의 `draw:equation`은 수식이 아니라 도형(`draw:custom-shape`)의 모양 계산식이다. 노드로 잡지 않는다. 수식 개체는 `draw:object`다.
- 모든 위치(문단 글자 위치 포함)는 UTF-16 단위다. 파트 문자열의 위치는 원본 ODT의 디코드한 `content.xml`/`styles.xml` 문자열 기준이다.

## 변환 뼈대 (`src/core`)

### 전체 흐름

- 열기: ODT → `OdfToOoxmlContext` → `convertOdtStyles`(글자 층) → `convertOdtBody` → `buildBridgeDocx` → 다리 docx 바이트 + `ctx.map`(다리 지도).
- 저장: 원본 ODT + 다리 지도 + 편집된 docx → `parseDocx(편집된 docx)` → `OoxmlToOdfContext` → `rebuildOdtBody` → `updateOdtStyles`(글자 층) → `rctx.finish()` → 파트별 `TextPatch[]` → `applyTextPatches`로 원본 `content.xml`/`styles.xml` 문자열에 적용 → 다시 묶기(T6).
- 다리 docx는 매번 같은 입력에서 같은 결과가 나온다. 다리 지도의 `elements[*].xml`이 다리 docx 본문 요소의 원문 그대로이므로, 저장 때 다리 docx를 다시 만들 필요가 없다.

T6이 부르는 순서(예):

```ts
const doc = await openOdt(odtBytes)
const registry = registerTextConverters(new ConversionRegistry()) // 그다음 T3·T4·T5의 등록 함수
const ctx = new OdfToOoxmlContext(doc, registry)
convertOdtStyles(ctx) // 반드시 본문보다 먼저: 문단이 docx 스타일 id를 찾는다
convertOdtBody(ctx)
const docxBytes = await buildBridgeDocx(ctx)
const bridge = ctx.map // JSON

// 저장
const edited = await parseDocx(editedDocx)
const rctx = new OoxmlToOdfContext(doc, bridge, edited, registry, {
  editedStylesXml: await readDocxPart(editedDocx, 'word/styles.xml'),
})
rebuildOdtBody(rctx)
updateOdtStyles(rctx)
const patches = rctx.finish() // { 'content.xml': TextPatch[], 'styles.xml': TextPatch[] }
const contentXml = applyTextPatches(doc.contentXml, patches['content.xml'])
```

### 다리 지도 (`BridgeMap`, `convert.ts`)

- `blocks: BridgeBlock[]`: 본문 흐름의 ODF 블록. `office:text`의 자식(`parent: null`)과 컨테이너(구역 등)의 자식. 원본 범위(`start`/`end`), 변환한 처리기 id(`owner`), 만든 OOXML 요소(`elements`), 자식 블록(`children`), 처리기 몫의 JSON(`data`). OOXML이 없는 블록(`owner: 'keep'`, 예: `text:sequence-decls`, 주석)은 저장 때 원래 자리에 그대로 다시 들어간다.
- `elements: BridgeElement[]`: 다리 docx 본문의 최상위 요소(`w:p`, `w:tbl` …)를 순서대로. `id`는 본문 요소 순번과 같다. `xml`은 원문 그대로, `block`은 만든 블록, `paragraph`는 문단 기록 id.
- `paragraphs: BridgeParagraph[]`: 변환한 문단 하나하나(본문, 목록, 셀, 글상자, 머리글 어디든). 원본 범위, 요소 이름(`text:p`/`text:h`), 스타일 이름, 다리 docx에서 읽히는 글자 그대로의 `text`, `markers`, 써 넣은 `w:pPr`(`pPr`, 같으면 문단 모양이 안 바뀐 것), 목록 소속(`list`), 기록한 처리기(`owner`).
- `BridgeMarker`: 문단 안의 글자 아닌 것을 글자 위치(`offset`)에 묶는다. `kind`는 `bookmark-start`/`bookmark-end`/`bookmark`(책갈피), `keep`(처리기가 없어 OOXML로 옮기지 않은 인라인 요소, 원래 자리에 다시 넣음), `text`(처리기가 없는 필드 등 글자가 있는 인라인 요소, 그 글자가 그대로면 원문을 다시 넣고 바뀌면 보통 글자로 씀), `handler`(등록한 인라인 처리기가 만든 것, `owner`·`length`). `pair`는 같은 문단 안 짝 책갈피의 순번, `field`는 한컴 누름틀(`NormalField…`), `ooxmlName`은 다리 docx에 넣은 숨은 책갈피 이름.
- `styles`: docx 문단 스타일과 ODF 공용 스타일의 대응(`paragraph[]`, 써 넣은 `w:style` 원문 포함), `docDefaults` 원문, 기본 스타일의 계열, 새 문단의 부모로 쓸 공용 스타일(`baseParagraphStyle`).
- `lists: BridgeList[]`: `w:numId` ↔ ODF 목록 스타일 이름과 그 목록 블록들.
- `ext: Record<string, JsonValue>`: 작업별 칸. T3는 `table`, T4는 `objects`, T5는 `page`처럼 자기 이름 하나를 쓴다(`ctx.ext(key, init)`, 저장 때 `rctx.ext(key)`). 보호된 칸 좌표, 자리 표시 id 같은 공개 정보도 여기 둔다.
- `warnings`: 근사하거나 옮기지 못하고 그대로 둔 것.
- 숨은 책갈피 이름: 문단마다 `_odtp<문단 id>`(정체 표시, 편집기가 문단을 다시 만들어도 다시 써 준다), 표시 위치마다 `_odtm<문단 id>_<순번>`. `_`로 시작하므로 편집기는 숨긴다. 위치를 되살리는 데는 쓰지 않는다(엔진이 다시 만든 문단은 책갈피를 맨 앞의 빈 쌍으로 옮긴다). 위치는 기록의 `offset`으로 되살린다.

### 처리기 등록 (`ConversionRegistry`)

같은 대상에 여럿이 등록되면 나중에 등록한 것이 먼저다. 다른 작업은 이 파일들을 고치지 않고 등록만 한다.

- `addBlock(BlockConverter)`: 본문 흐름의 블록 하나를 맡는다.
  - `match(node, ctx)`로 고른다. 예: T3은 `node.kind === 'table'`, 그리고 글상자 안 표를 담은 문단(`text:p > draw:frame > draw:text-box > table:table`)을 글자 층보다 먼저 가져간다.
  - `toOoxml(ctx, node, env)` → `{ elements: [{ xml, kind, paragraph }], data }`. `env.blockId`의 블록은 이미 지도에 있다. 순서가 중요한 경우(안쪽에서 `convertNode`를 부르는 경우) `ctx.addElement(env.blockId, …)`로 직접 넣고 빈 `elements`를 돌려준다.
  - `toOdf(rctx, block, items, env)`: 그 블록의 요소가 "바뀌지 않은 채 빠짐없이 순서대로" 돌아오지 않았을 때만 불린다. `items`는 그 블록을 잇는 편집된 요소와 그 사이에 새로 들어온 요소(편집 순서, 지운 것은 없음). 블록의 원본 범위를 대신할 ODF를 돌려준다. 안 바뀐 요소(`item.unchanged`)는 원본 범위를 복사한다.
  - `identify?(rctx, item, candidates)`: XML이 그대로가 아니라 바로 짝을 못 찾은 편집된 요소를 자기 요소로 가져간다(`candidates`는 앞뒤로 짝을 찾은 요소 사이의, 아직 주인이 없는 이 처리기의 요소).
  - `absorbs?(rctx, block, item)`: 블록 바로 앞뒤의 새 요소가 그 블록에 속하는지(예: 목록 끝에서 친 새 항목).
- `addInline(InlineConverter)`: 문단 안 인라인 요소(`names`: `draw:frame`, `text:note`, `office:annotation`, `office:annotation-end` …). `toOoxml(ctx, el, env)` → `{ kind: 'xml', xml, text }`(문단 안 그 자리에 넣을 OOXML, `text`는 엔진이 그 XML에서 읽는 run 글자 그대로, 표시뿐이면 `''`) 또는 `{ kind: 'runs', runs }` 또는 `{ kind: 'keep' }`/`null`(기본 처리). 기록에는 `handler` 표시로 남는다.
- `addRunWriter(RunWriter)`: 편집된 문단의 원자 run(그림, 각주 번호 등)을 ODF로. `match(run)`, `toOdf(rctx, run, env)`. 그 run의 글자는 쓰지 않는다. 처리기 없는 그림·각주 run은 경고하고 버린다.
- `addInjector(ParagraphInjector)`: 편집된 문단의 글자 위치에 ODF를 끼운다(메모의 시작·끝 표시 등). `env.mapOffset(원래 위치, 'start' | 'end')`로 원래 문단의 위치를 편집된 글자 위로 옮길 수 있다.
- `addFreeWriter(FreeWriter)`: 원래 블록이 없는 새 요소(새 표, 새 그림 문단). 연속한 같은 처리기 몫을 한 번에 받는다. `env.neighbours`에 앞뒤로 원래 요소가 있으면 알려 준다.

### 기본 처리 (처리기가 없을 때)

- 블록: 구역(`text:section`)은 컨테이너(`owner: 'container'`, 자식을 흐름으로 변환하고 저장 때 원래 감싸개 안에 다시 씀). 나머지(처리기 없는 표, 차례 등)와 `other`/`opaque`는 OOXML 없이 `keep`: 화면에는 없고 저장 때 원래 자리에 바이트 그대로 남는다(`warnings`에 남김). T5가 구역을 맡을 때는 `convertContainer`/`rebuildContainer`를 감싸 쓴다.
- 인라인: `draw:*`, `office:*`, `text:note`, 변경 기록·색인 표시, `text:soft-page-break` 등은 `keep`(숨은 책갈피 하나, 저장 때 옮긴 위치에 원문 그대로). 글자가 있는 그 밖의 요소(`text:page-number` 같은 필드)는 `text`.

### 문맥

- `OdfToOoxmlContext`: `doc`, `registry`, `map`, `docx`(스타일·번호 정의·관계·추가 파트·최종 `sectPr`·이름공간을 모으는 곳, `buildBridgeDocx`가 묶음), `generate`(엔진 `generateParagraphXml`용), `part(part)`(파트 문자열·접두사·글꼴 이름표), `addBlock`/`addElement`, `reserveParagraphId`/`addParagraph`(문단을 시작할 때 id를 받고 끝날 때 기록), `allocateBookmarkId`, `addRelationship`/`addHyperlink`, `warn`, `ext`. 그림 바이트는 `docx.parts.push({ path: 'word/media/…', data })`와 `addRelationship`으로 넣는다. T5는 `docx.sectPr`을 채운다(비우면 기본 쪽 모양에서 만든다).
- `OoxmlToOdfContext`: `doc`, `map`, `edited`(편집된 docx의 `parseDocx` 결과), `registry`, `options.editedStylesXml`, `part(part)`, `patch(part, start, end, xml)`(좁은 교체, 겹치면 안 됨), `addAutomaticStyle(part, xml)`, `derivedStyle(part, key, base, build)`(같은 `key`면 같은 새 스타일을 공유), `allocateStyleName(base)`(두 파트의 기존·새 이름 어디와도 겹치지 않는 `<base>_io<n>`), `fontFace(part, family)`(없으면 `style:font-face`를 더함), `newAutomaticStyles(part)`, `warn`, `ext`, `finish()`(새 자동 스타일·글꼴 선언·빠진 이름공간 선언을 더한 파트별 패치).

### 정렬 (`alignItems`, `rebuildFlow`)

1. XML이 다리 요소와 글자 그대로 같으면 그 요소(안 바뀜).
2. 문단은 숨은 정체 책갈피 `_odtp<id>`로 찾는다(편집기는 제자리 편집한 문단에 숨은 책갈피를 다시 쓰고, Enter로 쪼갠 뒷부분에는 쓰지 않는다).
3. 처리기의 `identify`.
4. 앞뒤 짝 사이에 짝 없는 편집 요소 하나와 같은 종류의 다리 요소 하나만 남으면 둘을 잇는다.

블록 단위로 묶어 바뀌지 않았으면 원본 범위를 복사하고(사이 공백까지), 아니면 그 처리기의 `toOdf`에 넘긴다. 아무 블록에도 속하지 않는 새 요소는 `FreeWriter`로 간다.

## 글자 층 (`src/text`)

- `registerTextConverters(registry)`: 문단·제목·목록 블록(`textBlockConverter`, id `text`)과 새 문단 쓰기(`textFreeWriter`).
- `convertOdtStyles(ctx)`: 공용 문단 스타일 → docx 문단 스타일(표시 이름 그대로, `basedOn`은 부모 사슬). `Standard`가 있으면 `Normal`과 대응. 기본 스타일 → `w:docDefaults`. ODF는 부모의 탭 목록을 대체하고 OOXML은 합치므로, 탭은 docx 스타일에 넣지 않고 문단에 실제 탭 목록을 직접 넣는다. `style:default-outline-level`(한컴 "개요 n")은 docx 제목으로 바꾸지 않는다(한컴은 `text:h`를 쓰지 않는다). 편집기의 제목·하이퍼링크 명령을 위해 없으면 `Heading1…6`, `Hyperlink`를 더한다.
- `paragraphToOoxml(ctx, range, { part, owner, block, list })` → `{ xml, paragraph, model }`: 문단 하나를 `w:p`로 바꾸고 기록한다. T3(셀 문단), T4(각주·메모 본문), T5(머리글 문단, `part: 'styles.xml'`)가 그대로 쓴다. `w:pStyle`은 자동 스타일의 부모 공용 스타일, 자동 스타일 자신의 문단 속성은 직접 `w:pPr`, run은 문단 자동 스타일의 글자 속성 위에 span·링크 스타일을 겹친 직접 `w:rPr`이다. OOXML은 엔진의 `generateParagraphXml`이 쓴다. 문단 스타일이 굵게인데 span이 보통이면 `w:b w:val="0"`을 쓴다.
- `paragraphToOdf(rctx, para, origin, { part, neighbour, follows })`: 편집된 문단(`editedParagraphFromBlock(block)`, 셀이면 `editedParagraphFromTableParagraph(tp)`)을 ODF로. `origin`은 이 문단이 잇는 원래 문단 기록(없으면 새 문단).
  - 문단 모양: `rawPPr`이 기록의 `pPr`과 같으면 안 바뀐 것. 바뀐 속성만 원래 자동 스타일의 복사본에 덮어쓴다(`editStyleXml`: 이름만 바꾸고 다른 속성·탭 목록·한컴 속성·모르는 자식은 바이트 그대로). 원래 스타일이 공용 스타일이면 그것을 부모로 한 새 자동 스타일.
  - 새 문단: 바로 앞의 원래 문단(`follows`, Enter로 쪼갠 앞부분이나 그 뒤에 친 문단, 새 문단이 이어져도 같은 것)과 docx 스타일이 같으면 그 문단의 자동 스타일에서 만든다. 모든 속성·탭 목록·한컴 속성을 복사하고 다른 것만 덮어쓰며, 바뀐 것이 없으면 그 스타일 이름을 그대로 쓴다. 구역 시작(`style:master-page-name`)은 앞 문단의 것이므로 복사본에서 뺀다. 앞에 원래 문단이 없거나 docx 스타일이 다르면 docx 스타일에 대응하는 공용 스타일(없으면 `baseParagraphStyle`)을 부모로 한 새 자동 스타일.
  - 지운 값: 고친 문단에서 원래 있던 값이 없어졌으면 편집기에서 지운 것이다(고치지 않은 문단은 원래 바이트를 쓰므로 여기 오지 않는다). 문단 속성은 복사본에서 그 속성을 빼서 공용 스타일의 값을 따르게 한다(탭 목록은 빈 목록, 앞 간격은 0). 글자 속성은 docx run이 그때 따르는 문단 스타일 사슬의 값을 쓰고, 그것도 없으면 속성을 뺀다. 색을 지우면 `fo:color`가 빠지고, 형광펜은 `transparent`, 밑줄·취소선·굵게는 끔, 크기는 문단 스타일의 크기.
  - 글자 모양: 편집된 글자마다 원래 글자를 찾아(앞뒤 공통 부분, 가운데는 LCS) 모양이 같으면 원래 span·링크 태그를 그대로 쓰고, 다르면 원래 span 스타일의 복사본에 바뀐 속성만 덮어쓴 새 스타일을 쓴다. 새 문단은 이웃 원래 문단의 끝 글자 모양을 본보기로 쓴다.
  - 누름틀·책갈피: 원래 위치를 편집된 글자 위로 옮긴다. 시작은 앞의 남은 글자 바로 뒤, 끝은 뒤의 남은 글자 바로 앞으로 가므로 쌍 안에서 친 글자는 쌍 안에 남고, 쌍 안 글자를 모두 지우면 빈 쌍이 된다. 문단을 지우면 쌍도 사라진다. 짝 없는 시작·끝, 점 책갈피, 같은 이름도 원문 그대로 옮긴 자리에 쓴다.
  - 문단 나누기·합치기: 고친 원래 문단과 그 뒤에 이어지는 새 문단들(Enter로 쪼갠 뒷부분)을 한 글자열로, 원래 문단과 그 바로 뒤에서 지워졌지만 글자가 절반 이상 남은 원래 문단들(Backspace로 합친 문단)을 다른 한 글자열로 보고 표시를 옮긴 뒤(`placeMarkers`), 옮긴 위치가 든 문단에 쓴다. 문단 경계에서 시작은 뒤 문단, 끝은 앞 문단으로 간다. 책갈피 쌍은 문단을 넘지 않는다: 쌍의 글자가 나뉘면 글자가 더 많이 남은 문단에 쌍을 두고 경고한다. 글자가 남지 않은 지운 문단의 표시는 문단과 함께 사라진다(일부만 남았으면 경고). 그래서 글자 층 블록은 바로 앞뒤의 새 문단을 자기 몫으로 받는다(`absorbs`).
  - 공백은 한컴처럼 `' <text:s/>'`, 맨 앞·맨 끝 공백은 `text:s`. 탭 `text:tab`, 줄 바꿈 `text:line-break`. 문단 안에 친 쪽 나누기는 문단을 나누고 뒷부분에 `fo:break-before="page"`를 준다. `fo:break-after="page"`는 다리 docx에서 문단 끝의 쪽 나누기 글자(`\f`)다.
  - 제목은 `text:h`와 `text:outline-level`, 원래 시작 태그의 다른 속성은 그대로.
- 목록: ODF 목록 스타일 하나 = `w:abstractNum` 하나(한국어 번호 형식 `가, 나, 다, ...` → `ganada` 등), 최상위 `text:list` 하나 = `w:num` 하나(`text:continue-list`/`text:continue-numbering`이면 이어 쓰는 목록의 것을 함께 씀). 저장 때 연속한 목록 문단을 `w:numId`별로 묶어 다시 쓰고, 원래 목록의 시작 태그(`xml:id` 포함)는 한 번만 다시 쓴다. 편집기가 새로 만든 목록은 편집된 docx의 번호 정의로 새 자동 목록 스타일을 만든다.
- `updateOdtStyles(rctx)`: 편집된 docx의 `styles.xml`에서 다리가 쓴 것과 달라진 스타일만 대응하는 ODF 공용 스타일에 바뀐 속성만 고쳐 쓴다(이름 그대로). `w:docDefaults`의 글꼴이 바뀌면 기본 스타일을 고친다(없으면 `style:default-style`을 더함).
- 하이퍼링크: `text:a` → 링크 run(`plain`이라 엔진의 Hyperlink 글자 스타일을 붙이지 않음). 저장 때 같은 주소면 원래 `text:a` 시작 태그를 그대로 쓴다.

### 알려진 한계

- docx 엔진은 `w:t` 안의 글자 `&#38;`처럼 엔티티 모양의 글자를 한 번 더 풀어 읽는다. 그런 문단을 고치면 그 글자는 `&`가 된다(말뭉치 66개 중 문단 1개).
- 표 칸의 문단(`TableParagraph`)은 숨은 책갈피를 지니지 않는다. 칸 문단과 원래 문단의 대응은 T3이 칸 위치로 정해 `paragraphToOdf`에 `origin`으로 넘긴다.
- 문단 모양 중 다리가 옮기지 않는 것(테두리, 세로 정렬 등)은 원래 스타일의 복사본에 그대로 남지만 편집기에서 바꿀 수 없다.
- 지운 글자 속성을 문단 스타일 사슬의 값으로 되돌릴 때, 그 값을 문단 자동 스타일이나 바깥 span이 따로 정하고 있으면 그 값이 남을 수 있다(docx는 그 값을 run에 직접 썼기 때문). 한컴 문서는 span 자동 스타일이 모든 글자 속성을 지녀 해당이 드물다.

## 테스트

- `npm run test -w @genoffice/odt-engine`. 실제 정부 파일은 저장소에 넣지 않고, 한컴 ODT의 특징을 흉내 낸 합성 파일로 시험한다.
- 합성 파일 생성기는 `tests/helpers/`에 있다. 모든 층의 테스트가 함께 쓴다.
  - `build-odt.ts`: `buildOdt(options)`/`buildOdtPackage(options)`. 기본값이 한컴과 같다(항목 이름순이라 `mimetype`이 맨 앞이 아니고 압축됨, `office:version` 없음, 문단마다 자동 스타일과 탭 목록, 머리글·꼬리글이 있는 바탕쪽 둘). `body`, `extraContentAutomaticStyles`, `extraCommonStyles`, `masterStyles`, `pictures`, `extraEntries`, `overrideParts`, `encrypted`, `mimetype`, `generator`로 무엇이든 바꿔 넣는다.
  - `hancom-fragments.ts`: 한컴 모양의 조각(`hPara`, `hTable`, `hCell`, `hFramedTable`, `hFieldBookmark`, `hFootnote`, `hAnnotation`, `hImageFrame`, `hFormulaObject`, `hCustomShape` 등). 조각은 쓴 문자열을 그대로 돌려주므로 테스트가 "범위로 자른 원문 = 조각"을 바로 비교할 수 있다.
  - `hancom-sample.ts`: 위 특징을 모두 담은 문서 하나(글상자 안의 표, 본문 표, 셀 안의 표, 병합·가려진 셀, 잠긴 셀, 누름틀 책갈피, 그림, 각주, 메모, 수식 개체, 도형, 목록, 구역, 차례, 같은 바탕쪽을 쓰는 여러 구역).
  - `bridge.ts`: `odtToBridge`(열기, 지도는 JSON 왕복), `editorSave`(편집기처럼 `rawPPr`을 다시 쓰거나 합쳐 `saveDocx`로 저장; `keep`/`edit`/`insert`/`xml`), `editOnly`, `replaceText`, `writeBack`(편집된 docx를 원본 ODT 문자열에 되돌려 씀). 다른 층의 왕복 시험도 이것을 쓴다.
  - `text-fixtures.ts`: 글자 층 시험 문서(누름틀, 제목, 링크, 목록, 쪽 나누기, 공백, 필드·각주, 지우기용 강한 글자 모양).
- 실제 파일 점검은 저장소 밖에서만 한다: `ODT_CORPUS=<폴더> npm run test -w @genoffice/odt-engine`. 변수가 없으면 `tests/core-corpus.test.ts`, `tests/text-corpus.test.ts`는 건너뛴다. 글자 층 점검은 모든 문단(셀·글상자·머리글 포함)을 변환해 다리 docx에서 같은 글자로 읽히는지, 편집 없이 되돌려 쓰면(`rawPPr` 지름길 없이 모든 속성을 비교해도) 같은 글자이고 새 스타일이 없는지, 편집 없는 저장이 원본과 같은지, 문단 하나를 고치면 그 문단만 바뀌는지 본다.
