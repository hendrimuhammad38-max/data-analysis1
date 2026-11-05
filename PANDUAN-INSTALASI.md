# 📋 Panduan Instalasi — Data Analysis (Backend GAS + Frontend GitHub Pages)

```
┌──────────────────────────────┐        fetch() POST (JSON, text/plain)        ┌──────────────────────────────┐
│ FRONTEND — GitHub Pages      │  ───────────────────────────────────────────▶  │ BACKEND — Google Apps Script │
│ index.html, css/, js/        │  ◀───────────────────────────────────────────  │ Kode.gs + Trigger.gs         │
│ https://USERNAME.github.io/… │              respons JSON                      │ Sheets · Drive · Gmail       │
└──────────────────────────────┘                                                └──────────────────────────────┘
```

Semua fitur tetap sama: login, peran Admin/Pengguna, unggah Excel, analisis + rumus, grafik, email, riwayat & edit, panel Admin, dan Trigger Otomatis.

---

## BAGIAN A — Backend (Google Apps Script)

File backend: **`Kode.gs`** dan **`Trigger.gs`**. Keduanya diberikan terpisah dan **tidak** dimasukkan ke GitHub.

### A1. Jika Anda SUDAH punya proyek Data Analysis versi lama (migrasi)
Data, akun, dan trigger Anda tetap aman. Anda **tidak perlu** menjalankan setup ulang.
1. Buka proyek di **script.google.com**.
2. Ganti isi file **`Kode`** dengan `Kode.gs` versi baru.
3. Ganti isi file **`Trigger`** dengan `Trigger.gs` versi baru.
4. **Hapus** 5 file HTML lama: `Index`, `Stylesheet`, `JavaScript`, `TriggerUI`, `TriggerJS`. Klik ⋮ di samping nama file, lalu **Hapus**. Tampilan sekarang berada di GitHub.
5. Klik 💾 Simpan.
6. Buka **Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan**. Dengan cara ini, URL `/exec` tetap sama.

### A2. Jika ini instalasi BARU
1. Buka **script.google.com → Proyek Baru**. Ganti nama file `Code.gs` menjadi **`Kode`**, lalu tempel `Kode.gs`.
2. Klik **＋ → Script**, beri nama **`Trigger`**, lalu tempel `Trigger.gs`.
3. Buka **⚙️ Setelan Proyek → Zona waktu** dan pilih **(GMT+08:00) Makassar**.
4. Pilih fungsi **`setupAppEnvironment`**, lalu klik ▶ **Jalankan** dan izinkan akses yang diminta.
5. Buka **Log eksekusi**, lalu catat **email Admin** dan **sandi awal**.
6. Buka **Terapkan → Deployment baru → ⚙️ Aplikasi web**:
   - Jalankan sebagai: **Saya**
   - Siapa yang memiliki akses: **Siapa saja**
7. Klik **Terapkan**, lalu **salin URL Aplikasi web** (berakhiran `/exec`).

### A3. Cek backend sudah aktif
Buka di browser: `URL_EXEC?action=ping`
Hasil yang benar berupa teks JSON seperti `{"success":true, ... "Backend aktif."}`.
Kalau yang muncul halaman login Google, berarti akses deployment belum diatur ke **Siapa saja**.

---

## BAGIAN B — Frontend (GitHub Pages)

### B1. Ekstrak ZIP & isi konfigurasi
1. Ekstrak `data-analysis-frontend.zip`. Anda akan mendapat folder **`data-analysis-frontend`**.
2. Buka file **`data-analysis-frontend/js/config.js`** dengan Notepad, lalu ganti bagian ini dengan URL `/exec` dari langkah A:
   ```js
   const GAS_URL = 'https://script.google.com/macros/s/GANTI_DENGAN_ID_DEPLOYMENT/exec';
   ```
3. Simpan file tersebut.

### B2. Folder yang di-upload ke GitHub
> ⚠️ **Folder kerja = `data-analysis-frontend`** (folder hasil ekstraksi). Semua perintah `git` dijalankan **di dalam folder ini**, jangan di folder induknya.

Saat menjalankan `dir` di folder itu, yang terlihat harus seperti ini:
```
css\
js\
index.html          ← wajib ada di sini
PANDUAN-INSTALASI.md
README.md
```

