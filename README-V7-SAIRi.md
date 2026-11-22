# DikzCryz v7 — AI Sairi (Tahap awal)

## Yang sudah ditambahkan
- Halaman AI Sairi terpisah dari chat komunitas/admin.
- Chat AI melalui backend, riwayat chat disimpan lokal di perangkat.
- Tombol `Kirim sebagai VN`, pemutar MP3, dan kecepatan 1x/1.5x/2x.
- Mode VN otomatis untuk balasan berikutnya.
- Server memeriksa sesi aplikasi melalui Supabase sebelum meneruskan permintaan.
- API key AI dan suara hanya berada di server.

## Yang belum aktif otomatis
Aplikasi belum bisa memakai AI sampai backend dipasang di hosting dan API key disiapkan. Mode percakapan suara langsung/STT, paket Premium/VIP, pembayaran, serta kuota berbayar belum termasuk tahap ini. Batas permintaan di server saat ini adalah pembatas sementara per proses, bukan sistem billing/kuota permanen.

## Menyiapkan backend
1. Siapkan server Node.js 20+ dengan folder `server/`.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env`.
4. Isi `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ELEVENLABS_API_KEY`, dan `ELEVENLABS_VOICE_ID`.
5. Jalankan `npm start`. Tes `GET /health`.
6. Deploy server ke hosting HTTPS. Jangan mengunggah file `.env`.
7. Di aplikasi DikzCryz buka Menu > Pengaturan, isi alamat HTTPS backend AI, lalu Simpan.

## Pemilihan suara Sairi
Pilih voice yang berizin digunakan untuk aplikasi dan penggunaan komersial sesuai paket layanan. Masukkan Voice ID ke `ELEVENLABS_VOICE_ID`. Jangan meniru suara orang nyata tanpa izin.

## Keamanan dan batasan
- Server memvalidasi session menggunakan RPC `whoami` pada Supabase.
- API key tidak ditanam ke APK.
- Pembatas sementara server hilang ketika proses server restart dan belum cukup untuk penagihan pengguna.
- Sebelum dijual, tambahkan kuota persisten per akun/token, cache VN, pemantauan biaya, dan sistem pembayaran yang sah.
- Percakapan AI dan audio yang dibuat dikirim ke penyedia layanan terkait untuk diproses. Beri pemberitahuan privasi yang jelas kepada pengguna.

## Build APK
Versi aplikasi dinaikkan menjadi 7.0 (versionCode 7). Build APK tetap dilakukan lewat GitHub Actions sesuai workflow proyek. ZIP ini berisi source; bukan APK hasil build.
