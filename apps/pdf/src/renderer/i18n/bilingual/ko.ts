import type { zh } from './zh'

export const ko = {
  blToggle: '번역 나란히',
  blToggleTip:
    '페이지 오른쪽에 보관된 번역을 나란히 보입니다. 켜기만 해서는 AI에 아무것도 보내지 않습니다.',
  blLanguage: '번역 언어',
  blStoredLangs: '보관된 번역',
  blOtherLangs: '다른 언어',
  blLoading: '문서 구조를 읽는 중… ({done}/{total}쪽)',
  blLoadingStart: '문서 구조를 읽는 중…',
  blFailed: '문서 구조를 읽지 못해 번역 칸을 보일 수 없습니다.',
  blUnavailable:
    '저장된 파일이 없거나 이 창에서 문서 구조를 읽을 수 없어 번역 칸을 보일 수 없습니다.',
  blUnsavedPages: '저장하면 번역 칸이 맞춰집니다',
  blContinued: '앞 페이지에서 이어짐',
  blCollapseAsk: '번역 칸을 접을까요?',
  blCollapse: '접기',
  blKeep: '그대로 두기',
  blExpand: '번역 칸 펼치기',
  blFontSmaller: '번역 글자 작게',
  blFontLarger: '번역 글자 크게',
  blResize: '번역 칸 폭 조절',
  blClose: '번역 나란히 끄기',
  blPageHeader: '{page}쪽',
  blPageCount: '번역 {translated}/{units}',
  blNoText: '이 페이지에는 번역할 글이 없습니다.',
  blPendingTip: '아직 번역하지 않은 문단입니다(원문).',
  blFailedTip: '번역하지 못한 문단입니다(원문).',
  blEditedTip: '사람이 고친 번역입니다.',
} satisfies Record<keyof typeof zh, string>
