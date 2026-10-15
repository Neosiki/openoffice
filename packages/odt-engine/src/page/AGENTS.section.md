## 쪽 층 (`src/page`)

쪽 모양(`style:page-layout`), 바탕쪽(`style:master-page`, 머리글·꼬리글과 첫쪽·왼쪽 변형), 구역을 docx의 구역과 머리글·꼬리글 파트로 옮기고, 편집 결과를 `styles.xml`의 쪽 모양·바탕쪽과 구역을 시작하는 문단의 스타일에 되돌려 쓴다.

### T6이 부르는 순서

```ts
const registry = registerPageConverters(registerTextConverters(new ConversionRegistry())) // 그다음 T3·T4
// 열기
convertOdtStyles(ctx)
convertOdtBody(ctx)
convertOdtPage(ctx) // 본문 다음, buildBridgeDocx 앞: 다리 요소에 구역 나눔을 넣고 ctx.docx.sectPr를 채운다
const docxBytes = await buildBridgeDocx(ctx)

// 저장
const items = await preparePageWriteBack(rctx) // rebuildOdtBody 앞: 쪽 모양·바탕쪽 패치를 넣고 본문 항목을 돌려준다
rebuildOdtBody(rctx, items)
updateOdtStyles(rctx)
const patches = rctx.finish()
```

- `registerPageConverters`는 `registerTextConverters` 다음에 부른다. 그때 등록된 글자 층 블록 처리기를 감싼 처리기(같은 id `text`)를 더하고, 머리글의 쪽 번호 필드 처리기(인라인, run writer)를 더한다. 감싼 처리기는 글자 층이 받을 노드만 받는다. 먼저 등록된 다른 처리기(표, 개체)가 받는 노드는 건드리지 않는다.
- `preparePageWriteBack`은 비동기다(편집된 docx의 머리글 파트를 읽는다). 저장 한 번에 한 번, 이 저장용 다리 지도 사본으로 부른다. 지도의 다리 요소에서 넣었던 구역 나눔을 걷어 낸다(몇 번 불러도 같다).

### 열기 (ODF → OOXML)

- 쪽 흐름(run): 문단(또는 표) 스타일의 `style:master-page-name`이 바뀌는 곳마다 새 쪽 흐름이 시작한다. 첫 흐름은 그런 문단이 없으면 `Standard`(없으면 첫 바탕쪽)를 쓴다. 요소가 없는 블록(그대로 두는 표 등)이 바탕쪽을 바꾸면 다음 요소부터다.
- docx 구역: 쪽 흐름마다 하나, 그리고 `text:section`의 앞뒤에서 이어지는 구역(`w:type continuous`, 그 구역 스타일의 단 수). 마지막이 아닌 구역은 마지막 문단의 `w:pPr`에 `w:sectPr`를 넣는다(문단이 하나도 없는 구역은 다음 구역에 합친다). 마지막 구역은 `ctx.docx.sectPr`.
- 위치 계산: ODF는 머리글을 쪽 여백 안에 둔다. 한컴도 `fo:margin-top`을 위쪽 여백으로, 머리글 스타일의 `svg:height`를 머리말 길이로 읽고, 바탕쪽에 머리글이 없어도 그 길이를 비워 둔다(한컴 판독 결과 36개로 확인). 그래서 `w:header = fo:margin-top`, `w:top = fo:margin-top + 머리글 높이(svg:height, 없으면 fo:min-height) + 머리글 간격(fo:margin-bottom)`. 아래쪽도 같다(꼬리글 간격은 `fo:margin-top`).
- 쪽 번호: 쪽 모양의 `style:num-format` → `w:pgNumType w:fmt`, 흐름을 시작하는 문단 스타일의 `style:page-number`(숫자) → `w:start`.
- 단: 쪽 모양의 `style:columns`, 구역 스타일의 `style:columns` → `w:cols`. 보여 주기만 한다.
- 머리글·꼬리글: 쪽 흐름마다 자기 파트를 따로 받는다(같은 바탕쪽을 쓰는 흐름도 사본). 그래야 한 흐름만 고친 것을 저장 때 알아본다. 문단은 글자 층 `paragraphToOoxml(..., { part: 'styles.xml', owner: 'page' })`, 표 같은 다른 자식은 다리 docx에 넣지 않는다(저장 때 제자리에 바이트 그대로). 칸 채우기:
  - `header-first`/`footer-first`가 있으면 `w:titlePg`. 첫 쪽 머리글이 없으면 그 칸에 보통 머리글 사본(`fallback`, ODF도 그렇게 보인다).
  - 어느 바탕쪽이든 `header-left`/`footer-left`가 있으면 `w:evenAndOddHeaders`(settings.xml을 만든다). 왼쪽 머리글이 없는 바탕쪽의 짝수 쪽 칸에는 보통 머리글 사본.
  - 앞 흐름에 머리글이 있었는데 이 흐름의 바탕쪽에는 없으면 빈 파트(`empty`): Word가 앞 구역의 것을 물려받지 않게 한다.
