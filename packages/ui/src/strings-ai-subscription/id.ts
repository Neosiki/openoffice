import type { zh } from './zh'

export const id = {
  cardChecking: 'Memeriksa…',
  cardNotInstalled: 'Belum terpasang',
  cardSignedOut: 'Belum masuk',
  cardReady: 'Terhubung',
  cardReadyPlan: 'Terhubung · {plan}',
  cardMetered: 'Sudah masuk, tetapi bukan dengan langganan',
  cardMeteredAccepted: 'Sedang dipakai · ditagih sesuai pemakaian',
  cardError: 'Koneksi tidak dapat diperiksa',
  actionInstall: 'Pasang',
  actionLogin: 'Masuk',
  actionRecheck: 'Periksa lagi',
  actionAcceptMetered: 'Tetap gunakan',
  actionInstallHelp: 'Panduan pemasangan resmi',
  actionOpenSettings: 'Buka pengaturan',
  actionDismiss: 'Tutup',
  installNote: 'Perintah pemasangan resmi dari {vendor} dijalankan di jendela terminal baru.',
  loginNote: 'Halaman masuk yang terbuka adalah milik {vendor}.',
  meteredWarning: 'Ini bukan langganan: Anda ditagih sesuai pemakaian.',
  meteredMeaning:
    'Login ini memakai kunci API atau akun bayar sesuai pemakaian, atau jenisnya tidak dapat dipastikan. Dengan "Tetap gunakan", AI berjalan melalui koneksi ini dan setiap permintaan ditagihkan ke akun tersebut.',
  connectTitle: 'Hubungkan langganan untuk memakai AI',
  connectBody:
    'AI berjalan dengan langganan Claude atau Codex yang sudah Anda miliki. Kunci API tidak diperlukan.',
  connectProviderTitle: 'Koneksi {provider} belum bisa dipakai saat ini',
  connectKeyBody:
    'Penyiapan {provider} belum selesai. Selesaikan di Pengaturan, atau pilih AI lain.',
  errNotConnected: 'Belum ada AI yang terhubung. Hubungkan dulu langganan Claude atau Codex.',
  errNotInstalled: 'Program {provider} tidak ditemukan di PC ini.',
  errSignedOut: 'Sesi masuk {provider} sudah berakhir. Masuk lagi untuk melanjutkan.',
  errRateLimit: 'Batas langganan {provider} sudah habis.',
  errRateLimitReset: 'Batas langganan {provider} sudah habis. Batas diatur ulang pada {time}.',
  errUnsafeTools:
    'Program {provider} dimulai dengan alat bawaannya masih aktif, sehingga proses dihentikan demi keamanan.',
  errMeteredNotAccepted:
    'Koneksi {provider} ditagih sesuai pemakaian dan belum Anda izinkan. Pilih "Tetap gunakan" di pengaturan koneksi untuk memakainya.',
  errNeedsUpdate: 'Program {provider} terlalu lama untuk fitur ini. Perbarui lalu coba lagi.',
  errHeadlessLimit: 'Batas per jam untuk permintaan otomatis sudah tercapai.',
  errHeadlessLimitReset:
    'Batas per jam untuk permintaan otomatis sudah tercapai. Permintaan bisa dilakukan lagi pada {time}.',
  continueWith: 'Lanjutkan dengan {provider}',
  continueMeteredNote:
    'Koneksi {provider} bukan langganan: melanjutkan akan ditagih sesuai pemakaian.',
  usageLine: '{percent}% terpakai · diatur ulang pada {time}',
  usageWindowFiveHour: 'Batas 5 jam',
  usageWindowSevenDay: 'Batas 7 hari',
  noticeTitle: 'Sebelum memakai AI dengan langganan Anda',
  noticeSend:
    'Isi dokumen dan percakapan Anda dikirim ke Anthropic atau OpenAI dengan akun Anda sendiri.',
  noticeTraining:
    'Apakah isi itu dipakai untuk melatih AI ditentukan oleh pengaturan akun Anda sendiri di perusahaan tersebut.',
  noticeCodexHistory: 'Codex dapat menyimpan isi percakapan di PC ini.',
  noticeAck: 'Mengerti',
  codexNotice:
    'Memakai langganan Codex di dalam aplikasi bukan cara yang direkomendasikan secara resmi oleh OpenAI.',
  truncatedNotice: 'Masukan terlalu panjang, sehingga sebagian dipotong sebelum dikirim.',
  pickerAuto: 'Otomatis',
  pickerAutoUsing: 'Otomatis · {provider}',
  pickerDefaultModel: 'Model bawaan',
  pickerSubscription: 'Langganan',
  pickerPaid: 'Berbayar',
  pickerPaidTitle: 'Ditagih sesuai pemakaian, tidak termasuk dalam langganan',
  pickerNotConnected: 'Hubungkan AI',
} satisfies Record<keyof typeof zh, string>