### B3. Ringkasan langkah GitHub
Langkah-langkah ini akan dipandu satu per satu di percakapan.
1. Pasang Git, lalu cek dengan `git --version`.
2. Buat akun GitHub.
3. Atur identitas Git: `git config --global user.name "..."` dan `git config --global user.email "..."`.
4. Buat repository **Public** baru tanpa README.
5. Buka PowerShell di folder `data-analysis-frontend`, lalu jalankan `git init` → `git add .` → `git commit -m "Upload pertama"` → `git branch -M main` → `git remote add origin https://github.com/USERNAME/NAMA-REPO.git` → `git push -u origin main`.
   Saat diminta password, gunakan **Personal Access Token**, bukan password akun.
6. Buka **Settings → Pages**, pilih Source: *Deploy from a branch*, Branch: **main / (root)**, lalu centang **Enforce HTTPS**.
7. Buka `https://USERNAME.github.io/NAMA-REPO/`.

### B4. Setelah situs online
1. Login sebagai Admin.
2. Buka **Pengaturan & Log**. Kolom **URL aplikasi (GitHub Pages)** sudah terisi otomatis; klik **Simpan Pengaturan**. URL ini dipakai untuk tombol "Buka Aplikasi" di email.
3. Bagikan alamat GitHub Pages kepada pengguna. URL `/exec` tidak perlu dibagikan.

### B5. Update tampilan di kemudian hari
Jalankan dari folder `data-analysis-frontend`:
```bash
git add .
git commit -m "Deskripsi perubahan"
git push
```
Tunggu 1–2 menit, lalu tekan **Ctrl+Shift+R** di browser.

> Jika yang berubah adalah **backend** (`Kode.gs`/`Trigger.gs`), cukup buat **Versi baru** di Kelola deployment. Frontend tidak perlu di-push ulang.

---

## ✨ Upgrade: Asisten Rumus
Menu baru **Asisten Rumus** untuk semua pengguna:
- **Ceritakan kebutuhan**, mis. *jumlahkan penjualan wilayah "Jawa" yang statusnya "Lunas"*. Aplikasi menyarankan rumus yang paling cocok dan langsung mengisinya.
- Tulis teks syarat di dalam **tanda kutip** ("Jawa") atau pakai kata pembanding (*di atas 75*, *minimal 70*) agar terisi otomatis.
- Bila file sudah dibuka di **Analisis Baru**, nama kolom yang disebut di deskripsi otomatis menjadi alamat kolom (mis. Penjualan → C2:C101).
- **Perakit rumus**: ubah isian, lalu rumus jadi diperbarui seketika dan siap disalin. Pemisah `;` / `,` bisa diganti.
- **Kamus Rumus Excel**: 188 rumus dalam 10 kategori, termasuk 32 resep kombinasi siap pakai, lengkap dengan contoh dan tanda versi Excel yang dibutuhkan.

Fitur ini berjalan sepenuhnya di browser. **Backend Apps Script tidak perlu diubah atau di-deploy ulang.** Cukup push frontend:
```
git add .
git commit -m "Tambah Asisten Rumus"
git push
```

## 🛠️ Pemecahan Masalah

| Gejala | Penyebab & solusi |
|--------|-------------------|
| Login menampilkan "Konfigurasi belum lengkap" | `GAS_URL` di `js/config.js` belum diisi. Isi, lalu push ulang. |
| "Backend tidak mengembalikan JSON" | Deployment belum diatur ke **Siapa saja**, atau URL bukan berakhiran `/exec`. Perbaiki di Kelola deployment. |
| "Tidak dapat terhubung ke server" | Koneksi internet terputus, atau URL `/exec` salah ketik. |
| Situs 404 | `index.html` tidak berada di root repository (salah folder saat `git init`). Ulangi push dari folder `data-analysis-frontend`. |
| Tampilan polos tanpa warna | Folder `css/` atau `js/` tidak ikut ter-upload. Upload lewat terminal, jangan lewat "Upload files" di web GitHub. |
| Perubahan backend tidak berlaku | Anda belum membuat **Versi baru** di Kelola deployment. |
| Admin lupa sandi | Jalankan `resetSandiAdmin()` di editor Apps Script. Sandi baru muncul di Log eksekusi. |
| Tombol di email membuka alamat lama | Simpan ulang **URL aplikasi** di menu Pengaturan. |

## 🔐 Catatan Keamanan
- Repository GitHub bersifat publik, tetapi aman karena hanya berisi tampilan dan alamat `/exec`. Tidak ada sandi, token, atau ID spreadsheet di dalamnya.
- Rahasia (hash sandi, kunci sesi, ID database) tetap tersimpan di **Script Properties** Apps Script.
- Token login dikirim di **body** permintaan, tidak pernah di URL. Semua pemeriksaan peran dilakukan di server.
- Backend hanya menerima aksi yang ada di daftar resmi (`API_ROUTES`).