- 머리글의 `text:page-number`/`text:page-count`는 Word 필드(PAGE/NUMPAGES)로 보여 준다(편집기에서는 쪽 번호 표시 문자). 본문의 같은 필드는 글자 층 기본 처리 그대로다.

### 저장 (OOXML → ODF)

1. 걷어 내기: 다리 요소와 편집된 요소의 문단 속 `w:sectPr`를 걷어 내, 글자 층은 구역 나눔 없는 문단으로 비교한다. 글자 없는 구역 나눔 문단(엔진의 passthrough)은 문단으로 되돌리고, 편집기가 새로 넣은 빈 구역 나눔 문단은 ODF에 쓰지 않는다.
2. 구역 대응: 편집된 구역이 다리 구역의 첫 요소(앞 요소가 모두 지워졌으면 첫 남은 요소)로 시작하면 그 구역을 잇는다. 아니면 편집기에서 넣은 나눔이다. 아무도 잇지 않은 다리 쪽 흐름은 나눔이 지워진 것이다. `text:section` 경계의 이어지는 구역은 앞 흐름에 합친다.
3. 바뀐 것: 편집된 구역의 `w:sectPr`가 온 다리 구역(그 구역을 끝내는 문단, 새 나눔은 그것을 넣은 구역)과 비교한다. 나눔이 지워져 합친 구역은 뒤 구역의 `w:sectPr`를 지니므로, 그것과 같으면 앞 흐름의 바탕쪽을 그대로 따른다. 바뀐 값만 쓴다: 용지 크기·방향·여백(위 계산을 거꾸로: 머리글 간격은 두고 `w:header`를 여백으로, 나머지를 머리글 높이로), 쪽 번호 모양(`style:num-format`), 머리글·꼬리글 영역, 첫쪽(`w:titlePg`)과 짝수 쪽(`w:evenAndOddHeaders`) 켜고 끄기. 단은 쓰지 않는다. 길이는 cm 소수 셋째 자리, 0.1mm로 딱 떨어지면 그 값(21cm는 `21.000cm`).
4. 바탕쪽 나누기: 같은 바탕쪽을 쓰는 흐름이 같은 상태를 원하면 바탕쪽을 그대로 고친다. 다르면 바뀌지 않은 흐름(없으면 첫 흐름, 시작 문단을 바꿀 수 없는 흐름이 있으면 그 흐름)이 원래 바탕쪽을 갖고, 나머지는 같은 상태끼리 사본(`<이름>_io<n>`, 원래 바탕쪽 바로 뒤)을 받는다. 새 나눔은 언제나 그 자리 바탕쪽의 사본. 쪽 모양은 그것을 쓰는 모든 바탕쪽이 같은 변경을 원할 때만 그대로 고치고(바뀌지 않은 채 쓰는 바탕쪽이 없으면 한 변경이 원본을 갖는다), 아니면 사본(자동 스타일 끝)을 만든다.
5. 흐름 시작 문단: 사본을 가리키게 하거나(바탕쪽 이름), 지운 나눔을 따르게 하거나(`style:master-page-name` 빼기), 쪽 시작 번호(`style:page-number`)를 쓸 때:
   - 그 자동 스타일을 그 문단 하나만 쓰고 이미 바탕쪽을 바꾸는 스타일이며 문단이 그대로면 스타일을 제자리에서 고친다(한컴의 `…_MS<n>_…` 스타일이 그렇다). 본문은 바이트 그대로다.
   - 아니면(새 나눔, 여러 문단이 함께 쓰는 스타일, 고친 문단) 감싼 처리기가 그 문단을 쓸 때 스타일을 복사한 새 자동 스타일로 바꾼다. 바뀌지 않은 문단은 원문을 쓰고 시작 태그의 스타일 이름만 바꾼다.
   - 시작이 문단이 아닌 곳(표 앞의 새 나눔), 목록 안 문단, 다른 처리기가 맡은 문단의 새 시작은 쓰지 못하고 경고를 남긴다.
