# vendor/rhwp-core — 패치한 rhwp 엔진

한글(HWP·HWPX) 편집기와 한글 파일 읽기(`packages/file-parse`)가 쓰는 rhwp 엔진(`@rhwp/core`)이다. npm에 배포된 0.8.7을 그대로 쓰지 않고, 같은 태그의 소스에 `patches/`의 수정을 얹어 이 저장소에서 빌드한 것을 둔다(결정 0045).

- 원본: https://github.com/edwardkim/rhwp 태그 `v0.8.7`(커밋 `1a76570e833917d15817415a53c09ad61ab3203f`), MIT. 원본 라이선스는 `LICENSE`, WASM에 링크된 크레이트의 라이선스 목록은 `THIRD_PARTY_LICENSES.md`다.
- 패키지 이름은 `@rhwp/core` 그대로다. `apps/hwp`와 `packages/file-parse`가 `file:../../vendor/rhwp-core`로 이 폴더를 가리킨다. 버전 `0.8.7-ieum.N`의 `N`은 패치 묶음이 바뀔 때마다 올린다.
- `rhwp.js`, `rhwp.d.ts`, `rhwp_bg.wasm.d.ts`는 npm 0.8.7과 바이트까지 같다(패치가 내보내는 함수를 바꾸지 않는다). 다른 것은 `rhwp_bg.wasm`뿐이다.

## 패치

| 파일 | 고치는 것 | 상위 |
| --- | --- | --- |
| `0001-host-inline-table-clears-paper-square-table.patch` | 쪽·종이 기준 어울림 표와 같은 문단에 든 글자처럼 취급 표가 그 표 옆에 들어가지 못할 때, 한글처럼 표 아래 줄에 놓고 뒤 문단도 그 아래에서 잇는다. 고치기 전에는 뒤 문단이 표 높이만큼 위로 올라와 표·제목·본문이 겹쳤다. | 상위 `devel`에도 같은 결함이 있다. 같은 수정을 상위에 PR로 냈다. |
| `0002-paragraph-picture-after-stored-page-reset.patch` | 문단 안에서 저장 줄 위치가 0으로 되감기는 줄(한글이 그 줄부터 다음 쪽에 둔 것) 뒤에 놓인 각주 표식·문단 기준 그림이 있어도 그 자리에서 문단을 나눈다. 고치기 전에는 문단을 통째로 앞 쪽에 두고 그림을 그 쪽 본문 위에 겹쳐 그렸다. | 상위 `devel`의 `50d06bb8a`, `429dee416`(#7704)에서 해당 판정만 옮겼다. |
| `0003-footnote-area-below-body-flow.patch` | 보이는 본문 줄이나 표가 각주 영역 위끝보다 아래까지 그려진 쪽에서 각주 영역만 그만큼 내린다. 꼬리말 자리 아래끝과 그 자리의 꼬리말·바탕쪽·용지 기준 개체를 넘지 않는다. 고치기 전에는 마지막 본문 줄이 각주 구분선·첫 각주와 겹쳤다. 쪽 나누기는 바꾸지 않는다. | 상위 `devel`에도 같은 겹침이 있다. 아직 내지 않았다. |

패치는 조판(쪽 나누기와 개체 위치)과 그리기만 바꾼다. 저장(HWP·HWPX 내보내기) 결과는 패치 전과 같다.

## 다시 빌드하기

`node tools/build-rhwp-core.mjs`가 태그를 받아 커밋을 확인하고, 패치를 차례로 적용하고, `wasm-pack build --target web --release`로 빌드한 뒤 이 폴더의 파일과 `package.json`의 `rhwp.wasmSha256`을 바꾼다. 필요한 것:

- git, Rust(태그의 `rust-toolchain.toml`이 정한 1.93.1과 `wasm32-unknown-unknown`, rustup이 자동으로 받는다), wasm-pack 0.15.0
- 빌드한 PC의 사용자 폴더 경로가 WASM에 남지 않도록 스크립트가 `--remap-path-prefix`를 건다.

앱을 빌드할 때는 Rust가 필요 없다. 이 폴더의 빌드 결과를 그대로 쓴다. rhwp를 새 버전으로 올릴 때는 그 버전에 상위가 같은 수정을 담았는지 먼저 보고, 담았으면 해당 패치를 지운다. 패치가 모두 사라지면 npm 패키지로 되돌린다.
