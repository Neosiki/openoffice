import type { zh } from './zh'

export const id = {
  aiAssistant: 'Asisten AI',
  cardChecking: 'Memeriksa…',
  cardNotInstalled: 'Belum terpasang',
  cardSignedOut: 'Belum masuk',
  cardSigningIn: 'Sedang masuk…',
  cardReady: 'Terhubung',
  cardReadyPlan: 'Terhubung · {plan}',
  cardMetered: 'Sudah masuk, tetapi bukan dengan langganan',
  cardMeteredAccepted: 'Sedang dipakai · ditagih sesuai pemakaian',
  cardError: 'Koneksi tidak dapat diperiksa',
  cardErrNeedsUpdate: 'Program {provider} di PC ini terlalu lama. Perbarui, lalu periksa lagi.',
  cardErrNeedsUpdateVersion:
    'Program {provider} di PC ini ({version}) terlalu lama; diperlukan versi {minimum} atau yang lebih baru. Jalankan {command} di terminal, lalu periksa lagi.',
  cardErrTimeout: 'Program {provider} tidak menjawab tepat waktu. Periksa lagi sebentar lagi.',
  cardErrFailed: 'Terjadi masalah saat memeriksa {provider}. Periksa lagi.',
  actionInstall: 'Pasang',
  actionLogin: 'Masuk',
  actionLoginWindow: 'Browser tidak terbuka, atau menampilkan kode?',
  actionRecheck: 'Periksa lagi',
  actionAcceptMetered: 'Tetap gunakan',
  actionInstallHelp: 'Panduan pemasangan resmi',
  actionOpenSettings: 'Buka pengaturan',
  actionDismiss: 'Tutup',
  actionSwitchAccount: 'Masuk dengan akun lain',
  actionLogout: 'Keluar',
  installNote: 'Perintah pemasangan resmi dari {vendor} dijalankan di jendela terminal baru.',
  loginNote: 'Halaman masuk yang terbuka adalah milik {vendor}.',
  signingInBrowserNote:
    'Masuk ke akun {vendor} Anda di browser yang terbuka, lalu izinkan akses. Koneksi akan tersambung sendiri setelah selesai.',
  signingInWindowNote:
    'Jika browser tidak terbuka, salin alamat yang tampil di jendela yang baru terbuka lalu buka di browser. Saat browser menampilkan kode, salin, tempelkan sekali ke jendela itu, lalu tekan Enter. Kode yang ditempel mungkin tidak terlihat di jendela.',
  meteredWarning: 'Ini bukan langganan: Anda ditagih sesuai pemakaian.',
  meteredMeaning:
    'Login ini memakai kunci API atau akun bayar sesuai pemakaian, atau jenisnya tidak dapat dipastikan. Dengan "Tetap gunakan", AI berjalan melalui koneksi ini dan setiap permintaan ditagihkan ke akun tersebut.',
  connectTitle: 'Hubungkan AI untuk memulai',
  connectBody:
    'AI berjalan dengan langganan Claude atau Codex yang sudah Anda miliki. Kunci API tidak diperlukan.',
  connectProviderTitle: 'Koneksi {provider} belum bisa dipakai saat ini',
  connectKeyBody:
    'Penyiapan {provider} belum selesai. Selesaikan di Pengaturan, atau pilih AI lain.',
  errNotConnected:
    'Belum ada AI yang terhubung. Hubungkan dulu langganan Claude atau Codex, atau AI gratis.',
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
  connectFreeHint:
    'Tidak punya langganan? Anda bisa menghubungkan AI gratis di Pengaturan dalam sekitar satu menit.',
  actionConnectFree: 'Hubungkan AI gratis',
  errFreeLimit:
    'Jatah gratis hari ini sudah habis. Coba lagi besok, atau pilih AI lain di Pengaturan.',
  errFreeLimitReset: 'Jatah gratis hari ini sudah habis. Anda bisa memakainya lagi pada {time}.',
  continueWith: 'Lanjutkan dengan {provider}',
  continueMeteredNote:
    'Koneksi {provider} bukan langganan: melanjutkan akan ditagih sesuai pemakaian.',
  usageLine: '{percent}% terpakai · diatur ulang pada {time}',
  usageWindowFiveHour: 'Batas 5 jam',
  usageWindowSevenDay: 'Batas 7 hari',
  noticeTitle: 'Sebelum memakai AI dengan langganan Anda',
  noticeSend:
    'Isi dokumen dan percakapan Anda dikirim ke Anthropic atau OpenAI dengan akun Anda sendiri. Skill yang dipakai dan file skill yang dibaca AI juga ikut dikirim.',
  noticeTraining:
    'Apakah isi itu dipakai untuk melatih AI ditentukan oleh pengaturan akun Anda sendiri di perusahaan tersebut.',
  noticeCodexHistory:
    'Aplikasi ini mematikan penyimpanan riwayat percakapan Codex, tetapi Codex masih dapat menyimpan log diagnostiknya sendiri di PC ini.',
  noticePdfWholeDocument:
    'Di editor PDF, pembacaan halaman dengan AI dan terjemahan dokumen dapat mengirim gambar halaman dan seluruh teks dokumen.',
  noticeAck: 'Mengerti',
  codexNotice:
    'Memakai langganan Codex di dalam aplikasi bukan cara yang direkomendasikan secara resmi oleh OpenAI.',
  truncatedNotice: 'Masukan terlalu panjang, sehingga sebagian dipotong sebelum dikirim.',
  pickerAuto: 'Otomatis',
  pickerAutoUsing: 'Otomatis · {provider}',
  pickerAutoUsingModel: 'Otomatis · {provider} · {model}',
  pickerDefaultModel: 'Model bawaan',
  pickerDefaultModelNamed: 'Model bawaan · {model}',
  pickerSubscription: 'Langganan',
  pickerPaid: 'Berbayar',
  pickerPaidTitle: 'Ditagih sesuai pemakaian, tidak termasuk dalam langganan',
  pickerNotConnected: 'Hubungkan AI',
} satisfies Record<keyof typeof zh, string>
