# Sambungan langganan

GenOffice menjalankan AI dengan langganan yang anda sudah ada: langganan Claude (Anthropic) atau langganan Codex (OpenAI). Codex ialah program OpenAI, dan anda log masuk ke dalamnya dengan pelan ChatGPT anda. Anda tidak memerlukan kunci API, dan GenOffice tidak mempunyai akaun sendiri untuk didaftarkan.

## Cara ia berfungsi

- AI tidak terbina dalam GenOffice. Sebuah program daripada syarikat itu dipasang pada PC ini — **Claude Code** untuk langganan Claude, **Codex** untuk langganan ChatGPT — dan GenOffice meminta jawapan daripada program itu.
- Program itu dilog masuk dengan akaun anda sendiri, jadi setiap permintaan dikira dalam pelan anda sendiri.
- GenOffice tidak pernah memaparkan borang log masuknya sendiri, dan tidak pernah membaca atau menyimpan maklumat log masuk anda. Anda log masuk di dalam program dan halaman web syarikat itu sendiri.

## Sebelum bermula

Anda memerlukan salah satu daripada yang berikut. Mempunyai kedua-duanya pun tidak mengapa.

- Langganan Claude, dan program Claude Code yang sudah dipasang serta dilog masuk pada PC ini.
- Langganan ChatGPT, dan program Codex yang sudah dipasang serta dilog masuk pada PC ini.

Jika program itu belum dipasang, atau belum dilog masuk, butang dalam bahagian seterusnya akan menguruskannya.

## Menyambung

1. Buka **Tetapan** daripada baris di penjuru kiri bawah Laman Utama dan pilih **AI**. Di bawah **Sambungan langganan** terdapat satu kad untuk Claude dan satu untuk Codex.
2. Baca apa yang tertera pada kad itu dan tekan butangnya. Jadual di bawah menerangkan setiap keadaan.
3. Kembali ke tetingkap GenOffice. Kad itu menyemak semula dengan sendirinya, dan **Semak semula** menyemak serta-merta.

Kad yang sama muncul pada langkah kedua skrin alu-aluan semasa pelancaran pertama, dan dalam panel AI apabila tiada AI yang disambungkan. Anda boleh melangkaunya dan menyambung kemudian.

| Apa yang tertera pada kad                          | Maksudnya                                                                                                          | Apa yang perlu dibuat                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sedang menyemak…**                               | GenOffice sedang bertanya kepada program itu tentang keadaannya.                                                   | Tunggu sebentar.                                                                                                                                                                                                                                                                                              |
| **Belum dipasang**                                 | Program itu tidak ditemui pada PC ini.                                                                             | Tekan **Pasang**. Arahan pemasangan rasmi syarikat itu dijalankan dalam tetingkap terminal baharu, jadi anda boleh melihat apa yang dilakukannya. GenOffice sendiri tidak memuat turun apa-apa. Jika anda mahu memasangnya secara manual, **Panduan pemasangan rasmi** membuka panduan daripada syarikat itu. |
| **Belum log masuk**                                | Program itu ada tetapi belum dilog masuk.                                                                          | Tekan **Log masuk**. Proses log masuk program itu sendiri bermula dalam tetingkap baharu dan membuka halaman log masuk syarikat itu dalam pelayar anda. Selesaikannya di sana.                                                                                                                                |
| **Disambungkan**                                   | Log masuk dengan langganan telah disahkan. Nama pelan dipaparkan apabila program itu melaporkannya.                | Tiada apa-apa. AI sedia digunakan.                                                                                                                                                                                                                                                                            |
| **Sudah log masuk, tetapi bukan dengan langganan** | Program itu dilog masuk dengan kunci API atau akaun bayar ikut guna, atau jenis log masuknya tidak dapat disahkan. | Lihat "Log masuk bayar ikut guna" di bawah.                                                                                                                                                                                                                                                                   |
| **Sambungan tidak dapat disemak**                  | Semakan itu sendiri gagal. Sebabnya ditunjukkan pada kad.                                                          | Tekan **Semak semula**. Jika kad menyatakan program itu terlalu lama, kemas kini program itu dan semak semula.                                                                                                                                                                                                |

