import type { zh } from './zh'

export const id = {
  blToggle: 'Terjemahan berdampingan',
  blToggleTip:
    'Menampilkan terjemahan tersimpan di samping setiap halaman. Menyalakannya tidak mengirim apa pun ke AI.',
  blLanguage: 'Bahasa terjemahan',
  blStoredLangs: 'Terjemahan tersimpan',
  blOtherLangs: 'Bahasa lain',
  blLoading: 'Membaca struktur dokumen… ({done}/{total} halaman)',
  blLoadingStart: 'Membaca struktur dokumen…',
  blFailed: 'Struktur dokumen tidak dapat dibaca, jadi kolom terjemahan tidak dapat ditampilkan.',
  blUnavailable:
    'Kolom terjemahan tidak tersedia: file belum disimpan, atau jendela ini tidak dapat membaca struktur dokumen.',
  blUnsavedPages: 'Simpan agar kolom terjemahan sejajar dengan halaman',
  blContinued: 'Lanjutan dari halaman sebelumnya',
  blCollapseAsk: 'Ciutkan kolom terjemahan?',
  blCollapse: 'Ciutkan',
  blKeep: 'Biarkan',
  blExpand: 'Bentangkan kolom terjemahan',
  blFontSmaller: 'Perkecil teks terjemahan',
  blFontLarger: 'Perbesar teks terjemahan',
  blResize: 'Ubah lebar kolom terjemahan',
  blClose: 'Matikan terjemahan berdampingan',
  blPageHeader: 'Halaman {page}',
  blPageCount: 'Diterjemahkan {translated}/{units}',
  blNoText: 'Halaman ini tidak memiliki teks untuk diterjemahkan.',
  blPendingTip: 'Belum diterjemahkan (teks asli).',
  blFailedTip: 'Paragraf ini tidak dapat diterjemahkan (teks asli).',
  blEditedTip: 'Terjemahan yang disunting oleh seseorang.',
} satisfies Record<keyof typeof zh, string>