6. 머리글·꼬리글 영역: 편집된 파트가 다리 파트와 바이트가 같으면 그대로다. 다르면 다리 파트를 엔진으로 다시 읽은 문단(편집된 docx의 styles.xml로)과 문단마다 비교해, 같은 문단은 원래 ODF 바이트, 다른 문단은 원래 문단을 바탕으로 `paragraphToOdf(..., { part: 'styles.xml' })`, 새 문단은 앞 원래 문단을 본보기로 쓴다. 표 등 다른 자식은 제자리에 바이트 그대로. 쪽 번호 필드는 원래 요소(같은 순번)를 다시 쓰고, 새로 넣은 것은 `text:page-number`. 다른 구역의 파트를 물려받은 구역(앞과 같게)은 그 영역 내용을 그대로 복사한다.

### 다리 지도 `ext.page` (`PageExt`, JSON)

```ts
{
  version: 1,
  defaultMaster: string | null,     // 첫 흐름이 바탕쪽을 밝히지 않을 때 쓰는 바탕쪽
  evenAndOdd: boolean,              // 다리 docx의 w:evenAndOddHeaders
  runs: Array<{                     // 쪽 흐름(바탕쪽 하나가 이어지는 쪽들), 문서 순서
    master: string | null, layout: string | null,
    startParagraph: number | null,  // 바탕쪽을 바꾸는 문단 기록 id (암묵적 첫 흐름은 null)
    startBlock: number | null, startStyle: string | null,
    startFamily: 'paragraph' | 'table' | null,
    hidden: boolean,                // 자기 docx 구역이 없음(문단 없는 흐름)
    slots: Partial<Record<'header' | 'header-left' | 'header-first' | 'footer' | 'footer-left' | 'footer-first', string>>, // rId
  }>,
  sections: Array<{                 // 다리 docx 구역, 문서 순서
    run: number, region: number | null /* text:section 블록 */, continuous: boolean,
    first: number | null, last: number | null,  // 다리 요소 id
    carrier: number | null,         // w:sectPr를 지닌 문단 요소 (마지막 구역은 null)
    sectPr: string,                 // 써 넣은 w:sectPr 원문
  }>,
  parts: Record<rId, {
    rId, path, kind: 'header' | 'footer', master: string,
    region: 영역 이름 | null, fill: 'content' | 'fallback' | 'empty',
    paragraphs: number[],           // 영역 문단의 기록 id, 순서대로
    xml: string,                    // 써 넣은 파트 원문
  }>,
}
```

### 알려진 한계

- 머리글 안의 표·글상자는 다리 docx에 넣지 않는다(편집기에는 보이지 않고, 저장 때 그대로 남는다).
- 편집기에서 새로 친 머리글 글자는 서식 없는 run으로 오므로 원래 span 스타일의 글자 속성을 지운 복사본을 쓴다(문단 스타일의 글꼴을 따른다).
- 이어지는 구역 나눔(`continuous`)을 새로 넣으면 ODF에는 쪽 나눔으로 쓴다(경고). `text:section` 경계를 지우거나 옮기는 것은 쓰지 않는다.
- 바탕쪽의 `style:next-style-name`이 자기 자신이면 사본도 자기 자신을 가리킨다. 다른 바탕쪽을 가리키는 사슬(첫 쪽 → 보통 쪽)은 따로 복제하지 않는다.
- 한컴은 HWP→ODT에서 쪽 번호 위치(`pgnp`)를 잃으므로, 한컴 ODT의 머리글에는 쪽 번호 필드가 거의 없다(말뭉치 66개 중 1개).

### 테스트

- `tests/page-forward.test.ts`(구역·위치·머리글 칸·단·쪽 번호, 위치 왕복, 편집 없는 저장), `tests/page-edit.test.ts`(여백·용지·방향, 공유 바탕쪽 복제, 같은 변경은 제자리, 쪽 번호, 단은 쓰지 않음), `tests/page-headers.test.ts`(머리글 글자, 공유 바탕쪽의 한 흐름만 고친 머리글, 첫쪽·짝수 쪽 켜고 끄기, 쪽 번호 필드), `tests/page-breaks.test.ts`(나눔 추가·삭제, 시작 문단 삭제, 암묵적 첫 흐름의 쪽 번호).
- 도우미: `tests/helpers/page-bridge.ts`(T6 순서로 열기·되돌려 쓰기, 편집기처럼 구역 `w:sectPr` 고치기), `tests/helpers/page-fixtures.ts`(쪽 흐름 셋: `Standard`, `MP2`, `Standard`).
- `ODT_CORPUS`가 있으면 `tests/page-corpus.test.ts`가 모든 파일을 변환하고, 편집 없는 저장이 같은지, 마지막 구역 여백 편집이 그 쪽 모양만 바꾸는지, 마지막 구역 머리글 편집이 그 바탕쪽(과 새 자동 스타일)만 바꾸는지 본다. 말뭉치 66개: 쪽 흐름 82, docx 구역 82, 여러 흐름이 함께 쓰는 바탕쪽 0, 머리글·꼬리글 파트 22.
