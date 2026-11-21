# DikzCryz v6

Isi: chat komunitas + chat pribadi ke admin, YouTube, Equalizer, profil, tema, token per pembeli.

## 1. Server (Supabase, gratis)
1. supabase.com > New project.
2. Authentication > Users > Add user: buat akun admin (email + password). Authentication > Sign In / Providers: matikan "Allow new users to sign up".
3. SQL Editor: tempel seluruh isi `supabase/schema.sql`, jalankan. Lalu jalankan satu baris ini (ganti emailnya):
   `insert into admins (email) values ('emailadmin@kamu.com');`
4. Project Settings > API: catat **Project URL** dan **anon / publishable key**.

## 2. GitHub Secrets
`gh secret set SUPABASE_URL`, `gh secret set SUPABASE_ANON_KEY`, `gh secret set YT_API_KEY` (paste nilainya saat diminta).

## 3. Kunci tetap APK (wajib sebelum dijual)
Supaya update bisa dipasang di atas versi lama dan ID perangkat tidak berubah:
```
pkg install openjdk-17 -y
keytool -genkeypair -keystore ~/dikz.jks -alias dikz -keyalg RSA -keysize 2048 -validity 10000 -storepass PASSWORDKAMU -keypass PASSWORDKAMU -dname "CN=Dikz"
base64 -w0 ~/dikz.jks | gh secret set KEYSTORE_B64
gh secret set KEYSTORE_PASSWORD
gh secret set KEY_ALIAS
gh secret set KEY_PASSWORD
```
(KEY_ALIAS diisi `dikz`; kedua password diisi PASSWORDKAMU.) Simpan `~/dikz.jks` di tempat aman, kalau hilang aplikasi tidak bisa di-update.

## 4. Web admin
Buka `admin/index.html` (dari laptop, atau upload ke Netlify/Cloudflare Pages). Isi URL + key + email/password admin. Di sana: buat token, atur batas HP, cabut, blokir, hapus pesan, balas chat pribadi. File ini TIDAK ikut ke dalam APK.

## 5. Mode tampilan v6
Pengaturan menyediakan mode Otomatis, Ringan, dan Penuh. Mode Otomatis membaca RAM perangkat; mode Ringan memakai wallpaper 720px, poster statis di gerbang, mengurangi animasi, dan memperlambat polling chat.

## 6. Isi nomor WA developer
`app/src/main/assets/www/core.js` > `DEV_WA` (format 628xxxxxxxxxx).
