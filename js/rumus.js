/**
 * ============================================================
 * DATA ANALYSIS — Upgrade: Asisten Rumus (frontend)
 * File TAMBAHAN; memakai helper yang sudah ada di js/app.js
 * (state, $, esc, ubahPemisah, salinTeks, showToast, navigateTo, setPemisah).
 * Seluruhnya berjalan di browser — tidak perlu mengubah backend Apps Script.
 * ============================================================
 */
const rm = { indeks: null, dipilih: null, nilaiAwal: [], terakhirCari: '', saranTerakhir: [] };

// ── Navigasi: tambahkan rute "rumus" tanpa mengubah navigateTo() asli ──
(function () {
  const navigateAsli = navigateTo;
  navigateTo = function (section, opsi) {
    if (section !== 'rumus') return navigateAsli(section, opsi);
    navigateAsli('rumus', { tanpaMuat: true });
    $('pageTitle').textContent = 'Asisten Rumus';
    rmSiapkan();
  };
  // Saat pemisah ; / , diganti, perbarui perakit rumus juga
  const pemisahAsli = setPemisah;
  setPemisah = function (v) { pemisahAsli(v); rmPemisahBerubah(); };
})();

document.addEventListener('DOMContentLoaded', () => {
  $('rmDeskripsi').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); rmCari(); } });
  $('rmKamusCari').addEventListener('input', rmRenderKamus);
  $('rmKamusKat').addEventListener('change', rmRenderKamus);
  $('rmKamusKat').innerHTML = '<option value="">Semua kategori</option>' +
    Object.keys(RUMUS_KATEGORI).map(k => '<option value="' + k + '">' + esc(RUMUS_KATEGORI[k].nama) + '</option>').join('');
});

