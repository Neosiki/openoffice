## 개체 층 (`src/objects`)

그림, 이음오피스가 고칠 수 없는 개체(수식, 도형, 글상자 속 글, 차례, 차트, 변경 기록), 각주·미주, 기존 메모를 맡는다. 진입점은 `src/objects/index.ts`.

- `registerObjectConverters(registry)`: 글자 층(그리고 표 층) 다음에 등록한다. 인라인 처리기(`draw:frame`과 도형·묶음 등 `DRAW_OBJECT_NAMES`, `text:note`, `office:annotation`, `office:annotation-end`, 변경 기록 표시), run 쓰기(그림·각주 번호), 끼우기(메모 시작·끝, 엔진이 읽지 못한 그림), 블록 처리기(`objects`: 차례·색인, 흐름에 바로 놓인 글상자·도형, 변경 기록 범위가 든 문단), 새 요소 쓰기(그림만 든 문단)를 한 번에 등록한다. 나중에 등록한 것이 먼저이므로 남의 몫은 `null`로 사양한다: 표를 담은 글상자(`draw:text-box > table:table`)는 표 층에 남긴다.

### 다리 docx에서의 이름

- 그림은 `wp:docPr` 이름으로 정체를 지닌다. 편집기는 크기 바꾸기·그림 바꾸기에서 이 이름을 그대로 둔다.
  - `odt-pic:<id>`: 고칠 수 있는 그림(`draw:frame` 안에 화면에 보일 수 있는 `draw:image` 하나).
  - `odt-keep:<id>:<kind>`: 고칠 수 없는 개체 하나를 대신하는 잠긴 자리 표시 그림. `<kind>`는 `equation`, `shape`, `textbox`, `toc`, `chart`, `revision`, `object` 중 하나(`OBJECT_KINDS`). 편집기는 이 종류로 "수식(한컴에서 보임)" 같은 이름표를 그린다(`parseKeepName`).
- 자리 표시 그림의 내용: 파일에 대신 쓸 그림이 있으면 그것(수식·차트의 `ObjectReplacements/…` 같은 같은 틀 안의 `draw:image`, 묶음·도형은 거의 전체를 덮는 안쪽 그림)을 쓰고, 없으면 언어와 무관한 옅은 회색 그림(`NEUTRAL_PLACEHOLDER_PNG`)을 쓴다. 대신 쓸 그림은 엔진이 변환 없이 보이는 형식(PNG, JPEG, GIF, BMP, SVG)만 쓴다. 크기는 개체의 크기(`svg:width`/`svg:height`, 없으면 글상자의 최소 크기나 안쪽 요소들을 합친 상자)다.
- `text:anchor-type="as-char"`는 `wp:inline`, 그 밖은 그래픽 스타일의 위치·감싸기를 옮긴 `wp:anchor`다.
- 각주·미주는 `word/footnotes.xml`·`word/endnotes.xml`로 간다. 본문 문단은 글자 층(`paragraphToOoxml`, owner `objects`)이 만들고, 본문 안의 개체는 바꾸지 않고 둔다. 번호 run의 글자는 엔진이 본문 순서로 매기는 번호와 같다.
- 메모는 진짜 docx 메모(`word/comments.xml`, 글자만)다. 메모가 달린 글자는 보통 글자로 고칠 수 있다. 끝이 없는 메모는 참조만 둔다.

### 다리 지도 `ext.objects` (`ObjectsExt`, JSON)

```ts
{
  version: 1,
  placeholders: [{ id, kind, name /* odt-keep:<id>:<kind> */, part, start, end,
    paragraph /* 인라인 개체가 든 문단 기록, 블록이면 null */, block, element /* 블록 자리 표시 */,
    widthEmu, heightEmu, preview, entries /* 개체가 가리키는 패키지 항목 */, finalText /* 변경 기록: 모든 변경을 반영한 글자 */ }],
  pictures: [{ id, name /* odt-pic:<id> */, part, start, end, openEnd, imageStart, imageOpenEnd,
    href, entry, rId, widthEmu, heightEmu, anchored, xEmu, yEmu, paragraph, entries }],
  comments: [{ id /* docx w:id */, name, start, end, endStart, endEnd, paragraph, offset,
    endParagraph, endOffset, ranged, text }],
  notes: [{ id /* docx w:id */, kind /* footnote | endnote */, start, end, bodyStart, bodyEnd,
    citation, bodyFirst, paragraph, paragraphs, text /* 엔진이 읽는 NoteInfo.text */, editable }],
}
```

편집기와 명령줄은 `placeholders`(순서대로, 종류 포함)를 읽는다.

### 저장

호출 순서(T6):

```ts
prepareObjectWriteBack(rctx) // rebuildOdtBody 전
rebuildOdtBody(rctx)
updateOdtStyles(rctx)
const patches = rctx.finish()
const contentXml = applyTextPatches(doc.contentXml, patches['content.xml'])
const stylesXml = applyTextPatches(doc.stylesXml ?? '', patches['styles.xml'])
const changes = objectPackageChanges(rctx, { contentXml, stylesXml }) // 패치 적용 후
// 다시 묶기: changes.remove 항목을 빼고, changes.add 항목({ path, data, mediaType })을 더하고,
// META-INF/manifest.xml = patchManifestXml(원래 manifest, changes)
```

