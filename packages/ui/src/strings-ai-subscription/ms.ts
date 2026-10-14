import type { zh } from './zh'

export const ms = {
  aiAssistant: 'Pembantu AI',
  cardChecking: 'Sedang menyemak…',
  cardNotInstalled: 'Belum dipasang',
  cardSignedOut: 'Belum log masuk',
  cardReady: 'Disambungkan',
  cardReadyPlan: 'Disambungkan · {plan}',
  cardMetered: 'Sudah log masuk, tetapi bukan dengan langganan',
  cardMeteredAccepted: 'Sedang digunakan · dicaj mengikut penggunaan',
  cardError: 'Sambungan tidak dapat disemak',
  cardErrNeedsUpdate:
    'Program {provider} pada PC ini terlalu lama. Kemas kini, kemudian semak semula.',
  cardErrTimeout:
    'Program {provider} tidak menjawab dalam masa yang ditetapkan. Semak semula sebentar lagi.',
  cardErrFailed: 'Masalah berlaku semasa menyemak {provider}. Semak semula.',
  actionInstall: 'Pasang',
  actionLogin: 'Log masuk',
  actionRecheck: 'Semak semula',
  actionAcceptMetered: 'Guna juga',
  actionInstallHelp: 'Panduan pemasangan rasmi',
  actionOpenSettings: 'Buka tetapan',
  actionDismiss: 'Tutup',
  actionSwitchAccount: 'Log masuk dengan akaun lain',
  actionLogout: 'Log keluar',
  installNote: 'Arahan pemasangan rasmi {vendor} dijalankan dalam tetingkap terminal baharu.',
  loginNote: 'Halaman log masuk yang dibuka ialah milik {vendor}.',
  meteredWarning: 'Ini bukan langganan: anda dicaj mengikut penggunaan.',
  meteredMeaning:
    'Log masuk ini menggunakan kunci API atau akaun bayar ikut guna, atau jenisnya tidak dapat disahkan. Dengan "Guna juga", AI berjalan melalui sambungan ini dan setiap permintaan dicaj kepada akaun tersebut.',
  connectTitle: 'Sambungkan AI untuk bermula',
  connectBody:
    'AI berjalan dengan langganan Claude atau Codex yang anda sudah ada. Kunci API tidak diperlukan.',
  connectProviderTitle: 'Sambungan {provider} tidak boleh digunakan sekarang',
  connectKeyBody:
    'Persediaan {provider} belum selesai. Lengkapkannya dalam Tetapan, atau pilih AI lain.',
  errNotConnected:
    'Tiada AI yang disambungkan. Sambungkan langganan Claude atau Codex, atau AI percuma, dahulu.',
  errNotInstalled: 'Program {provider} tidak ditemui pada PC ini.',
  errSignedOut: 'Log masuk {provider} telah tamat. Log masuk semula untuk meneruskan.',
  errRateLimit: 'Had langganan {provider} telah habis digunakan.',
  errRateLimitReset:
    'Had langganan {provider} telah habis digunakan. Had ditetapkan semula pada {time}.',
  errUnsafeTools:
    'Program {provider} bermula dengan alatnya sendiri masih aktif, jadi proses dihentikan demi keselamatan.',
  errMeteredNotAccepted:
    'Sambungan {provider} dicaj mengikut penggunaan dan anda belum membenarkannya. Pilih "Guna juga" dalam tetapan sambungan untuk menggunakannya.',
  errNeedsUpdate: 'Program {provider} terlalu lama untuk ciri ini. Kemas kini dan cuba lagi.',
  errHeadlessLimit: 'Had sejam bagi permintaan automatik telah dicapai.',
  errHeadlessLimitReset:
    'Had sejam bagi permintaan automatik telah dicapai. Permintaan boleh dibuat semula pada {time}.',
  connectFreeHint:
    'Tiada langganan? Anda boleh menyambungkan AI percuma dalam Tetapan dalam masa kira-kira seminit.',
  actionConnectFree: 'Sambungkan AI percuma',
  errFreeLimit:
    'Peruntukan percuma hari ini telah habis. Cuba lagi esok, atau pilih AI lain dalam Tetapan.',
  errFreeLimitReset:
    'Peruntukan percuma hari ini telah habis. Anda boleh menggunakannya semula pada {time}.',
  continueWith: 'Teruskan dengan {provider}',
  continueMeteredNote:
    'Sambungan {provider} bukan langganan: meneruskan akan dicaj mengikut penggunaan.',
  usageLine: '{percent}% digunakan · ditetapkan semula pada {time}',
  usageWindowFiveHour: 'Had 5 jam',
  usageWindowSevenDay: 'Had 7 hari',
  noticeTitle: 'Sebelum menggunakan AI dengan langganan anda',
  noticeSend:
    'Kandungan dokumen dan perbualan anda dihantar kepada Anthropic atau OpenAI di bawah akaun anda sendiri.',
  noticeTraining:
    'Sama ada kandungan itu digunakan untuk melatih AI ditentukan oleh tetapan akaun anda sendiri di syarikat tersebut.',
  noticeCodexHistory:
    'Aplikasi ini mematikan penyimpanan sejarah perbualan Codex, tetapi Codex mungkin masih menyimpan log diagnostiknya sendiri pada PC ini.',
  noticePdfWholeDocument:
    'Dalam editor PDF, bacaan halaman dengan AI dan terjemahan dokumen mungkin menghantar imej halaman dan seluruh teks dokumen.',
  noticeAck: 'Faham',
  codexNotice:
    'Menggunakan langganan Codex di dalam aplikasi bukan kaedah yang disyorkan secara rasmi oleh OpenAI.',
  truncatedNotice: 'Input terlalu panjang, jadi sebahagiannya dipotong sebelum dihantar.',
  pickerAuto: 'Automatik',
  pickerAutoUsing: 'Automatik · {provider}',
  pickerAutoUsingModel: 'Automatik · {provider} · {model}',
  pickerDefaultModel: 'Model lalai',
  pickerDefaultModelNamed: 'Model lalai · {model}',
  pickerSubscription: 'Langganan',
  pickerPaid: 'Berbayar',
  pickerPaidTitle: 'Dicaj mengikut penggunaan, tidak diliputi langganan',
  pickerNotConnected: 'Sambungkan AI',
} satisfies Record<keyof typeof zh, string>