Sambungan disemak apabila aplikasi dimulakan, apabila anda membuka Tetapan, dan apabila anda kembali ke tetingkap selepas memulakan pemasangan atau log masuk.

## Log masuk bayar ikut guna

Kad yang menyatakan **Sudah log masuk, tetapi bukan dengan langganan** membawa amaran: "Ini bukan langganan: anda dicaj mengikut penggunaan."

- GenOffice tidak menggunakan log masuk itu sehingga anda menekan **Guna juga**. Selepas itu, setiap permintaan dicaj kepada akaun tersebut.
- Walaupun begitu, ia tidak pernah dipilih secara automatik. Pilihlah sendiri di bawah **AI yang digunakan**, tempat ia ditandakan **Berbayar**.
- Kebenaran anda diingati untuk program itu sahaja. Ia dipadamkan apabila program itu dilog keluar atau log masuknya berubah.
- Jika anda mahu menggunakan langganan anda, log masuk ke program itu dengan akaun langganan anda dan tekan **Semak semula**.

## Menukar akaun atau log keluar

Apabila program itu telah log masuk, kadnya memaparkan akaun yang digunakan di sebelah nama pelan, jika program melaporkannya. Kad itu juga mempunyai dua butang.

- **Log masuk dengan akaun lain** memulakan semula log masuk program itu sendiri. Selesaikannya dalam tetingkap yang terbuka, dengan akaun yang lain.
- **Log keluar** menjalankan log keluar program itu sendiri. Selepas itu kad memaparkan **Belum log masuk**.
- Kedua-duanya terpakai kepada program itu pada seluruh PC ini, bukan hanya GenOffice. Jika anda turut menggunakan Claude Code atau Codex dalam terminal, di sana juga ia dilog keluar atau bertukar kepada akaun yang lain. Oleh itu GenOffice meminta pengesahan anda terlebih dahulu.
- Akaun dan dua butang ini hanya ada di sini, di bawah Tetapan ▸ AI. GenOffice hanya memaparkan akaun itu dan tidak menyimpannya di mana-mana.

## AI mana yang digunakan

**AI yang digunakan**, di bawah Tetapan ▸ AI, bermula pada **Automatik**. Automatik memutuskan mengikut urutan ini:

1. Claude, apabila kadnya menyatakan Disambungkan.
2. Jika tidak, Codex, apabila kadnya menyatakan Disambungkan.
3. Jika tidak, tiada AI yang disambungkan, dan panel AI memaparkan kad sambungan dan bukannya ralat.

Automatik tidak pernah memilih apa-apa yang mengenakan kos tambahan: bukan kunci API, dan bukan log masuk bayar ikut guna. Kedua-duanya digunakan hanya selagi anda sendiri memilihnya.

Anda juga boleh memilih satu AI sendiri, di tempat yang sama atau dalam senarai model di bahagian bawah panel AI. Jika AI yang anda pilih berhenti berfungsi, GenOffice tidak beralih secara senyap kepada yang lain. Ia memberitahu anda apa yang berlaku dan menunjukkan cara menyambung semula.

Senarai model memaparkan model yang dilaporkan oleh program itu sendiri: setiap satu dengan namanya dan ID model yang tepat di sebelahnya, dan **Model lalai** menyatakan model yang diwakilinya sekarang. Label di bahagian bawah panel AI dan **AI yang digunakan** turut menamakan model itu. Membaca senarai ini tidak bertanya apa-apa kepada AI, jadi ia tidak dikira dalam pelan anda. Jika program terlalu lama untuk melaporkan modelnya, senarai ringkas terbina dalam dipaparkan sebagai ganti.

