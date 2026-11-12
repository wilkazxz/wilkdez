# Setup WilkDez (Firebase + Vercel)

1. Firebase Console > buat project > Build > Authentication > aktifkan Email/Password.
2. Authentication > Users > Add user: buat akun 2 admin.
3. Build > Firestore Database > Create database.
4. Firestore > Rules: tempel isi firestore.rules (ganti 2 email admin), lalu Publish.
5. Project settings > Add app (Web) > salin config ke firebase-config.js.
6. Authentication > Settings > Authorized domains: tambahkan domain Vercel dan WilkDez.co.
7. Upload semua file ke GitHub, import repo ke Vercel.
8. Buka /admin.html, login, upload logo dan hero, Simpan.