- 자리 표시: 남아 있으면 원래 바이트 그대로(크기·자르기 변경은 무시), 사라졌으면 개체를 지운다. 블록 자리 표시는 `identify`로 짝을 찾고 원래 범위를 그대로 쓴다.
- 그림: 원래 틀을 그대로 쓰고, 크기가 바뀌면 `svg:width`/`svg:height`(떠 있는 그림은 옮긴 `svg:x`/`svg:y`)만 고친다. 그림을 바꾸면(`a:blip`의 관계가 달라지고 바이트가 다르면) 틀은 두고 `draw:image`의 `xlink:href`만 새 항목으로 바꾼다. 새 그림은 새 그래픽 자동 스타일(`fr_io<n>`)을 쓴 새 `draw:frame`이다. 새 항목 이름은 `Pictures/io_<n>.<확장자>`이고 기존·새 항목과 겹치지 않으며 같은 바이트는 한 항목을 함께 쓴다.
- 그림만 든 문단은 편집기에서 그림 블록이 되어 숨은 정체 책갈피로 짝을 찾지 못한다. 바뀐 그림 블록은 새 요소 쓰기가 그림 이름으로 원래 문단을 찾아, 그 문단에 그 그림만 있었으면 문단의 나머지를 바이트 그대로 두고 그림만 다시 쓰고, 아니면 원래 문단을 origin으로 글자 층에 넘긴다.
- 패키지 항목: 그림·개체가 가리키던 항목(`entries`) 가운데 최종 `content.xml`·`styles.xml`의 어떤 `*:href`도 가리키지 않는 것만 지운다(`Object 1/` 같은 폴더는 그 안의 항목까지). 새 항목은 최종 XML이 가리키는 것만 더한다.
- 각주·미주: 번호 run이 `text:note`를 쓴다. 글자가 그대로면 원래 바이트, 바뀌었으면 본문만 문단 단위로 다시 쓴다(바뀌지 않은 문단은 원래 바이트, 바뀐 문단은 원래 문단을 origin으로 `paragraphToOdf`, 글자마다 그 글자가 이어받은 원래 글자의 모양). 편집기에서 각주만 고치면 문단 XML은 그대로이므로 `prepareObjectWriteBack`이 그 문단의 다리 요소 XML을 잠시 바꿔 다시 쓰게 하고, `objectPackageChanges`가 되돌린다. 새 번호 run은 같은 종류의 기존 각주 모양(문단 스타일·글자 모양·인용 형식 `1)`·본문과 인용의 순서)을 따른 새 `text:note`, 지운 번호 run은 각주를 지운다.
- 메모: 원래 `office:annotation`·`office:annotation-end` 바이트를 옮긴 자리에 다시 쓴다. 한 문단 안의 범위는 편집기가 메모로 표시한 run을 따라가고, 문단을 넘는 범위와 끝 없는 메모는 원래 위치를 `env.mapOffset`으로 옮긴다. 한 문단 안 범위의 글자를 모두 지웠거나 편집기가 메모를 지웠으면 메모를 지운다. 새 메모·답글·메모 내용 변경은 저장하지 않고 경고한다.
- 엔진이 읽지 못한 그림(캔버스가 없는 곳의 WMF/EMF 등)은 고친 문단의 run에서 빠진다. 편집된 XML에 그 그림 이름이 남아 있고 어떤 run도 그것을 지니지 않으면 원래 위치에 원래 바이트로 다시 쓴다.

### 알려진 한계

- 머리글·꼬리글(`styles.xml`)의 그림과 각주·메모 본문 안의 개체는 OOXML로 옮기지 않고(숨은 책갈피, 원문 그대로) 둔다. 머리글 그림은 머리글 파트의 관계가 필요하다.
- 변경 기록 범위는 그 범위만이 아니라 범위가 든 최상위 문단 전체를 잠근다(`revision`). 목록·표 칸 안의 변경 기록 표시는 숨은 표시로 남고 글자는 고칠 수 있다.
- 표 칸 문단의 각주를 편집기에서 고치면 칸 문단 XML이 그대로이므로 표 층이 `paragraphNeedsRewrite(rctx, 문단 id)`를 보고 그 칸 문단을 다시 써야 한다. 다시 쓰지 않으면 `objectPackageChanges`가 경고한다.
- 문단을 넘는 메모에서 시작이 든 문단을 지우고 끝이 든 문단을 손대지 않으면 끝 표시가 홀로 남는다.
- 새 각주 앞뒤의 기존 각주 인용 글자(`2)`)는 다시 매기지 않는다(한컴·LibreOffice가 열 때 다시 매긴다).
- 그림 문단의 정렬을 그림 도구로 바꾸면 그 문단은 글자 층으로 다시 쓰인다.
- 인라인 개체 바로 뒤의 공백은 글자 층의 공백 규칙에서 앞 공백과 합쳐진다. 그런 문단을 고치면 그 공백 하나가 개체 앞으로 간다.
