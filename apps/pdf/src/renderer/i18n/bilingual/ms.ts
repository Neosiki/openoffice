import type { zh } from './zh'

export const ms = {
  blToggle: 'Terjemahan sebelah-menyebelah',
  blToggleTip:
    'Memaparkan terjemahan tersimpan di sebelah setiap halaman. Menghidupkannya tidak menghantar apa-apa kepada AI.',
  blLanguage: 'Bahasa terjemahan',
  blStoredLangs: 'Terjemahan tersimpan',
  blOtherLangs: 'Bahasa lain',
  blLoading: 'Membaca struktur dokumen… ({done}/{total} halaman)',
  blLoadingStart: 'Membaca struktur dokumen…',
  blFailed: 'Struktur dokumen tidak dapat dibaca, jadi lajur terjemahan tidak dapat dipaparkan.',
  blUnavailable:
    'Lajur terjemahan tidak tersedia: fail belum disimpan, atau tetingkap ini tidak dapat membaca struktur dokumen.',
  blUnsavedPages: 'Simpan supaya lajur terjemahan sejajar dengan halaman',
  blContinued: 'Sambungan dari halaman sebelumnya',
  blCollapseAsk: 'Lipat lajur terjemahan?',
  blCollapse: 'Lipat',
  blKeep: 'Biarkan',
  blExpand: 'Kembangkan lajur terjemahan',
  blFontSmaller: 'Kecilkan teks terjemahan',
  blFontLarger: 'Besarkan teks terjemahan',
  blResize: 'Ubah lebar lajur terjemahan',
  blClose: 'Matikan terjemahan sebelah-menyebelah',
  blPageHeader: 'Halaman {page}',
  blPageCount: 'Diterjemah {translated}/{units}',
  blNoText: 'Halaman ini tiada teks untuk diterjemah.',
  blPendingTip: 'Belum diterjemah (teks asal).',
  blFailedTip: 'Perenggan ini tidak dapat diterjemah (teks asal).',
  blEditedTip: 'Terjemahan yang disunting oleh seseorang.',
} satisfies Record<keyof typeof zh, string>
