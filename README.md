# DikzCryz

APK berisi: AI (Gemini), YouTube (beranda, cari, short, histori, mini player), Equalizer (band, preset, bass, 3D, volume+), profil, sidebar + 3 tema.

## Cara build (paling gampang: GitHub Actions)
1. Buat repo **private** di GitHub, upload semua isi folder ini.
2. Repo > Settings > Secrets and variables > Actions > New secret:
   - `YT_API_KEY` = key YouTube Data API v3
   - `GEMINI_API_KEY` = key Gemini
3. Tab Actions > Build APK > Run workflow. Selesai, download artifact `DikzCryz-apk` (isinya app-release.apk).

Dari Termux: `git push` saja, lalu ambil hasilnya dengan `gh run download`.

## File yang bisa kamu tambah (taruh di app/src/main/assets/www/)
- `intro.mp4`  video layar loading (8 detik)
- `hero.png`   foto karakter untuk beranda
- `fonts/Jamstreet.ttf`  font nama DikzCryz

## Catatan
- Nomor WA developer: isi di `core.js` (`DEV_WA`) atau di Sidebar > Pengaturan.
- Key yang dimasukkan lewat Secrets tidak ada di repo, tapi tetap bisa diambil orang yang membongkar APK. Batasi key di Google Cloud Console.
- Equalizer memakai efek audio global. Beberapa HP menolaknya; di sana muncul tombol "Buka equalizer sistem".
