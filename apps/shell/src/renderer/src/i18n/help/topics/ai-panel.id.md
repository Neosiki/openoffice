# Panel asisten AI

Setiap editor bisa memunculkan panel AI: pilih sesuatu, beri instruksi, dan lihat hasilnya mengalir.

## Membuka dan menggunakannya

- Panel ini memerlukan AI yang terhubung. Jika belum ada, panel menampilkan kartu koneksi, bukan pesan galat; lihat [Koneksi langganan](help://subscription).
- Titik masuknya: **tombol AI** di pita setiap editor, **Tanya AI** di menu konteks, atau Tanya AI pada bilah anotasi.
- Jelaskan tugas dengan bahasa sehari-hari (tulis ulang ini / jadikan kolom ini persentase / tata ulang halaman ini...) lalu tekan Enter.
- Balasan dirender **secara bertahap**; ketika AI membutuhkan alat (membaca dokumen, mengeditnya), AI menjalankannya dan melanjutkan sampai selesai.
- **Berhenti**: hentikan putaran yang sedang berjalan kapan saja.
- **Antrean**: saat balasan sedang mengalir, Enter menaruh pesan Anda ke antrean alih-alih membuangnya — strip di atas kotak masukan menghitungnya; buka untuk menyunting, menghapus, mengurutkan ulang, menjeda, atau mengosongkan. Pesan berikutnya terkirim sendiri saat giliran selesai; Esc tetap menghentikan giliran.

## AI mana yang menjawab

- Daftar model di bagian bawah panel menunjukkan AI yang sedang dipakai dan memungkinkan Anda memilih yang lain: langganan Anda lebih dulu, lalu penyedia berbasis kunci yang sudah Anda siapkan.
- Setelah Anda memakai 80% atau lebih dari batas langganan, baris seperti "85% terpakai · diatur ulang pada 15.00" muncul di panel.
- Jika sebuah permintaan dihentikan — batasnya habis, atau sesi masuk berakhir — panel menyebutkan alasannya dan tidak beralih sendiri ke AI lain. Bila langganan Anda yang lain terhubung, tombol **Lanjutkan dengan …** menawarkannya.

## Apa yang dapat dilakukan

- **Docs**: menulis ulang/memperluas/menerjemahkan/merangkum, menyisipkan tabel dan gambar, menyesuaikan format; setiap putaran menyimpan snapshot lebih dulu.
- **Sheets**: rumus, pengisian data, transformasi massal, format.
- **Slides**: pembuatan seluruh dek, penyesuaian tata letak, penulisan ulang naskah.
- **PDF**: tanya jawab dan ringkasan berdasarkan teks atau halaman yang dipilih.
- **Markdown / HTML**: menulis ulang, mengembangkan, menerjemahkan.
- **Beranda ▸ Ask AI** menjawab dari berkas berbintang Anda dan mengutipnya — panel basis pengetahuan punya bagiannya sendiri di bab Beranda, dan panel AI Docs membawa keterampilan yang sama.

## Pengembalian dan keamanan

- Panel Docs menyimpan **daftar versi**: satu snapshot per putaran, Anda bisa mundur ke mana pun, dan rollback itu sendiri bisa dibatalkan dengan Ctrl+Z. Snapshot tetap ada setelah dokumen ditutup lalu dibuka kembali.
- suntingan AI melewati alur penyuntingan yang sama dengan suntingan manual (bisa di-undo, dan tunduk pada simpan) — tidak ada yang melewati konfirmasi simpan Anda.

## Menyembunyikan seleksi dari AI

- Di Slides, HTML, dan Markdown sebuah seleksi bisa dijauhkan dari mata model: klik kanan ▸ **Sembunyikan seleksi dari AI**, beri nama penampung, dan model membaca `{{nama}}` sebagai gantinya. (Markdown mengaktifkan item ini dengan sakelar mata-coreng di pitaunya; milik HTML ada di panel sumber.)
- Berkas menyimpan teks asli — menyimpan, mengekspor, dan mencetak tak tersentuh, dan tanda itu bertahan saat dibuka ulang. Item yang sama membatalkan penyembunyian (Markdown punya **Tampilkan seleksi ke AI lagi** tersendiri).
- HTML menyembunyikan isi elemen, nilai atribut, dan literal string di skrip; halaman yang dirender tak pernah berubah.
- Slides juga menyembunyikan gambar, video, dan audio utuh, dan slide berisi konten tersembunyi tak pernah dikirim sebagai tangkapan layar: pemeriksaan tata letak otomatis melewati halaman itu dan memberi tahu.
- Ini hanya untuk AI di dalam aplikasi — CLI, alat MCP, dan ekspor headless membaca berkas langsung dan tetap melihat teksnya.

## Privasi

- Instruksi dan isi dokumen yang relevan dikirim ke **AI yang Anda pakai**: ke Anthropic atau OpenAI dengan akun Anda sendiri bila Anda memakai langganan, atau ke penyedia yang kuncinya Anda masukkan. Jika tidak ada AI yang terhubung, tidak ada yang dikirim.
- Apakah isi yang dikirim lewat langganan dipakai untuk melatih AI ditentukan oleh pengaturan akun Anda sendiri di perusahaan tersebut.
- File lokal tidak diunggah ke mana pun; kunci API tersimpan di berkas pengaturan aplikasi pada mesin ini dan hanya dikirim di header permintaan.