// ════════════════════════════════════════════════════════
// PENCOCOKAN DESKRIPSI → RUMUS
// ════════════════════════════════════════════════════════
const RM_STOP = ['yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'saya', 'aku', 'ingin', 'mau', 'tolong', 'cara', 'rumus', 'excel', 'data', 'kolom', 'sel', 'apa', 'bagaimana', 'bisa', 'ada', 'itu', 'ini', 'pada', 'dalam', 'atau', 'juga', 'agar', 'supaya', 'buat', 'membuat', 'bikin', 'tabel', 'nilai'];

/** Stemmer sederhana bahasa Indonesia (cukup untuk pencocokan kata kunci) */
function rmStem(w) {
  if (w.length <= 4 || /\d/.test(w)) return w;
  let s = w.replace(/(nya|lah|kah)$/, '');
  if (s.length > 5) s = s.replace(/(kan|an)$/, '');
  const p = s.match(/^(meng|meny|mem|men|me|peng|peny|pem|pen|per|pe|di|ber|ter|ke|se)/);
  if (p && s.length - p[0].length >= 4) s = s.slice(p[0].length);
  return s;
}
function rmToken(teks) {
  return String(teks || '').toLowerCase().replace(/[^a-z0-9#/]+/g, ' ').trim().split(/\s+/).filter(Boolean).map(rmStem);
}
function rmIndeks() {
  if (rm.indeks) return rm.indeks;
  rm.indeks = RUMUS_DATA.map((r, i) => ({
    i, r,
    nama: r.f.toLowerCase(),
    frasa: String(r.w || '').split(';').map(p => p.trim()).filter(Boolean).map(p => ({ asli: p, tok: rmToken(p) })).filter(p => p.tok.length),
    teksCari: (r.f + ' ' + r.d + ' ' + r.w).toLowerCase()
  }));
  return rm.indeks;
}

function rmCocokkan(deskripsi) {
  const tok = rmToken(deskripsi);
  if (!tok.length) return [];
  const str = ' ' + tok.join(' ') + ' ';
  const set = new Set(tok);
  const low = ' ' + String(deskripsi).toLowerCase() + ' ';
  const syarat = rmEkstrakSyarat(deskripsi, rmKolomFile());
  const yangSyarat = /\byang\s+(statusnya\s+|berstatus\s+)?(?!paling|ter|lebih|kurang|di\b|sudah|mana)[a-z]{3,}(?<!nya)\b/.test(low);
  const adaKondisi = /\b(jika|kalau|apabila|hanya|khusus|berdasarkan|kriteria|syarat|per|setiap|tiap)\b/.test(low) || yangSyarat || syarat.kriteria.length > 0;
  const banyakSyarat = adaKondisi && (/\b(dan|serta|sekaligus|beberapa syarat|dua syarat|dua kriteria|antara)\b/.test(low) || syarat.kriteria.length >= 2);

  const hasil = rmIndeks().map(x => {
    let skor = 0;
    const alasan = [];
    if (set.has(rmStem(x.nama)) || low.indexOf(' ' + x.nama + ' ') >= 0 || low.indexOf(x.nama + '(') >= 0) { skor += 10; alasan.push(x.r.f); }
    let sebagian = 0;
    x.frasa.forEach(p => {
      const ps = ' ' + p.tok.join(' ') + ' ';
      if (str.indexOf(ps) >= 0) { skor += 2 + 1.5 * (p.tok.length - 1); if (alasan.indexOf(p.asli) < 0) alasan.push(p.asli); }
      else {
        const kena = p.tok.filter(t => set.has(t) && RM_STOP.indexOf(t) < 0).length;
        if (kena) sebagian += 0.45 * kena;
      }
    });
    skor += Math.min(sebagian, 2);
    if (skor > 0) {
      if (adaKondisi) { if (x.r.g === 'if') skor += 2; if (x.r.g === 'ifs') skor += 1.5; if (['SUM', 'COUNT', 'COUNTA', 'AVERAGE', 'MAX', 'MIN'].indexOf(x.r.f) >= 0) skor -= 2.5; }
      if (!adaKondisi && (x.r.g === 'if' || x.r.g === 'ifs')) skor -= 1.5;
      if (banyakSyarat) { if (x.r.g === 'ifs') skor += 2.5; if (x.r.g === 'if') skor -= 0.5; }
      if (!x.r.v) skor += 0.2;
    }
    return { x, skor, alasan };
  }).filter(h => h.skor >= 1.5).sort((a, b) => b.skor - a.skor);
  return hasil.slice(0, 6);
}

/** Ambil syarat dari kalimat: "di atas 75" → >75, teks dalam tanda kutip → "Lunas" */
function rmEkstrakSyarat(deskripsi, kolom) {
  const low = String(deskripsi || '').toLowerCase();
  const kriteria = [], angka = [], temuan = [];
  const pola = /(lebih dari sama dengan|lebih besar sama dengan|tidak kurang dari|tidak lebih dari|paling sedikit|sekurang-kurangnya|sekurangnya|paling banyak|lebih dari|lebih besar dari|di atas|diatas|melebihi|kurang dari|lebih kecil dari|di bawah|dibawah|minimal|minimum|maksimal|maksimum|sama dengan|>=|<=|<>|>|<|=)\s*(rp\.?\s*)?(-?\d[\d.,]*)\s*(juta|jt|ribu|rb|miliar|m)?\b/g;
  const op = { 'lebih dari sama dengan': '>=', 'lebih besar sama dengan': '>=', 'tidak kurang dari': '>=', 'paling sedikit': '>=', 'sekurang-kurangnya': '>=', 'sekurangnya': '>=', 'minimal': '>=', 'minimum': '>=', 'tidak lebih dari': '<=', 'paling banyak': '<=', 'maksimal': '<=', 'maksimum': '<=', 'lebih dari': '>', 'lebih besar dari': '>', 'di atas': '>', 'diatas': '>', 'melebihi': '>', 'kurang dari': '<', 'lebih kecil dari': '<', 'di bawah': '<', 'dibawah': '<', 'sama dengan': '=', '>=': '>=', '<=': '<=', '<>': '<>', '>': '>', '<': '<', '=': '=' };
  const kali = { juta: 1e6, jt: 1e6, ribu: 1e3, rb: 1e3, miliar: 1e9, m: 1e9 };
  let m;
  while ((m = pola.exec(low))) {
    let n = parseAngka(m[3]);
    if (n === null) continue;
    if (m[4]) n *= kali[m[4]];
    const o = op[m[1]];
    angka.push({ op: o, n });
    temuan.push({ pos: m.index, v: o === '=' ? String(n) : o + n });
  }
  const kutip = /["“”']([^"“”']{1,60})["“”']/g;
  const adaKutip = kutip.test(String(deskripsi)); kutip.lastIndex = 0;
  while ((m = kutip.exec(String(deskripsi)))) temuan.push({ pos: m.index, v: m[1].trim() });
  if (!adaKutip) {
    // Tanpa tanda kutip: tebak dari "yang lunas" atau "<nama kolom> jawa"
    const LARANG = /^(yang|per|dan|atau|di|ke|dari|untuk|dengan|paling|ter\w*|\w+nya|lebih|kurang|sama|setiap|tiap|adalah|bulan|tahun|hari|data|semua|total|jumlah|rata|berapa|yg|minimal|maksimal|minimum|maksimum|atas|bawah|tidak|melebihi|antara|sebelum|sesudah|setelah)$/;
    const judul = w => w.charAt(0).toUpperCase() + w.slice(1);
    const namaKolom = (kolom || []).map(c => c.nama.toLowerCase());
    const re1 = /\byang\s+(?:statusnya\s+|berstatus\s+)?([a-z][a-z0-9]{2,})/g;
    while ((m = re1.exec(low))) if (!LARANG.test(m[1]) && namaKolom.indexOf(m[1]) < 0) temuan.push({ pos: m.index, v: judul(m[1]) });
    namaKolom.forEach(nk => {
      if (!nk) return;
      const re2 = new RegExp('\\b' + nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:nya)?\\s+(?:adalah\\s+)?([a-z][a-z0-9]{2,})', 'g');
      while ((m = re2.exec(low))) if (!LARANG.test(m[1]) && namaKolom.indexOf(m[1]) < 0 && !temuan.some(t => t.v.toLowerCase() === m[1])) temuan.push({ pos: m.index, v: judul(m[1]) });
    });
  }
  temuan.sort((a, b) => a.pos - b.pos).forEach(t => { if (kriteria.indexOf(t.v) < 0) kriteria.push(t.v); });
  return { kriteria, angka };
}

// ════════════════════════════════════════════════════════
// KOLOM DARI FILE YANG SEDANG DIBUKA DI "ANALISIS BARU"
// ════════════════════════════════════════════════════════
function rmKolomFile() {
  const s = state.file && state.file.sheet;
  if (!s || !s.kolom || !s.kolom.length) return [];
  const akhir = s.barisAwal + Math.max(s.rows.length, 1) - 1;
  return s.kolom.map(c => ({
    huruf: c.huruf, nama: c.nama, tipe: c.tipe,
    rentang: c.huruf + s.barisAwal + ':' + c.huruf + akhir,
    rentangAbs: '$' + c.huruf + '$' + s.barisAwal + ':$' + c.huruf + '$' + akhir,
    sel: c.huruf + s.barisAwal,
    selAbs: '$' + c.huruf + '$' + s.barisAwal,
    tok: rmToken(c.nama)
  }));
}

// ════════════════════════════════════════════════════════
// ARGUMEN & PENYUSUNAN RUMUS
// ════════════════════════════════════════════════════════
function rmArg(spec) {
  const opsional = spec.charAt(0) === '?';
  const p = (opsional ? spec.slice(1) : spec).split('|');
  return { t: p[0], label: p[1] || '', contoh: p[2] !== undefined ? p[2] : '', peran: p[3] || '', opsional };
}
const RM_REF = /^(\$?[A-Za-z]{1,3}\$?\d+(:\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+|[^!]+![^!]+)$/;
const RM_ANGKA = /^-?\d+([.,]\d+)?%?$/;
/** Beri tanda kutip pada teks biasa; biarkan angka, alamat sel, rumus, TRUE/FALSE apa adanya */
function rmKutip(v) {
  const s = String(v);
  if (s === '') return '';
  const t = s.trim();
  if (t && (/^".*"$/.test(t) || RM_ANGKA.test(t) || RM_REF.test(t) || /^(TRUE|FALSE)$/i.test(t) ||
    /^[A-Za-z][A-Za-z0-9.]*\(.*\)$/.test(t) || /&/.test(t))) return t;
  return '"' + s.replace(/"/g, '""') + '"';
}
function rmFormatArg(a, v) {
  if (v === '' || v === undefined || v === null) return (a.t === 's' && !a.opsional && a.contoh === '') ? '""' : '';
  if (a.t === 'k' || a.t === 's') return rmKutip(v);
  return String(v).trim();
}

function rmSusun(r, nilai) {
  const sep = state.pemisah;
  const args = r.a.map(rmArg);
  const kurang = [];
  const v = args.map((a, i) => {
    const f = rmFormatArg(a, nilai[i]);
    if (f === '' && !a.opsional) kurang.push(a.label);
    return f;
  });
  let rumus;
  if (r.t) {
    rumus = '=' + ubahPemisah(r.t, sep).replace(/\{(\d+)\}/g, (_, n) => v[n - 1] !== '' ? v[n - 1] : '?');
  } else {
    let isi = v.map(x => x === '' ? '' : x);
    while (isi.length && isi[isi.length - 1] === '' && args[isi.length - 1].opsional) isi.pop();
    isi = isi.map((x, i) => x === '' && !args[i].opsional ? '?' : x);
    rumus = '=' + r.f + '(' + isi.join(sep) + ')';
  }
  return { rumus, kurang };
}

/** Isi argumen otomatis dari deskripsi + kolom file (bila ada) */
function rmIsiOtomatis(r, deskripsi) {
  const sep = state.pemisah;
  const args = r.a.map(rmArg);
  const nilai = args.map(a => ubahPemisah(a.contoh, sep));
  if (!deskripsi) return { nilai, terisi: [] };
  const terisi = [];
  const kolom = rmKolomFile();
  const strDesk = ' ' + rmToken(deskripsi).join(' ') + ' ';
  const disebut = kolom.filter(c => c.tok.length && strDesk.indexOf(' ' + c.tok.join(' ') + ' ') >= 0)
    .sort((a, b) => strDesk.indexOf(' ' + a.tok.join(' ') + ' ') - strDesk.indexOf(' ' + b.tok.join(' ') + ' '));
  const terpakai = new Set();
  const syarat = rmEkstrakSyarat(deskripsi, kolom);
  let iKriteria = 0;
  const low = ' ' + String(deskripsi).toLowerCase() + ' ';
  const NAMA_BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  const bulan = NAMA_BULAN.findIndex(b => low.indexOf(' ' + b + ' ') >= 0 || low.indexOf(' ' + b.slice(0, 3) + ' ') >= 0) + 1;
  const pembulatan = /\bjuta/.test(low) ? -6 : /\bribu/.test(low) ? -3 : /\bratus/.test(low) ? -2 : /\bpuluh/.test(low) ? -1 : /bilangan bulat|tanpa (desimal|koma)/.test(low) ? 0 : null;

  const ambilKolom = (peran, bolehLain) => {
    let c = disebut.find(k => !terpakai.has(k.huruf) && (!peran || k.tipe === peran));
    if (!c && peran === 'teks') c = disebut.find(k => !terpakai.has(k.huruf) && k.tipe !== 'angka');
    if (!c && bolehLain) c = disebut.find(k => !terpakai.has(k.huruf));
    if (c) terpakai.add(c.huruf);
    return c;
  };

  args.forEach((a, i) => {
    const absolut = /\$/.test(a.contoh) || /\$/.test(a.label);
    if (a.t === 'r' && a.peran) {
      const lanjutKriteriaAngka = args[i + 1] && args[i + 1].t === 'k' && syarat.angka.length > 0;
      const c = ambilKolom(a.peran, lanjutKriteriaAngka);
      if (c) { nilai[i] = absolut ? c.rentangAbs : c.rentang; terisi.push(i); }
    } else if (a.t === 'k') {
      if (iKriteria < syarat.kriteria.length) { nilai[i] = syarat.kriteria[iKriteria++]; terisi.push(i); }
    } else if (a.t === 'n' && /^Bulan/.test(a.label) && bulan) {
      nilai[i] = String(bulan); terisi.push(i);
    } else if (a.t === 'n' && /desimal/i.test(a.label) && pembulatan !== null) {
      nilai[i] = String(pembulatan); terisi.push(i);
    } else if (a.t === 'n' && /batas|kkm/i.test(a.label) && syarat.angka.length) {
      nilai[i] = String(syarat.angka[0].n); terisi.push(i);
    } else if (a.t === 'n' && a.peran && /sel|tanggal|nilai|harga/i.test(a.label)) {
      const c = ambilKolom(a.peran);
      if (c) { nilai[i] = absolut ? c.selAbs : c.sel; terisi.push(i); }
    } else if (a.t === 'x' && /^[A-Z]+\d+\s*[<>=]/.test(a.contoh) && syarat.angka.length && i === 0) {
      const c = ambilKolom('angka');
      const s = syarat.angka[0];
      if (c) { nilai[i] = c.sel + (s.op === '=' ? '=' : s.op) + s.n; terisi.push(i); }
    }
  });
  return { nilai, terisi };
}

// ════════════════════════════════════════════════════════
// TAMPILAN
// ════════════════════════════════════════════════════════
function rmSiapkan() {
  const kolom = rmKolomFile();
  $('rmInfoFile').innerHTML = kolom.length
    ? '<i class="bi bi-file-earmark-excel me-1"></i>Kolom dari file <b>' + esc(state.file.nama) + '</b> (sheet ' + esc(state.file.sheet.nama) + ') ikut dipakai untuk mengisi rumus.'
    : '<i class="bi bi-info-circle me-1"></i>Tip: buka file di menu <a href="#" onclick="navigateTo(\'analisis\');return false;">Analisis Baru</a> terlebih dulu agar nama kolom Anda otomatis dipakai di rumus.';
  if (!$('rmKamusList').dataset.siap) { rmRenderKamus(); $('rmKamusList').dataset.siap = '1'; }
  if (rm.dipilih) rmRenderPerakit(rm.dipilih.r, rm.dipilih.deskripsi, true);
}

function rmContoh(teks) { $('rmDeskripsi').value = teks; rmCari(); }

function rmCari() {
  const desk = $('rmDeskripsi').value.trim();
  const wadah = $('rmSaran');
  if (desk.length < 3) { showToast('warning', 'Deskripsi terlalu pendek', 'Ceritakan apa yang ingin dihitung, misalnya "jumlahkan penjualan wilayah Jawa".'); return; }
  rm.terakhirCari = desk;
  const hasil = rmCocokkan(desk);
  rm.saranTerakhir = hasil;
  const low = desk.toLowerCase();
  let catatan = '';
  if (/\b(per|setiap|tiap|masing[- ]masing)\b/.test(low)) {
    catatan = '<div class="rm-catatan"><i class="bi bi-lightbulb"></i><div>Ingin rekap untuk <b>semua kelompok sekaligus</b> (lengkap dengan tabel & grafik)? Pakai menu <a href="#" onclick="navigateTo(\'analisis\');return false;">Analisis Baru</a> → <b>Rekap per Kelompok</b>. Rumus di bawah menghitung satu kelompok per sel.</div></div>';
  }
  if (!hasil.length) {
    wadah.innerHTML = catatan + '<div class="glass card-glass text-center py-4"><i class="bi bi-emoji-neutral fs-2 text-muted-2"></i><p class="mt-2 mb-1 fw-medium">Belum menemukan rumus yang cocok.</p>' +
      '<p class="small text-muted-2 mb-0">Coba pakai kata kerja yang jelas: <i>jumlahkan, hitung, rata-rata, cari, gabungkan, selisih tanggal</i>, atau telusuri <a href="#" onclick="document.getElementById(\'rmKamusCari\').focus();return false;">Kamus Rumus</a> di bawah.</p></div>';
    return;
  }
  wadah.innerHTML = catatan + '<h6 class="fw-semibold mb-2 mt-1">Rumus yang paling cocok</h6><div class="row g-3">' + hasil.map((h, n) => {
    const r = h.x.r;
    const isi = rmIsiOtomatis(r, desk);
    const jadi = rmSusun(r, isi.nilai).rumus;
    return '<div class="col-md-6 col-xl-4"><div class="glass rm-saran' + (n === 0 ? ' terbaik' : '') + '">' +
      '<div class="d-flex justify-content-between align-items-start gap-2 mb-1"><div class="fw-semibold">' + (n === 0 ? '<i class="bi bi-star-fill text-warning me-1"></i>' : '') + esc(r.f) + '</div>' + rmLencana(r) + '</div>' +
      '<p class="small text-muted-2 mb-2">' + esc(r.d) + '</p>' +
      '<code class="rm-mini">' + esc(jadi) + '</code>' +
      (h.alasan.length ? '<div class="small text-muted-2 mt-2"><i class="bi bi-check2-circle me-1"></i>Cocok dengan: ' + h.alasan.slice(0, 3).map(a => '<i>' + esc(a) + '</i>').join(', ') + '</div>' : '') +
      '<button class="btn btn-glass-primary btn-sm w-100 mt-3" onclick="rmPilihSaran(' + n + ')"><i class="bi bi-tools me-1"></i> Pakai & Sesuaikan</button>' +
      '</div></div>';
  }).join('') + '</div>';
  rmRenderPerakit(hasil[0].x.r, desk);
}

function rmLencana(r) {
  const kat = RUMUS_KATEGORI[r.k];
  return '<div class="d-flex flex-wrap gap-1 justify-content-end">' +
    (r.k === 'resep' ? '<span class="badge-pill badge-o">Resep</span>' : '') +
    (r.v ? '<span class="badge-pill badge-b">' + esc(r.v) + '</span>' : (r.k !== 'resep' && kat ? '<span class="badge-pill badge-n">' + esc(kat.nama.split(' ')[0]) + '</span>' : '')) + '</div>';
}

function rmPilihSaran(n) {
  const h = rm.saranTerakhir[n];
  if (!h) return;
  rmRenderPerakit(h.x.r, rm.terakhirCari);
  $('rmPerakit').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function rmPilihKamus(i) {
  rmRenderPerakit(RUMUS_DATA[i], '');
  $('rmPerakit').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Kartu perakit: isi argumen → rumus jadi yang siap disalin */
function rmRenderPerakit(r, deskripsi, pertahankan) {
  const args = r.a.map(rmArg);
  let nilai, terisi = [];
  if (pertahankan && rm.dipilih && rm.dipilih.r === r) {
    nilai = args.map((_, i) => { const el = $('rmArg' + i); return el ? el.value : ''; });
  } else {
    const o = rmIsiOtomatis(r, deskripsi);
    nilai = o.nilai; terisi = o.terisi;
  }
  rm.dipilih = { r, deskripsi };
  rm.nilaiAwal = args.map(a => ubahPemisah(a.contoh, state.pemisah));
  const kolom = rmKolomFile();
  const kat = RUMUS_KATEGORI[r.k] || { nama: '', ikon: 'bi-calculator' };

  const input = args.length ? args.map((a, i) => {
    const pakaiKolom = kolom.length && (a.t === 'r' || (a.t === 'n' && a.peran));
    const absolut = /\$/.test(a.contoh) || /\$/.test(a.label);
    const pilihKolom = pakaiKolom
      ? '<select class="form-select select-glass rm-kolom" title="Ambil dari kolom file" onchange="rmPakaiKolom(' + i + ',this)">' +
        '<option value="">Kolom…</option>' + kolom.map(c => '<option value="' + esc(a.t === 'r' ? (absolut ? c.rentangAbs : c.rentang) : (absolut ? c.selAbs : c.sel)) + '">' + esc(c.huruf + ' · ' + c.nama) + '</option>').join('') + '</select>'
      : '';
    return '<div class="col-md-6"><label class="form-label small fw-medium" for="rmArg' + i + '">' + esc(a.label) +
      (a.opsional ? ' <span class="text-muted-2 fw-normal">(opsional)</span>' : '') +
      (terisi.indexOf(i) >= 0 ? ' <span class="badge-pill badge-g ms-1"><i class="bi bi-magic"></i> dari deskripsi</span>' : '') + '</label>' +
      '<div class="d-flex gap-2"><input type="text" class="form-control input-pill font-mono rm-input" id="rmArg' + i + '" value="' + esc(nilai[i]) + '" placeholder="' + esc(a.contoh !== '' ? ubahPemisah(a.contoh, state.pemisah) : (a.opsional ? 'boleh dikosongkan' : '')) + '" oninput="rmPerbarui()">' + pilihKolom + '</div>' +
      '<div class="form-text">' + rmPetunjukTipe(a) + '</div></div>';
  }).join('') : '<div class="col-12"><p class="small text-muted-2 mb-0">Rumus ini tidak memerlukan isian.</p></div>';

  $('rmPerakit').innerHTML = '<div class="glass card-glass">' +
    '<div class="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">' +
      '<div><div class="small text-muted-2"><i class="bi ' + kat.ikon + ' me-1"></i>' + esc(kat.nama) + '</div><h5 class="fw-semibold mb-1">' + esc(r.f) + '</h5><p class="text-muted-2 mb-0">' + esc(r.d) + '</p></div>' +
      '<div class="d-flex align-items-center gap-2">' + (r.v ? '<span class="badge-pill badge-b"><i class="bi bi-info-circle"></i> Perlu ' + esc(r.v) + '</span>' : '<span class="badge-pill badge-g"><i class="bi bi-check2"></i> Semua versi Excel</span>') +
      '<select class="form-select select-glass pemisah-select" style="width:auto" onchange="setPemisah(this.value)" title="Pemisah rumus"><option value=";">Pemisah ;</option><option value=",">Pemisah ,</option></select></div>' +
    '</div>' +
    '<div class="row g-3 mt-1">' + input + '</div>' +
    '<label class="form-label small fw-medium mt-4 mb-1">Rumus jadi</label>' +
    '<div class="rm-hasil"><code id="rmHasilRumus"></code><button type="button" class="btn btn-glass-primary btn-sm" id="rmBtnSalin" onclick="rmSalin(this)"><i class="bi bi-copy me-1"></i> Salin</button></div>' +
    '<div id="rmKurang" class="small mt-2"></div>' +
    '<details class="rm-langkah mt-3"><summary>Cara memakai di Excel</summary><ol class="small mb-0 mt-2">' +
      '<li>Klik sel kosong tempat hasil ingin ditampilkan.</li><li>Tempel rumus (Ctrl+V) lalu tekan Enter.</li>' +
      '<li>Sesuaikan alamat kolom/baris bila data Anda berbeda. Tanda <code>$</code> mengunci alamat agar tidak bergeser saat rumus disalin ke bawah.</li>' +
      '<li>Excel berbahasa Indonesia biasanya memakai pemisah <b>titik koma (;)</b>; Excel berbahasa Inggris memakai <b>koma (,)</b>.</li>' +
      '<li>Contoh asli: <code>' + esc(ubahPemisah(r.e, state.pemisah)) + '</code></li></ol></details>' +
    '</div>';
  syncPemisahSelect();
  rmPerbarui();
}

function rmPetunjukTipe(a) {
  return { r: 'Rentang, mis. B2:B100 atau Sheet2!A:A', k: 'Teks biasa otomatis diberi tanda kutip; boleh angka, >100, atau alamat sel', s: 'Teks otomatis diberi tanda kutip; boleh juga alamat sel', n: 'Angka, alamat sel, atau rumus', x: 'Tulis apa adanya, mis. C2>=75' }[a.t] || '';
}

function rmPakaiKolom(i, sel) {
  if (!sel.value) return;
  $('rmArg' + i).value = sel.value;
  sel.value = '';
  rmPerbarui();
}

function rmPerbarui() {
  if (!rm.dipilih) return;
  const r = rm.dipilih.r;
  const nilai = r.a.map((_, i) => { const el = $('rmArg' + i); return el ? el.value : ''; });
  const h = rmSusun(r, nilai);
  $('rmHasilRumus').textContent = h.rumus;
  $('rmKurang').innerHTML = h.kurang.length ? '<span class="text-danger-2"><i class="bi bi-exclamation-circle me-1"></i>Belum diisi: ' + h.kurang.map(esc).join(', ') + ' (ditandai ? di rumus)</span>' : '';
}

function rmSalin(btn) {
  const teks = $('rmHasilRumus').textContent;
  salinTeks(teks);
  btn.innerHTML = '<i class="bi bi-check2 me-1"></i> Tersalin';
  setTimeout(() => { btn.innerHTML = '<i class="bi bi-copy me-1"></i> Salin'; }, 1400);
}

/** Saat pemisah diganti: isian yang belum diubah pengguna ikut menyesuaikan */
function rmPemisahBerubah() {
  if (!rm.dipilih || !$('rmHasilRumus')) return;
  const r = rm.dipilih.r;
  const baru = r.a.map(s => ubahPemisah(rmArg(s).contoh, state.pemisah));
  r.a.forEach((_, i) => {
    const el = $('rmArg' + i);
    if (!el) return;
    if (el.value === rm.nilaiAwal[i]) el.value = baru[i];
    if (baru[i] !== '') el.placeholder = baru[i];
  });
  rm.nilaiAwal = baru;
  rmPerbarui();
}

// ── Kamus rumus ──
function rmRenderKamus() {
  const q = $('rmKamusCari').value.trim().toLowerCase();
  const kat = $('rmKamusKat').value;
  const kata = q.split(/\s+/).filter(Boolean);
  const daftar = rmIndeks().filter(x => (!kat || x.r.k === kat) && kata.every(k => x.teksCari.indexOf(k) >= 0));
  $('rmKamusJumlah').textContent = daftar.length + ' dari ' + RUMUS_DATA.length + ' rumus';
  if (!daftar.length) { $('rmKamusList').innerHTML = '<p class="text-muted-2 small mb-0">Tidak ada rumus yang cocok dengan pencarian.</p>'; return; }
  const urutKat = Object.keys(RUMUS_KATEGORI);
  const grup = {};
  daftar.forEach(x => { (grup[x.r.k] = grup[x.r.k] || []).push(x); });
  $('rmKamusList').innerHTML = urutKat.filter(k => grup[k]).map(k =>
    '<h6 class="rm-kat"><i class="bi ' + RUMUS_KATEGORI[k].ikon + ' me-2"></i>' + esc(RUMUS_KATEGORI[k].nama) + ' <span class="text-muted-2 fw-normal small">(' + grup[k].length + ')</span></h6>' +
    '<div class="row g-2 mb-3">' + grup[k].map(x =>
      '<div class="col-md-6 col-xl-4"><div class="rm-item">' +
        '<div class="d-flex justify-content-between align-items-start gap-2"><span class="fw-semibold">' + esc(x.r.f) + '</span>' + (x.r.v ? '<span class="badge-pill badge-b">' + esc(x.r.v) + '</span>' : '') + '</div>' +
        '<div class="small text-muted-2 my-1">' + esc(x.r.d) + '</div>' +
        '<div class="formula"><span>' + esc(ubahPemisah(x.r.e)) + '</span><button type="button" class="btn-salin" data-r="' + encodeURIComponent(x.r.e) + '" title="Salin contoh" aria-label="Salin contoh"><i class="bi bi-copy"></i></button></div>' +
        '<button class="btn btn-glass btn-sm mt-2" onclick="rmPilihKamus(' + x.i + ')"><i class="bi bi-tools me-1"></i> Rakit</button>' +
      '</div></div>').join('') + '</div>'
  ).join('');
}