Di mana-mana sahaja Codex boleh dipilih, satu baris dipaparkan bersamanya: "Menggunakan langganan Codex di dalam aplikasi bukan kaedah yang disyorkan secara rasmi oleh OpenAI." Buatlah keputusan dengan mengambil kira perkara itu.

## Apabila permintaan dihentikan

Permintaan berhenti apabila had pelan habis digunakan, apabila log masuk telah tamat, atau apabila program itu sudah tiada. GenOffice tidak beralih kepada AI lain dengan sendirinya.

- Sebabnya ditunjukkan di tempat balasan itu terhenti. Bagi had yang habis digunakan, masa had itu ditetapkan semula turut ditunjukkan, apabila program itu melaporkannya.
- Jika langganan anda yang satu lagi disambungkan, butang **Teruskan dengan …** muncul, contohnya **Teruskan dengan Codex**. Menekannya menjadikan langganan itu AI yang digunakan — senarai model menunjukkan perubahan itu — dan menjalankan permintaan itu semula.
- Jika satu-satunya sambungan lain ialah log masuk bayar ikut guna yang telah anda benarkan, butang yang sama disertai nota tentang kosnya.
- Tidak pernah ada butang yang mengalihkan anda kepada kunci API.

## Baris penggunaan

Setelah anda menggunakan 80% atau lebih daripada sesuatu had, panel AI memaparkan baris seperti "85% digunakan · ditetapkan semula pada 3:00 PTG". Claude melaporkan had 5 jam dan had 7 hari, dan Codex ditunjukkan dengan cara yang sama apabila ia melaporkannya. Di bawah 80%, atau apabila program itu tidak melaporkan apa-apa, tiada baris ditunjukkan.

## Apa yang dihantar, dan ke mana

Kali pertama langganan boleh digunakan, GenOffice memaparkan satu notis, sekali sahaja. Untuk membacanya semula, pergi ke Tetapan ▸ AI ▸ **Notis sambungan pertama** dan tekan **Lihat semula**. Notis itu menyatakan tiga perkara:

- Kandungan dokumen dan perbualan anda dihantar kepada Anthropic atau OpenAI di bawah akaun anda sendiri.
- Sama ada kandungan itu digunakan untuk melatih AI ditentukan oleh tetapan akaun anda sendiri di syarikat tersebut, bukan oleh GenOffice.
- GenOffice mematikan penyimpanan sejarah perbualan Codex, tetapi Codex mungkin masih menyimpan log diagnostiknya sendiri pada PC ini.

Apa-apa yang anda sembunyikan dengan **Sembunyikan pemilihan daripada AI** tidak dihantar, tidak kira AI mana yang anda gunakan.

## Elok diketahui

- **Kelajuan.** Balasan melalui langganan bermula beberapa saat lebih lewat berbanding balasan melalui kunci API, kerana program syarikat itu perlu dimulakan dahulu.
- **Pelan ChatGPT percuma.** Ia dipaparkan sebagai Disambungkan, tetapi hadnya kecil, jadi permintaan terhenti lebih cepat. Baris penggunaan tidak muncul untuknya.
- **Penjanaan imej.** Dalam versi ini, langganan tidak menjana imej, dalam mana-mana pelan. Itu memerlukan kunci penyedia imej; lihat [Model AI dan tetapan](help://ai-models).
- **Proksi.** Claude Code dan Codex tidak mengambil tetapan proksi daripada GenOffice. Kedua-duanya menggunakan proksi yang ditetapkan untuk PC ini, contohnya pemboleh ubah persekitaran `HTTPS_PROXY`, sama seperti apabila anda menjalankannya dalam terminal. Jika kedua-duanya tidak dapat bersambung dalam terminal, kedua-duanya juga tidak dapat bersambung dari sini.
- **Perintah dan program lain.** Permintaan yang datang daripada perintah `ieumoffice` atau daripada ejen penulisan kod yang disambungkan tidak menggunakan langganan anda melainkan anda membenarkannya. Lihat [Menyambungkan ejen penulisan kod](help://mcp).
