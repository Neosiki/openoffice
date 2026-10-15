# Mod ejen

Ejen menjadikan satu folder yang anda pilih sebagai projek dan menjalankan Claude Code atau Codex daripada PC ini dalam folder itu. AI membaca sendiri bahan dalam folder, mencipta fail baharu, menggunakan kemahiran dan skrip, serta menyunting dokumen yang dibuka dalam GenOffice. Gunakannya untuk kerja yang memerlukan banyak bahan.

## Sebelum bermula

- Langganan Claude atau langganan ChatGPT yang disambungkan di bawah **Tetapan ▸ AI**. Topik "Sambungan langganan" menerangkan caranya.
- Folder yang mengandungi bahan anda. Keseluruhan pemacu, keseluruhan folder rumah anda, dan folder data log masuk atau data aplikasi tidak boleh dipilih.

## Memulakan sesi

1. Di Laman Utama, tekan kad **Ejen**. Tetingkap ejen dibuka secara berasingan.
2. Tekan **Pilih folder…** untuk memilih folder projek. Folder yang anda gunakan baru-baru ini disenaraikan di bawah **Folder terkini**.
3. Di bawah **Program**, pilih Claude Code atau Codex. Program yang tidak bersambung tidak boleh dipilih.
4. Di bawah **Bila hendak bertanya kepada anda**, pilih cara ejen meminta kebenaran (lihat jadual di bawah).
5. Pada kali pertama, baca **Sebelum anda mula** dan tekan **Saya faham**.
6. Tekan **Mula**, tulis apa yang anda mahu dilakukan, dan tekan **Hantar**.

Satu tetingkap ialah satu sesi. Menutup tetingkap atau menekan **Henti** menamatkan sesi, dan program yang dimulakan oleh GenOffice untuk sesi itu turut ditamatkan. Sesi juga tamat selepas 30 minit tanpa apa-apa dihantar.

## Cara ejen bertanya

| Pilihan                                          | Terus dilakukan                                                              | Ditanya dahulu                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Tanya sebelum setiap arahan** (lalai)          | Membaca dan menulis fail dalam folder projek, menyunting dokumen yang dibuka | Menjalankan arahan atau skrip, membaca di luar folder projek        |
| **Tanya sebelum menulis dan menjalankan arahan** | Membaca fail dalam folder projek, menyunting dokumen yang dibuka             | Menulis fail, menjalankan arahan atau skrip, membaca di luar folder |
| **Percayai projek ini**                          | Hampir semua perkara                                                         | Membaca di luar folder projek                                       |

Apabila ejen bertanya, tetingkap menunjukkan apa yang hendak dilakukannya (arahan penuh, laluan fail). Tekan **Benarkan** atau **Tolak**.

Apa jua pilihan anda, ejen tidak akan:

- Menulis ganti fail dokumen yang dibuka dalam tab GenOffice. Dokumen yang dibuka disunting melalui aplikasi, jadi perubahan terus kelihatan dalam editor dan fungsi buat asal editor boleh membatalkannya.
- Menulis di luar folder projek.
- Menyentuh data log masuk Claude atau Codex, atau folder data GenOffice.

## Claude Code dan Codex

- **Codex** menjalankan arahan dalam ruang terasingnya sendiri, termasuk arahan yang anda benarkan. Ia hanya boleh menulis dalam folder projek, internet disekat, dan ia tidak boleh membaca fail peribadi anda di luar projek. Apabila sesi bermula, GenOffice terlebih dahulu menyemak sama ada pengasingan ini berfungsi pada PC ini, dan tidak memulakan sesi jika tidak.
- **Claude Code** tidak dapat mengasingkan arahan pada Windows. Arahan yang anda benarkan boleh mencapai seluruh PC dan internet. Sebab itulah, dalam **Percayai projek ini**, penyemak Claude Code sendiri yang memeriksa setiap tindakan bagi pihak anda.

Dokumen yang dihantar oleh orang lain mungkin mengandungi arahan tersembunyi yang menyuruh AI melakukan perkara lain. Dalam folder yang berisi bahan yang anda tidak kenali, gunakan salah satu pilihan yang bertanya dahulu.

## Nota projek dan kemahiran

- Jika folder itu mempunyai `CLAUDE.md` atau `AGENTS.md`, kandungannya diberikan kepada ejen sebagai arahan. Tuliskan perkara yang perlu dipatuhi setiap kali: nada, istilah, format dokumen yang hendak dihasilkan.
- Claude Code mendapat salinan kemahiran dari tempat-tempat ini: `.claude/skills` dalam folder projek, `.ieumoffice/skills` dan `.claude/skills` dalam folder rumah anda, serta kemahiran daripada pemalam Claude yang dipasang. Bilangan kemahiran yang tersedia dipaparkan di bawah baris yang menyatakan sesi telah bermula.
- Codex membaca folder kemahirannya sendiri.
- Program yang digunakan oleh skrip sesuatu kemahiran (Python dan sebagainya) mesti dipasang pada PC ini.

## Fail baharu dan dokumen yang dibuka

- Fail baharu yang dibuat oleh ejen disimpan dalam folder projek. Tekan **Buka** pada baris itu dalam log kemajuan untuk membuka fail tersebut dalam tab GenOffice.
- Untuk meminta dokumen yang dibuka disunting, buka dokumen itu dalam GenOffice dahulu dan sebut namanya dalam permintaan anda.
- Dokumen yang anda buka semasa sesi boleh disunting mulai mesej anda yang seterusnya.

## Privasi dan penggunaan

- Bahagian yang anda sembunyikan daripada AI hanya kekal tersembunyi apabila aplikasi membaca dokumen yang dibuka dalam GenOffice untuk ejen. Fail yang dibaca sendiri oleh ejen dari folder dihantar seadanya.
- Ejen bekerja dalam banyak langkah, jadi ia menggunakan lebih banyak had langganan anda berbanding panel AI. Apabila had habis, permintaan itu gagal; ejen tidak pernah beralih kepada AI lain atau kepada sambungan yang dikenakan bayaran.

## Jika ada masalah

| Apa yang tertera pada tetingkap           | Apa yang perlu dibuat                                   |
| ----------------------------------------- | ------------------------------------------------------- |
| **Tidak bersambung**                      | Log masuk ke program itu di bawah **Tetapan ▸ AI**.     |
| **Folder ini tidak boleh digunakan**      | Pilih folder yang hanya mengandungi bahan kerja anda.   |
| **Codex tidak dapat membuka kotak pasir** | Kemas kini Windows, atau pilih Claude Code.             |
| **Had langganan anda telah habis**        | Hantar semula selepas had ditetapkan semula.            |
| **Program terlalu lama untuk mod ejen**   | Kemas kini program itu, kemudian tekan **Sesi baharu**. |
