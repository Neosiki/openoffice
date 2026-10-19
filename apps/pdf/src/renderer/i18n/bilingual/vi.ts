import type { zh } from './zh'

export const vi = {
  blToggle: 'Bản dịch song song',
  blToggleTip:
    'Hiển thị bản dịch đã lưu bên cạnh mỗi trang. Chỉ bật chế độ này sẽ không gửi gì cho AI.',
  blLanguage: 'Ngôn ngữ bản dịch',
  blStoredLangs: 'Bản dịch đã lưu',
  blOtherLangs: 'Ngôn ngữ khác',
  blLoading: 'Đang đọc cấu trúc tài liệu… ({done}/{total} trang)',
  blLoadingStart: 'Đang đọc cấu trúc tài liệu…',
  blFailed: 'Không đọc được cấu trúc tài liệu nên không thể hiển thị cột bản dịch.',
  blUnavailable:
    'Không thể hiển thị cột bản dịch: tệp chưa được lưu, hoặc cửa sổ này không đọc được cấu trúc tài liệu.',
  blUnsavedPages: 'Lưu để cột bản dịch khớp với các trang',
  blContinued: 'Tiếp nối từ trang trước',
  blCollapseAsk: 'Thu gọn cột bản dịch?',
  blCollapse: 'Thu gọn',
  blKeep: 'Giữ nguyên',
  blExpand: 'Mở rộng cột bản dịch',
  blFontSmaller: 'Chữ bản dịch nhỏ hơn',
  blFontLarger: 'Chữ bản dịch lớn hơn',
  blResize: 'Đổi độ rộng cột bản dịch',
  blClose: 'Tắt bản dịch song song',
  blPageHeader: 'Trang {page}',
  blPageCount: 'Đã dịch {translated}/{units}',
  blNoText: 'Trang này không có chữ để dịch.',
  blPendingTip: 'Chưa được dịch (văn bản gốc).',
  blFailedTip: 'Không dịch được đoạn này (văn bản gốc).',
  blEditedTip: 'Bản dịch do người chỉnh sửa.',
} satisfies Record<keyof typeof zh, string>
