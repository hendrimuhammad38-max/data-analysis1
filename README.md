# Data Analysis — Frontend (GitHub Pages)

Aplikasi web untuk membuat analisis data dari file Excel, lengkap dengan rumus Excel siap pakai, grafik, email otomatis, dan Trigger Otomatis untuk Admin.

- **Frontend:** folder ini (HTML/CSS/JS statis), dihosting di GitHub Pages.
- **Backend:** Google Apps Script sebagai REST API (`Kode.gs` + `Trigger.gs`). File backend tidak disimpan di repository ini.

## Struktur

```
index.html        ← halaman utama (harus berada di root repository)
css/style.css     ← tampilan "Clean Glass" + mode gelap
js/config.js      ← ISI GAS_URL dengan URL /exec Apps Script
js/app.js         ← logika aplikasi (login, unggah Excel, analisis, riwayat, admin)
js/trigger.js     ← menu Trigger Otomatis (Admin)
```

## Konfigurasi

Edit `js/config.js`:

```js
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxggvQHBo2EiCtITNPWcThoWokpxH2tkpmafJwFodJlrBLhvbrGCT5lwIGZWOBPpv9u/exec';
```

## Update situs

```bash
git add .
git commit -m "Deskripsi perubahan"
git push
```

Panduan lengkapnya ada di `PANDUAN-INSTALASI.md`.
