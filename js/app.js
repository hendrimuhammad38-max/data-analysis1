/**
 * ============================================================
 * DATA ANALYSIS — Frontend JavaScript (SPA)
 * Library: Bootstrap 5, Chart.js 4, SheetJS (membaca & menulis Excel)
 * Dihosting di GitHub Pages. Semua komunikasi server lewat fetch() ke
 * Google Apps Script REST API (alamat di js/config.js → GAS_URL).
 * ============================================================
 */

// ════════════════════════════════════════════════════════
// BAGIAN 1: STATE, PENYIMPANAN LOKAL, HELPER
// ════════════════════════════════════════════════════════
const state = {
  token: null, user: null, pengaturan: {}, jenis: [], labelKebutuhan: {},
  pemisah: ';', file: null, jenisDipilih: null, hasilBaru: null, hasilBaruMeta: null,
  riwayat: [], detail: null, editMode: false, editHasil: null,
  adminJenis: [], mesin: null, pengguna: [], log: { EMAIL: [], AKTIVITAS: [] }, dashboard: null,
  charts: {}, section: 'beranda'
};

const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} }
};

const $ = id => document.getElementById(id);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const PALET = ['#F04E23', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#64748B', '#EC4899', '#14B8A6', '#EAB308', '#6366F1'];
const NAMA_GRAFIK = { BAR: 'Batang', BAR_H: 'Batang mendatar', LINE: 'Garis', PIE: 'Pai', DOUGHNUT: 'Donat' };
const NAMA_MESIN = { STAT_DESKRIPTIF: 'Ringkasan Angka', REKAP_KATEGORI: 'Rekap per Kelompok', TREN_WAKTU: 'Perkembangan per Waktu', PROPORSI: 'Persentase / Porsi', PERINGKAT: 'Peringkat' };
const IKON = ['bi-calculator', 'bi-grid-3x3-gap', 'bi-graph-up-arrow', 'bi-pie-chart', 'bi-trophy', 'bi-bar-chart', 'bi-bar-chart-line', 'bi-clipboard-data', 'bi-cash-coin', 'bi-people', 'bi-box-seam', 'bi-calendar3', 'bi-percent', 'bi-sort-down', 'bi-funnel', 'bi-lightning'];

function fmtAngka(n, desimal) {
  if (n === null || n === undefined || n === '' || !isFinite(n)) return '-';
  const d = desimal !== undefined ? desimal : (Number.isInteger(Number(n)) ? 0 : 2);
  return Number(n).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: d });
}
function fmtSel(s) {
  if (!s || s.nilai === null || s.nilai === undefined || s.nilai === '') return '-';
  if (s.format === 'teks') return String(s.nilai);
  if (s.format === 'persen') return fmtAngka(Number(s.nilai) * 100, 1) + '%';
  if (s.format === 'bulat') return fmtAngka(Number(s.nilai), 0);
  return fmtAngka(Number(s.nilai));
}
function fmtTgl(iso, pakaiJam) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return '-';
  const t = d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  return pakaiJam === false ? t : t + ', ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}
/** Mengubah teks angka gaya Indonesia/Inggris menjadi Number (cermin keAngka_ di server) */
function parseAngka(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[^\d,.\-]/g, '');
  if (!s || s === '-') return null;
  const koma = s.lastIndexOf(','), titik = s.lastIndexOf('.');
  if (koma > -1 && titik > -1) s = koma > titik ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (koma > -1) s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) ? n : null;
}
/** Ganti pemisah argumen "," → ";" di luar tanda kutip */
function ubahPemisah(rumus, sep) {
  if ((sep || state.pemisah) !== ';') return rumus || '';
  let out = '', q = false;
  for (const ch of String(rumus || '')) { if (ch === '"') q = !q; out += (!q && ch === ',') ? ';' : ch; }
  return out;
}
function salinTeks(teks, btn) {
  const selesai = () => {
    if (btn) { btn.classList.add('ok'); btn.innerHTML = '<i class="bi bi-check2"></i>'; setTimeout(() => { btn.classList.remove('ok'); btn.innerHTML = '<i class="bi bi-copy"></i>'; }, 1400); }
    else showToast('success', 'Tersalin', 'Teks sudah disalin.');
  };
  const cadangan = () => {
    const ta = document.createElement('textarea');
    ta.value = teks; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); selesai(); } catch (e) { showToast('warning', 'Gagal menyalin', 'Silakan salin manual: ' + teks); }
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(teks).then(selesai).catch(cadangan);
  else cadangan();
}
const clone = o => JSON.parse(JSON.stringify(o));
const hurufKolom = i => XLSX.utils.encode_col(i);

// ════════════════════════════════════════════════════════
// BAGIAN 2: API, LOADING, TOAST, KONFIRMASI
// ════════════════════════════════════════════════════════
let _aktif = 0;
function progress(on) {
  const bar = $('topProgress');
  _aktif = Math.max(0, _aktif + (on ? 1 : -1));
  if (_aktif > 0) { bar.classList.remove('done'); void bar.offsetWidth; bar.classList.add('on'); }
  else { bar.classList.remove('on'); bar.classList.add('done'); }
}

/** URL backend sudah diisi di js/config.js? */
function backendSiap() {
  return typeof GAS_URL === 'string' && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(GAS_URL.trim()) && !/GANTI|XXXX/.test(GAS_URL);
}

/**
 * Panggil backend GAS (REST API) → Promise berisi respons lengkap {success, data, message}.
 * POST dengan Content-Type text/plain agar tidak memicu CORS preflight (diblokir GAS).
 * Token sesi dikirim di body sebagai argumen pertama — tidak pernah di URL.
 */
function panggil(fn, args) {
  if (!backendSiap()) return Promise.reject(new Error('Konfigurasi belum lengkap: isi GAS_URL di file js/config.js dengan URL /exec dari Apps Script.'));
  progress(true);
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const batasWaktu = setTimeout(() => ctrl && ctrl.abort(), 330000); // ±5,5 menit (batas eksekusi GAS 6 menit)
  return fetch(GAS_URL.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: fn, args: args || [] }),
    redirect: 'follow',
    signal: ctrl ? ctrl.signal : undefined
  }).then(r => r.text()).then(teks => {
    let res;
    try { res = JSON.parse(teks); }
    catch (e) { throw new Error('Backend tidak mengembalikan JSON. Pastikan Web App di-deploy dengan akses "Siapa saja" dan URL /exec di js/config.js benar.'); }
    if (!res) throw new Error('Server tidak memberi jawaban. Coba lagi.');
    if (res.code === 'SESI_HABIS') { sesiHabis(res.message); throw new Error(res.message); }
    if (!res.success) throw new Error(res.message || 'Terjadi kesalahan.');
    return res;
  }).catch(err => {
    if (err && err.name === 'AbortError') throw new Error('Server terlalu lama merespons. Coba lagi dengan data yang lebih sedikit.');
    if (err instanceof TypeError) throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.');
    throw err;
  }).finally(() => { clearTimeout(batasWaktu); progress(false); });
}
/** Ambil data saja */
function api(fn, ...args) { return panggil(fn, args).then(r => r.data === undefined ? null : r.data); }
/** Ambil data + pesan server */
function apiPesan(fn, ...args) { return panggil(fn, args).then(r => ({ data: r.data, message: r.message })); }

function setBusy(btn, busy, teks) {
  if (!btn) return;
  if (busy) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner-inline me-2"></span>' + (teks || 'Memproses...'); }
  else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}

function showToast(tipe, judul, pesan, lama) {
  const ikon = { success: 'bi-check-circle-fill', warning: 'bi-exclamation-triangle-fill', danger: 'bi-x-circle-fill', info: 'bi-info-circle-fill' }[tipe] || 'bi-info-circle-fill';
  const el = document.createElement('div');
  el.className = 'toast-glass ' + tipe;
  el.setAttribute('role', 'status');
  el.innerHTML = '<i class="bi ' + ikon + ' ticon"></i><div class="tbody"><b>' + esc(judul) + '</b>' + esc(pesan || '') + '</div><button class="btn-icon-plain" aria-label="Tutup"><i class="bi bi-x-lg"></i></button>';
  const tutup = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  el.querySelector('button').onclick = tutup;
  $('toastContainer').appendChild(el);
  setTimeout(tutup, lama || (tipe === 'danger' ? 7000 : 4500));
}
const toastError = e => showToast('danger', 'Terjadi kesalahan', e && e.message ? e.message : String(e));

function konfirmasi(judul, pesan, labelYa, kelas) {
  return new Promise(resolve => {
    $('konfirmasiJudul').textContent = judul;
    $('konfirmasiPesan').textContent = pesan;
    const btn = $('konfirmasiBtn');
    btn.textContent = labelYa || 'Ya, lanjutkan';
    btn.className = 'btn ' + (kelas || 'btn-glass-danger');
    const modal = bootstrap.Modal.getOrCreateInstance($('modalKonfirmasi'));
    let jawab = false;
    btn.onclick = () => { jawab = true; modal.hide(); };
    $('modalKonfirmasi').addEventListener('hidden.bs.modal', () => resolve(jawab), { once: true });
    modal.show();
  });
}
const modal = id => bootstrap.Modal.getOrCreateInstance($(id));

// ════════════════════════════════════════════════════════
// BAGIAN 3: INISIALISASI, LOGIN, NAVIGASI
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  const tema = store.get('da_tema') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  terapkanTema(tema);
  state.pemisah = store.get('da_pemisah') || ';';
  bindEvents();
  state.token = store.get('da_token');

  if (!backendSiap()) {
    tampilLogin();
    $('loginError').innerHTML = '<b>Konfigurasi belum lengkap.</b> Buka file <code>js/config.js</code>, isi <code>GAS_URL</code> dengan URL <code>/exec</code> dari Apps Script, lalu upload ulang ke GitHub.';
    $('loginError').classList.remove('d-none');
    $('loginBtn').disabled = true;
    return;
  }

  api('apiPublik').then(p => {
    terapkanBranding(p);
    if (!p.siap) { tampilLogin(); $('loginError').textContent = 'Aplikasi belum di-setup. Admin perlu menjalankan fungsi setupAppEnvironment() di editor Apps Script.'; $('loginError').classList.remove('d-none'); return; }
    if (state.token) masukAplikasi(); else tampilLogin();
  }).catch(e => { tampilLogin(); toastError(e); });
}

function sembunyikanLoading() { const o = $('loadingOverlay'); o.classList.add('hide'); setTimeout(() => o.style.display = 'none', 320); }
function tampilLoading(teks) { const o = $('loadingOverlay'); $('loadingText').textContent = teks || 'Memuat...'; o.style.display = 'flex'; o.classList.remove('hide'); }

function tampilLogin() {
  $('appShell').classList.add('d-none');
  $('loginScreen').classList.remove('d-none');
  sembunyikanLoading();
  setTimeout(() => $('loginEmail').focus(), 100);
}

function terapkanBranding(p) {
  const nama = p.namaAplikasi || 'Data Analysis';
  document.title = nama;
  $('loginAppName').textContent = nama;
  $('appTitle').textContent = nama;
  const logo = p.logoUrl ? '<img src="' + esc(p.logoUrl) + '" alt="Logo" onerror="this.parentNode.innerHTML=\'<i class=&quot;bi bi-bar-chart-line&quot;></i>\'">' : '<i class="bi bi-bar-chart-line"></i>';
  $('loginLogo').innerHTML = logo;
  $('appLogo').innerHTML = logo;
}

function login(ev) {
  ev.preventDefault();
  const email = $('loginEmail').value.trim(), sandi = $('loginSandi').value;
  const err = $('loginError');
  err.classList.add('d-none');
  if (!email || !sandi || !$('loginEmail').checkValidity()) { err.textContent = 'Masukkan email yang valid dan sandi Anda.'; err.classList.remove('d-none'); return; }
  const btn = $('loginBtn');
  setBusy(btn, true, 'Memeriksa...');
  api('apiLogin', email, sandi).then(d => {
    state.token = d.token; store.set('da_token', d.token);
    $('loginSandi').value = '';
    masukAplikasi(true);
  }).catch(e => { err.textContent = e.message; err.classList.remove('d-none'); })
    .finally(() => setBusy(btn, false));
}

function masukAplikasi(baruLogin) {
  tampilLoading('Menyiapkan aplikasi...');
  api('apiInit', state.token).then(d => {
    state.user = d.user; state.pengaturan = d.pengaturan; state.jenis = d.jenis; state.labelKebutuhan = d.labelKebutuhan;
    if (!store.get('da_pemisah')) state.pemisah = d.pengaturan.pemisahDefault || ';';
    syncPemisahSelect();
    terapkanBranding(d.pengaturan);
    document.body.classList.toggle('is-admin', d.user.peran === 'ADMIN');
    $('sidebarUser').textContent = d.user.nama + ' · ' + (d.user.peran === 'ADMIN' ? 'Admin' : 'Pengguna');
    $('navRiwayatLabel').textContent = d.user.peran === 'ADMIN' ? 'Semua Hasil' : 'Riwayat';
    $('batasFileInfo').textContent = 'Format .xlsx, .xls, .csv · maks. ' + d.pengaturan.maksUkuranMB + ' MB · maks. ' + Number(d.pengaturan.maksBaris).toLocaleString('id-ID') + ' baris';
    $('loginScreen').classList.add('d-none');
    $('appShell').classList.remove('d-none');
    sembunyikanLoading();
    navigateTo('beranda');
    if (baruLogin) showToast('success', 'Berhasil masuk', 'Selamat datang, ' + d.user.nama + '!');
    if (d.user.wajibGantiSandi) modal('modalWajibSandi').show();
  }).catch(e => { if (!/Sesi/.test(e.message)) toastError(e); tampilLogin(); });
}

function sesiHabis(pesan) {
  store.del('da_token'); state.token = null; state.user = null;
  document.querySelectorAll('.modal.show').forEach(m => bootstrap.Modal.getInstance(m) && bootstrap.Modal.getInstance(m).hide());
  tampilLogin();
  showToast('warning', 'Sesi berakhir', pesan || 'Silakan masuk kembali.');
}

function logout() {
  const t = state.token;
  store.del('da_token'); state.token = null;
  document.querySelectorAll('.modal.show').forEach(m => bootstrap.Modal.getInstance(m) && bootstrap.Modal.getInstance(m).hide());
  if (t) panggil('apiLogout', [t]).catch(() => {});
  resetWizard(true);
  tampilLogin();
  showToast('info', 'Sampai jumpa', 'Anda telah keluar.');
}

const JUDUL_SECTION = { beranda: 'Beranda', analisis: 'Analisis Baru', riwayat: 'Riwayat', detail: 'Detail Hasil', profil: 'Profil Saya', jenis: 'Jenis Analisis', pengguna: 'Pengguna', pengaturan: 'Pengaturan' };

function navigateTo(section, opsi) {
  const adminSaja = ['jenis', 'pengguna', 'pengaturan'];
  if (adminSaja.indexOf(section) >= 0 && (!state.user || state.user.peran !== 'ADMIN')) section = 'beranda';
  if (state.section === 'detail' && section !== 'detail' && state.editMode) { state.editMode = false; }
  state.section = section;
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  $('section-' + section).classList.add('active');
  document.querySelectorAll('.sidebar [data-section]').forEach(a => a.classList.toggle('active', a.dataset.section === section || (section === 'detail' && a.dataset.section === 'riwayat')));
  $('pageTitle').textContent = JUDUL_SECTION[section] || '';
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (opsi && opsi.tanpaMuat) return;
  if (section === 'beranda') loadDashboard();
  if (section === 'analisis') siapkanWizard();
  if (section === 'riwayat') loadRiwayat();
  if (section === 'profil') renderProfil();
  if (section === 'jenis') loadJenisAdmin();
  if (section === 'pengguna') loadPengguna();
  if (section === 'pengaturan') loadPengaturan();
}

function openSidebar() { $('sidebar').classList.add('show'); $('sidebarOverlay').classList.add('show'); }
function closeSidebar() { $('sidebar').classList.remove('show'); $('sidebarOverlay').classList.remove('show'); }

function toggleLihatSandi(id, btn) {
  const el = $(id);
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.innerHTML = el.type === 'password' ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
}

function bindEvents() {
  $('loginForm').addEventListener('submit', login);
  document.querySelectorAll('.sidebar [data-section]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigateTo(a.dataset.section); }));

  // Tab pill generik (juga untuk tab yang dibuat dinamis)
  document.addEventListener('click', e => {
    const tab = e.target.closest('.tab-pill');
    if (!tab || !tab.dataset.tab) return;
    tab.parentNode.querySelectorAll('.tab-pill').forEach(t => t.classList.toggle('active', t === tab));
    const panel = $(tab.dataset.tab);
    if (!panel) return;
    panel.parentNode.querySelectorAll(':scope > .tab-panel').forEach(p => p.classList.toggle('active', p === panel));
    if (tab.dataset.tab === 'tabLogEmail') loadLog('EMAIL');
    if (tab.dataset.tab === 'tabLogAktivitas') loadLog('AKTIVITAS');
    if (panel.dataset.onshow && window[panel.dataset.onshow]) window[panel.dataset.onshow](panel);
  });

  // Tombol salin rumus (delegasi)
  document.addEventListener('click', e => {
    const b = e.target.closest('.btn-salin');
    if (!b) return;
    salinTeks(ubahPemisah(decodeURIComponent(b.dataset.r)), b);
  });

  // Unggah file
  const dz = $('dropZone'), fi = $('fileInput');
  dz.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') fi.click(); });
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => { if (e.dataTransfer.files[0]) bacaFile(e.dataTransfer.files[0]); });
  fi.addEventListener('change', () => { if (fi.files[0]) bacaFile(fi.files[0]); fi.value = ''; });
  $('sheetSelect').addEventListener('change', e => pilihSheet(e.target.value));

  // Filter
  ['riwayatCari', 'riwayatJenis', 'riwayatPengguna', 'riwayatDari', 'riwayatSampai'].forEach(id => $(id).addEventListener('input', renderRiwayat));
  $('jenisCari').addEventListener('input', renderJenisTable);
  $('penggunaCari').addEventListener('input', renderPengguna);
  ['logEmailCari', 'logEmailStatus'].forEach(id => $(id).addEventListener('input', () => renderLog('EMAIL')));
  $('logAktCari').addEventListener('input', () => renderLog('AKTIVITAS'));

  // Form
  $('formGantiSandi').addEventListener('submit', gantiSandi);
  $('formPengaturan').addEventListener('submit', simpanPengaturan);
  $('jenisMesin').addEventListener('change', () => gantiMesinJenis(true));
  $('editGrafik').addEventListener('change', e => { if (state.editHasil) { state.editHasil.grafik.tipe = e.target.value; renderGrafikHasil('detail', state.editHasil); } });
}

// ════════════════════════════════════════════════════════
// BAGIAN 4: TEMA (MODE GELAP) & GRAFIK
// ════════════════════════════════════════════════════════
function terapkanTema(t) {
  document.documentElement.setAttribute('data-theme', t);
  const tg = $('darkModeToggle'); if (tg) tg.checked = t === 'dark';
  if (window.Chart) {
    const gelap = t === 'dark';
    Chart.defaults.color = gelap ? '#94A3B8' : '#64748B';
    Chart.defaults.borderColor = gelap ? 'rgba(148,163,184,.14)' : 'rgba(15,23,42,.07)';
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  }
}
function toggleDarkMode() {
  const baru = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  terapkanTema(baru);
  store.set('da_tema', baru);
  Object.keys(state.charts).forEach(id => { const c = state.charts[id]; if (c && c.ulang && document.getElementById(id)) c.ulang(); });
}

/** Buat/ulang grafik pada canvas tertentu. cfgFn mengembalikan konfigurasi Chart.js. */
function makeChart(canvasId, cfgFn) {
  const el = $(canvasId);
  if (!el || !window.Chart) return;
  if (state.charts[canvasId] && state.charts[canvasId].chart) state.charts[canvasId].chart.destroy();
  const chart = new Chart(el, cfgFn());
  state.charts[canvasId] = { chart: chart, ulang: () => makeChart(canvasId, cfgFn) };
}

function opsiDasar(tambahan) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8, padding: 14 } },
      tooltip: { backgroundColor: 'rgba(15,23,42,.88)', padding: 10, cornerRadius: 12, titleFont: { weight: '600' } } }
  }, tambahan || {});
}

/** Susun konfigurasi grafik dari struktur hasil analisis */
function configGrafikHasil(hasil, tipe) {
  tipe = tipe || hasil.grafik.tipe || 'BAR';
  const mk = hasil.grafik.metrik;
  const kol = hasil.kolomMetrik.find(k => k.key === mk) || hasil.kolomMetrik[0];
  const persen = kol && kol.format === 'persen';
  let rows = hasil.baris.filter(b => b.grafik !== false && b.sel[mk] && b.sel[mk].nilai !== null && b.sel[mk].nilai !== '');
  const labelOf = b => hasil.grafik.metrikLabel && b.sel[hasil.grafik.metrikLabel] ? b.label + ' ' + b.sel[hasil.grafik.metrikLabel].nilai : b.label;
  let labels = rows.map(labelOf), data = rows.map(b => Number(b.sel[mk].nilai) * (persen ? 100 : 1));
  const bundar = tipe === 'PIE' || tipe === 'DOUGHNUT';
  if (bundar && labels.length > 10) {
    const sisa = data.slice(9).reduce((a, b) => a + b, 0);
    labels = labels.slice(0, 9).concat('Lainnya'); data = data.slice(0, 9).concat(sisa);
  } else if (!bundar && tipe !== 'LINE' && labels.length > 30) { labels = labels.slice(0, 30); data = data.slice(0, 30); }
  const fmtTip = v => persen ? fmtAngka(v, 1) + '%' : fmtAngka(v);
  const label = (kol ? kol.label : 'Nilai') + (persen ? ' (%)' : '');
  if (bundar) {
    return { type: tipe === 'PIE' ? 'pie' : 'doughnut',
      data: { labels, datasets: [{ label, data, backgroundColor: labels.map((_, i) => PALET[i % PALET.length] + 'D9'), borderColor: 'rgba(255,255,255,.7)', borderWidth: 2, hoverOffset: 8 }] },
      options: opsiDasar({ cutout: tipe === 'DOUGHNUT' ? '62%' : 0, plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: c => ' ' + c.label + ': ' + fmtTip(c.raw) } } } }) };
  }
  const garis = tipe === 'LINE', hor = tipe === 'BAR_H';
  return { type: garis ? 'line' : 'bar',
    data: { labels, datasets: [{ label, data,
      backgroundColor: garis ? 'rgba(240,78,35,.12)' : labels.map((_, i) => PALET[i % PALET.length] + 'CC'),
      borderColor: garis ? '#F04E23' : labels.map((_, i) => PALET[i % PALET.length]),
      borderWidth: garis ? 2.5 : 0, borderRadius: 10, borderSkipped: false, fill: garis, tension: .35, pointRadius: garis ? 3.5 : 0, pointBackgroundColor: '#F04E23', maxBarThickness: 46 }] },
    options: opsiDasar({ indexAxis: hor ? 'y' : 'x',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmtTip(c.raw) } } },
      scales: { [hor ? 'x' : 'y']: { beginAtZero: true, ticks: { callback: v => persen ? v + '%' : fmtAngka(v, 1) } }, [hor ? 'y' : 'x']: { grid: { display: false }, ticks: { autoSkip: true, maxRotation: 45 } } } }) };
}

// ════════════════════════════════════════════════════════
// BAGIAN 5: BERANDA / DASHBOARD
// ════════════════════════════════════════════════════════
function loadDashboard() {
  const jam = new Date().getHours();
  const salam = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam';
  $('sapaan').textContent = salam + ', ' + (state.user ? state.user.nama.split(' ')[0] : '') + ' 👋';
  $('sapaanSub').textContent = state.user && state.user.peran === 'ADMIN' ? 'Ringkasan aktivitas seluruh pengguna aplikasi.' : 'Ringkasan aktivitas analisis data Anda.';
  $('kpiRow').innerHTML = [1, 2, 3, 4].map(() => '<div class="col-6 col-xl-3"><div class="glass stat-card"><div class="skeleton w-100" style="height:46px"></div></div></div>').join('');
  api('apiDashboard', state.token).then(d => { state.dashboard = d; renderDashboard(d); }).catch(toastError);
}

function renderDashboard(d) {
  const k = d.kpi;
  const kartu = [
    ['o', 'bi-clipboard-data', fmtAngka(k.totalAnalisis), 'Total analisis'],
    ['b', 'bi-calendar-check', fmtAngka(k.bulanIni), 'Analisis bulan ini'],
    ['g', 'bi-table', fmtAngka(k.totalBaris), 'Baris data diproses'],
    ['y', 'bi-envelope-check', fmtAngka(k.emailTerkirim) + (k.emailGagal ? ' <small class="text-danger-2 fs-6">/ ' + k.emailGagal + ' gagal</small>' : ''), 'Email terkirim']
  ];
  $('kpiRow').innerHTML = kartu.map(c => '<div class="col-6 col-xl-3"><div class="glass stat-card"><div class="stat-icon ' + c[0] + '"><i class="bi ' + c[1] + '"></i></div><div class="min-w-0"><div class="stat-value">' + c[2] + '</div><div class="stat-label">' + c[3] + '</div></div></div></div>').join('');
  $('insightList').innerHTML = d.insight.map(s => '<li>' + esc(s) + '</li>').join('');

  makeChart('chartMinggu', () => ({ type: 'bar',
    data: { labels: d.perMinggu.map(m => m.label), datasets: [{ label: 'Analisis', data: d.perMinggu.map(m => m.jumlah), backgroundColor: d.perMinggu.map((_, i) => i === 7 ? '#F04E23' : 'rgba(59,130,246,.55)'), borderRadius: 10, borderSkipped: false, maxBarThickness: 40 }] },
    options: opsiDasar({ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }) }));

  const jl = Object.keys(d.perJenis);
  makeChart('chartJenis', () => ({ type: 'doughnut',
    data: { labels: jl.length ? jl : ['Belum ada'], datasets: [{ data: jl.length ? jl.map(x => d.perJenis[x]) : [1], backgroundColor: jl.length ? jl.map((_, i) => PALET[i % PALET.length] + 'D9') : ['rgba(148,163,184,.3)'], borderColor: 'rgba(255,255,255,.7)', borderWidth: 2 }] },
    options: opsiDasar({ cutout: '64%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } } }) }));

  if (d.perPengguna) {
    const pl = Object.keys(d.perPengguna);
    makeChart('chartPengguna', () => ({ type: 'bar',
      data: { labels: pl, datasets: [{ label: 'Analisis', data: pl.map(x => d.perPengguna[x]), backgroundColor: pl.map((_, i) => PALET[(i + 1) % PALET.length] + 'CC'), borderRadius: 10, borderSkipped: false, maxBarThickness: 28 }] },
      options: opsiDasar({ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } } }) }));
  }
  $('terbaruList').innerHTML = d.terbaru.length ? d.terbaru.map(h =>
    '<div class="item" onclick="bukaDetail(\'' + h.id + '\')"><div class="item-icon"><i class="bi bi-file-earmark-bar-graph"></i></div>' +
    '<div class="min-w-0 flex-grow-1"><div class="fw-medium text-truncate">' + esc(h.judul) + '</div><div class="small text-muted-2 text-truncate">' + esc(h.namaJenis) + ' · ' + fmtTgl(h.diubahPada) + '</div></div><i class="bi bi-chevron-right text-muted-2"></i></div>'
  ).join('') : '<div class="empty-state py-4"><i class="bi bi-inbox"></i><p class="mb-0">Belum ada analisis.</p></div>';
}

// ════════════════════════════════════════════════════════
// BAGIAN 6: WIZARD — UNGGAH & BACA FILE EXCEL (di browser)
// ════════════════════════════════════════════════════════
function siapkanWizard() {
  renderJenisCards();
  if (!state.file) keLangkah(1, true);
}

function resetWizard(diam) {
  state.file = null; state.jenisDipilih = null; state.hasilBaru = null; state.hasilBaruMeta = null;
  $('fileInfo').classList.add('d-none'); $('dropZone').classList.remove('d-none');
  $('mappingCard').classList.add('d-none'); $('hasilBaruWrap').innerHTML = ''; $('catatanBaru').value = '';
  if (!diam) { renderJenisCards(); keLangkah(1, true); }
}

function bacaFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['xlsx', 'xls', 'csv'].indexOf(ext) < 0) return showToast('warning', 'Format tidak didukung', 'Gunakan file .xlsx, .xls, atau .csv.');
  const maksMB = Number(state.pengaturan.maksUkuranMB) || 5;
  if (file.size > maksMB * 1024 * 1024) return showToast('warning', 'File terlalu besar', 'Ukuran file ' + (file.size / 1048576).toFixed(1) + ' MB melebihi batas ' + maksMB + ' MB.');
  if (!window.XLSX) return showToast('danger', 'Pustaka belum termuat', 'Pembaca Excel gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.');
  tampilLoading('Membaca file "' + file.name + '"...');
  const baca = ext === 'csv' ? file.text().then(t => XLSX.read(t, { type: 'string', cellDates: true, raw: false })) : file.arrayBuffer().then(b => XLSX.read(b, { type: 'array', cellDates: true }));
  baca.then(wb => {
    if (!wb.SheetNames.length) throw new Error('File tidak memiliki sheet.');
    state.file = { nama: file.name, ukuran: file.size, wb: wb, sheetNames: wb.SheetNames, sheet: null };
    $('sheetSelect').innerHTML = wb.SheetNames.map(n => '<option>' + esc(n) + '</option>').join('');
    const pertamaBerisi = wb.SheetNames.find(n => wb.Sheets[n]['!ref']) || wb.SheetNames[0];
    $('sheetSelect').value = pertamaBerisi;
    pilihSheet(pertamaBerisi);
    $('dropZone').classList.add('d-none'); $('fileInfo').classList.remove('d-none');
    state.jenisDipilih = null; $('mappingCard').classList.add('d-none'); renderJenisCards();
  }).catch(e => { state.file = null; showToast('danger', 'File tidak bisa dibaca', e.message || 'File rusak atau dilindungi sandi.'); })
    .finally(sembunyikanLoading);
}

/** Baca satu sheet: temukan baris judul, kolom, dan deteksi jenis isi kolom */
function pilihSheet(nama) {
  const f = state.file, ws = f.wb.Sheets[nama];
  if (!ws || !ws['!ref']) {
    f.sheet = { nama, kolom: [], rows: [], barisAwal: 2 };
    renderKolomList(); $('fileMeta').textContent = 'Sheet "' + nama + '" kosong.';
    return;
  }
  const range = XLSX.utils.decode_range(ws['!ref']);
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  const isi = v => v !== null && v !== undefined && String(v).trim() !== '';
  let hi = aoa.findIndex(r => r && r.filter(isi).length >= Math.min(2, r.length));
  if (hi < 0) hi = 0;
  let rows = aoa.slice(hi + 1);
  while (rows.length && !(rows[rows.length - 1] || []).some(isi)) rows.pop();
  const header = aoa[hi] || [];
  const lebar = Math.max(header.length, ...rows.slice(0, 200).map(r => (r || []).length), 0);
  const dipakai = {};
  const kolom = [];
  for (let j = 0; j < lebar; j++) {
    const huruf = hurufKolom(range.s.c + j);
    let nm = isi(header[j]) ? String(header[j]).trim() : 'Kolom ' + huruf;
    if (dipakai[nm]) nm = nm + ' (' + huruf + ')';
    dipakai[nm] = 1;
    const nilai = rows.map(r => (r || [])[j]);
    if (!nilai.some(isi) && !isi(header[j])) continue;
    kolom.push({ idx: j, huruf, nama: nm, tipe: deteksiTipe(nilai) });
  }
  f.sheet = { nama, kolom, rows: rows.map(r => r || []), barisAwal: range.s.r + hi + 2 };
  const maks = Number(state.pengaturan.maksBaris) || 20000;
  $('fileNama').textContent = f.nama;
  $('fileMeta').innerHTML = (f.ukuran / 1024).toFixed(0) + ' KB · ' + f.sheetNames.length + ' sheet · <b>' + rows.length.toLocaleString('id-ID') + '</b> baris data (baris ' + f.sheet.barisAwal + '–' + (f.sheet.barisAwal + rows.length - 1) + ') · ' + kolom.length + ' kolom' +
    (rows.length > maks ? ' · <span class="text-danger-2">melebihi batas ' + maks.toLocaleString('id-ID') + ' baris</span>' : '');
  renderKolomList();
}

function deteksiTipe(nilai) {
  const s = nilai.filter(v => v !== null && v !== undefined && String(v).trim() !== '').slice(0, 300);
  if (!s.length) return 'teks';
  const tgl = s.filter(v => v instanceof Date || (typeof v === 'string' && /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(v.trim()))).length;
  if (tgl / s.length >= .8) return 'tanggal';
  const ang = s.filter(v => typeof v === 'number' || (typeof v === 'string' && /^[\s\-Rp.$€]*[\d.,]+\s*%?$/i.test(v) && parseAngka(v) !== null)).length;
  if (ang / s.length >= .8) return 'angka';
  return 'teks';
}

function renderKolomList() {
  const k = state.file && state.file.sheet ? state.file.sheet.kolom : [];
  $('kolomList').innerHTML = k.length ? k.map((c, i) =>
    '<div class="kolom-item"><span class="huruf">' + c.huruf + '</span><span class="nama" title="' + esc(c.nama) + '">' + esc(c.nama) + '</span>' +
    '<select class="form-select" onchange="state.file.sheet.kolom[' + i + '].tipe=this.value; if(state.jenisDipilih) renderMapping();">' +
    ['angka', 'teks', 'tanggal'].map(t => '<option value="' + t + '"' + (c.tipe === t ? ' selected' : '') + '>' + { angka: '🔢 Angka', teks: '🔤 Teks', tanggal: '📅 Tanggal' }[t] + '</option>').join('') + '</select></div>'
  ).join('') : '<p class="text-muted-2 small mb-0">Tidak ada kolom berisi data di sheet ini.</p>';
}

function bukaPratinjauData() {
  const s = state.file && state.file.sheet;
  if (!s || !s.kolom.length) return showToast('warning', 'Belum ada data', 'Sheet ini tidak berisi data.');
  const tampil = s.rows.slice(0, 10);
  const sel = v => v instanceof Date ? fmtTgl(v.toISOString(), false) : (typeof v === 'number' ? fmtAngka(v, 4) : esc(v === null || v === undefined ? '' : v));
  $('pratinjauInfo').textContent = '— 10 baris pertama dari ' + s.rows.length.toLocaleString('id-ID') + ' · sheet "' + s.nama + '"';
  $('pratinjauTabel').innerHTML = '<table class="table table-sm align-middle mb-0"><thead><tr><th>Baris</th>' + s.kolom.map(c => '<th>' + c.huruf + ' · ' + esc(c.nama) + '</th>').join('') + '</tr></thead><tbody>' +
    tampil.map((r, i) => '<tr><td class="text-muted-2">' + (s.barisAwal + i) + '</td>' + s.kolom.map(c => '<td>' + sel(r[c.idx]) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  modal('modalPratinjau').show();
}

function keLangkah(n, diam) {
  if (n >= 2) {
    const s = state.file && state.file.sheet;
    if (!s || !s.rows.length) { if (!diam) showToast('warning', 'Unggah file dulu', 'Pilih file Excel yang berisi data.'); return; }
    if (s.rows.length > (Number(state.pengaturan.maksBaris) || 20000)) { if (!diam) showToast('warning', 'Data terlalu banyak', 'Jumlah baris melebihi batas. Kurangi baris atau minta Admin menaikkan batas.'); return; }
  }
  if (n === 3 && !state.hasilBaru) return;
  document.querySelectorAll('.wizard-panel').forEach(p => p.classList.toggle('active', p.id === 'step-' + n));
  document.querySelectorAll('.stepper .step').forEach(s => {
    const k = Number(s.dataset.step);
    s.classList.toggle('active', k === n); s.classList.toggle('done', k < n);
  });
  if (n === 3 && state.charts['baru-chart'] && state.charts['baru-chart'].ulang) setTimeout(() => state.charts['baru-chart'].ulang(), 50);
}

// ════════════════════════════════════════════════════════
// BAGIAN 7: WIZARD — PILIH JENIS ANALISIS & KOLOM
// ════════════════════════════════════════════════════════
function renderJenisCards() {
  $('jenisCards').innerHTML = state.jenis.length ? state.jenis.map(j =>
    '<div class="col-sm-6 col-xl-4"><div class="glass jenis-card' + (state.jenisDipilih && state.jenisDipilih.id === j.id ? ' selected' : '') + '" tabindex="0" onclick="pilihJenis(\'' + j.id + '\')" onkeydown="if(event.key===\'Enter\')pilihJenis(\'' + j.id + '\')">' +
    '<span class="check"><i class="bi bi-check-lg"></i></span><div class="jicon"><i class="bi ' + esc(j.ikon) + '"></i></div>' +
    '<h6>' + esc(j.nama) + '</h6><p>' + esc(j.deskripsi) + '</p></div></div>'
  ).join('') : '<div class="col-12"><div class="empty-state"><i class="bi bi-sliders"></i><p>Belum ada jenis analisis aktif. Hubungi Admin.</p></div></div>';
}

function pilihJenis(id) {
  state.jenisDipilih = state.jenis.find(j => j.id === id);
  renderJenisCards();
  $('mappingCard').classList.remove('d-none');
  const sheet = state.file.sheet;
  $('judulAnalisis').value = state.jenisDipilih.nama + ' — ' + state.file.nama.replace(/\.[^.]+$/, '') + (state.file.sheetNames.length > 1 ? ' (' + sheet.nama + ')' : '');
  renderMapping();
  setTimeout(() => $('mappingCard').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

function renderMapping() {
  const j = state.jenisDipilih, kolom = state.file.sheet.kolom;
  const lab = state.labelKebutuhan;
  const cocok = { angka: ['angka'], tanggal: ['tanggal'], kategori: ['teks', 'tanggal', 'angka'] };
  const terpakai = [];
  const lamaVal = {};
  document.querySelectorAll('#mappingFields select').forEach(s => lamaVal[s.dataset.k] = s.value);
  const labelK = k => j.kodeMesin === 'PERINGKAT' && k === 'kategori' ? 'Kolom nama / label' : lab[k];
  $('mappingHint').textContent = 'Analisis "' + j.nama + '" membutuhkan: ' + j.kebutuhan.map(labelK).join(', ').toLowerCase() + '.';
  $('mappingFields').innerHTML = j.kebutuhan.map(k => {
    const utama = kolom.filter(c => cocok[k].indexOf(c.tipe) >= 0 && (k !== 'kategori' || c.tipe === 'teks'));
    const lain = kolom.filter(c => utama.indexOf(c) < 0);
    let pilih = lamaVal[k] !== undefined && kolom.some(c => String(c.idx) === lamaVal[k]) ? lamaVal[k] : null;
    if (pilih === null) { const t = utama.find(c => terpakai.indexOf(String(c.idx)) < 0); pilih = t ? String(t.idx) : ''; }
    terpakai.push(pilih);
    const opt = c => '<option value="' + c.idx + '"' + (String(c.idx) === pilih ? ' selected' : '') + '>' + c.huruf + ' · ' + esc(c.nama) + '</option>';
    return '<div class="col-md-' + (j.kebutuhan.length > 1 ? 6 : 12) + '"><label class="form-label small fw-medium">' + esc(labelK(k)) + ' *</label>' +
      '<select class="form-select select-glass" data-k="' + k + '"><option value="">— pilih kolom —</option>' +
      (utama.length ? '<optgroup label="Disarankan">' + utama.map(opt).join('') + '</optgroup>' : '') +
      (lain.length ? '<optgroup label="Kolom lain">' + lain.map(opt).join('') + '</optgroup>' : '') + '</select></div>';
  }).join('');

  const p = j.parameter || {};
  let html = '';
  if (j.kodeMesin === 'TREN_WAKTU') {
    html = '<div class="col-md-6"><label class="form-label small fw-medium">Kelompokkan per</label><select class="form-select select-glass" id="paramPeriode">' +
      ['hari', 'bulan', 'tahun'].map(x => '<option value="' + x + '"' + ((p.periode || 'bulan') === x ? ' selected' : '') + '>' + x[0].toUpperCase() + x.slice(1) + '</option>').join('') + '</select></div>';
  }
  if (j.kodeMesin === 'PERINGKAT') {
    html = '<div class="col-md-6"><label class="form-label small fw-medium">Jumlah peringkat</label><input type="number" class="form-control input-pill" id="paramN" min="1" max="100" value="' + (p.n || 10) + '"></div>' +
      '<div class="col-md-6"><label class="form-label small fw-medium">Urutkan dari</label><select class="form-select select-glass" id="paramUrutan"><option value="tertinggi"' + (p.urutan !== 'terendah' ? ' selected' : '') + '>Tertinggi</option><option value="terendah"' + (p.urutan === 'terendah' ? ' selected' : '') + '>Terendah</option></select></div>';
  }
  $('paramFields').innerHTML = html;
}

function syncPemisahSelect() { document.querySelectorAll('.pemisah-select').forEach(s => s.value = state.pemisah); }
function setPemisah(v) {
  state.pemisah = v === ',' ? ',' : ';';
  store.set('da_pemisah', state.pemisah);
  syncPemisahSelect();
  document.querySelectorAll('.formula').forEach(f => { const b = f.querySelector('.btn-salin'); if (b) f.querySelector('span').textContent = ubahPemisah(decodeURIComponent(b.dataset.r)); });
}

/** Ubah nilai sel menjadi format yang dikirim ke server */
function keYmd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function nilaiTanggal(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : keYmd(v);
  if (typeof v === 'number') { const p = XLSX.SSF.parse_date_code(v); return p ? p.y + '-' + ('0' + p.m).slice(-2) + '-' + ('0' + p.d).slice(-2) : null; }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); // format Indonesia: dd/mm/yyyy
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return null;
}
function nilaiAngka(v) { if (v instanceof Date) return null; if (typeof v === 'number') return v; return v === null || v === undefined ? null : String(v); }
function nilaiTeks(v) { if (v === null || v === undefined) return null; if (v instanceof Date) return keYmd(v); return String(v); }

function jalankanAnalisis() {
  const j = state.jenisDipilih, s = state.file.sheet;
  const kolom = {}, data = {};
  for (const sel of document.querySelectorAll('#mappingFields select')) {
    if (sel.value === '') { sel.focus(); return showToast('warning', 'Kolom belum dipilih', 'Silakan pilih ' + sel.closest('div').querySelector('label').textContent.replace(' *', '').toLowerCase() + '.'); }
    const c = s.kolom.find(x => String(x.idx) === sel.value);
    kolom[sel.dataset.k] = { nama: c.nama, huruf: c.huruf };
    const konv = sel.dataset.k === 'angka' ? nilaiAngka : sel.dataset.k === 'tanggal' ? nilaiTanggal : nilaiTeks;
    data[sel.dataset.k] = s.rows.map(r => konv(r[c.idx]));
  }
  const huruf = Object.values(kolom).map(k => k.huruf);
  if (new Set(huruf).size !== huruf.length) return showToast('warning', 'Kolom sama', 'Pilih kolom yang berbeda untuk setiap kebutuhan.');
  const judul = $('judulAnalisis').value.trim();
  if (!judul) { $('judulAnalisis').focus(); return showToast('warning', 'Judul kosong', 'Isi judul analisis terlebih dahulu.'); }
  const parameter = {};
  if ($('paramPeriode')) parameter.periode = $('paramPeriode').value;
  if ($('paramN')) {
    parameter.n = Math.max(1, Math.min(100, Number($('paramN').value) || 10));
    parameter.urutan = $('paramUrutan').value;
  }
  const payload = { idJenis: j.id, namaSheet: s.nama, barisAwal: s.barisAwal, kolom, data, parameter };
  const btn = $('btnAnalisis');
  setBusy(btn, true, 'Menganalisis...');
  api('apiProsesAnalisis', state.token, payload).then(d => {
    state.hasilBaru = d.hasil;
    state.hasilBaruMeta = { judul, idJenis: j.id, namaJenis: j.nama, namaFile: state.file.nama, namaSheet: s.nama, kolom, jumlahBaris: s.rows.length };
    renderHasil('hasilBaruWrap', 'baru', state.hasilBaru, state.hasilBaruMeta, false);
    keLangkah(3);
    showToast('success', 'Analisis selesai', 'Periksa hasil & rumusnya, lalu simpan.');
  }).catch(toastError).finally(() => setBusy(btn, false));
}

// ════════════════════════════════════════════════════════
// BAGIAN 8: TAMPILAN HASIL (tabel + rumus + grafik) — dipakai ulang
// ════════════════════════════════════════════════════════
/**
 * @param wrapId  id elemen pembungkus
 * @param prefix  awalan id unik (baru / detail / uji)
 * @param hasil   struktur hasil analisis
 * @param meta    { judul, namaJenis, namaFile, namaSheet, jumlahBaris }
 * @param editable tampilkan input untuk diedit
 */
function renderHasil(wrapId, prefix, hasil, meta, editable, opsi) {
  opsi = opsi || {};
  const info = hasil.info || {};
  const tipeOpt = Object.keys(NAMA_GRAFIK).map(t => '<option value="' + t + '"' + (hasil.grafik.tipe === t ? ' selected' : '') + '>' + NAMA_GRAFIK[t] + '</option>').join('');
  const html =
    (opsi.tanpaMeta ? '' :
    '<div class="glass card-glass mb-3"><div class="hasil-head"><div class="min-w-0">' +
      (prefix === 'baru' ? '<h5 class="fw-semibold mb-2 text-truncate">' + esc(meta.judul) + '</h5>' : '') +
      '<div class="meta-chips">' +
        '<span class="meta-chip"><i class="bi bi-sliders"></i>' + esc(meta.namaJenis) + '</span>' +
        '<span class="meta-chip"><i class="bi bi-file-earmark-excel"></i>' + esc(meta.namaFile) + ' · ' + esc(meta.namaSheet) + '</span>' +
        '<span class="meta-chip"><i class="bi bi-list-ol"></i>' + fmtAngka(meta.jumlahBaris) + ' baris (baris ' + info.barisAwal + '–' + info.barisAkhir + ')</span>' +
      '</div></div>' +
      '<select class="form-select select-glass pemisah-select" style="width:auto" onchange="setPemisah(this.value)" title="Pemisah rumus">' +
        '<option value=";">Pemisah ;</option><option value=",">Pemisah ,</option></select></div>' +
      (hasil.ringkasan && hasil.ringkasan.length ? '<div class="insight-soft"><b><i class="bi bi-stars me-1"></i>Ringkasan otomatis</b><ul>' + hasil.ringkasan.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></div>' : '') +
      (info.catatanBatas ? '<div class="alert-glass alert-warning-glass small mt-2"><i class="bi bi-exclamation-triangle me-1"></i>' + esc(info.catatanBatas) + '</div>' : '') +
    '</div>') +
    '<div class="tabs-glass mb-3"><button class="tab-pill active" data-tab="' + prefix + '-tabTabel"><i class="bi bi-table me-1"></i>Tabel & Rumus</button>' +
      (opsi.tanpaGrafik ? '' : '<button class="tab-pill" data-tab="' + prefix + '-tabGrafik"><i class="bi bi-bar-chart me-1"></i>Grafik</button>') + '</div>' +
    '<div>' +
      '<div class="tab-panel active" id="' + prefix + '-tabTabel"><div class="glass card-glass">' +
        (hasil.baris.length > 8 ? '<div class="input-glass mb-3"><i class="bi bi-search"></i><input type="search" class="form-control" id="' + prefix + '-cari" placeholder="Cari baris..."></div>' : '') +
        '<div class="table-responsive table-glass"><table class="table align-middle mb-0"><thead><tr><th>Keterangan</th>' +
          hasil.kolomMetrik.map(k => '<th>' + esc(k.label) + '</th>').join('') + '</tr></thead><tbody id="' + prefix + '-tbody"></tbody></table></div>' +
        '<p class="small text-muted-2 mt-3 mb-0"><i class="bi bi-lightbulb me-1"></i>Klik <i class="bi bi-copy"></i> untuk menyalin rumus, lalu tempel di sel kosong pada file asal Anda. Rumus merujuk ke sheet "' + esc(meta.namaSheet) + '".</p>' +
      '</div></div>' +
      (opsi.tanpaGrafik ? '' :
      '<div class="tab-panel" id="' + prefix + '-tabGrafik" data-onshow="tampilGrafikPanel" data-prefix="' + prefix + '"><div class="glass card-glass">' +
        '<div class="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap"><h6 class="fw-semibold mb-0">Visualisasi</h6>' +
        (editable || prefix === 'detail' ? '' : '<select class="form-select select-glass" style="width:auto" id="' + prefix + '-tipeGrafik">' + tipeOpt + '</select>') + '</div>' +
        '<div class="chart-box chart-box-lg"><canvas id="' + prefix + '-chart"></canvas></div></div></div>') +
    '</div>';
  $(wrapId).innerHTML = html;
  syncPemisahSelect();
  renderBarisHasil(prefix, hasil, editable);
  const cari = $(prefix + '-cari');
  if (cari) cari.addEventListener('input', () => renderBarisHasil(prefix, hasil, editable, cari.value));
  const tg = $(prefix + '-tipeGrafik');
  if (tg) tg.addEventListener('change', () => { hasil.grafik.tipe = tg.value; renderGrafikHasil(prefix, hasil); });
  state['_hasil_' + prefix] = hasil;
}

function tampilGrafikPanel(panel) {
  const p = panel.dataset.prefix;
  renderGrafikHasil(p, state['_hasil_' + p]);
}
function renderGrafikHasil(prefix, hasil) {
  if (!hasil || !$(prefix + '-chart')) return;
  makeChart(prefix + '-chart', () => configGrafikHasil(hasil, hasil.grafik.tipe));
}

function selFormula(s) {
  if (!s || !s.rumus) return '';
  return '<div class="formula"><span title="' + esc(s.penjelasan || '') + '">' + esc(ubahPemisah(s.rumus)) + '</span>' +
    '<button type="button" class="btn-salin" data-r="' + encodeURIComponent(s.rumus) + '" title="Salin rumus" aria-label="Salin rumus"><i class="bi bi-copy"></i></button></div>';
}
function nilaiEdit(s) {
  if (!s || s.nilai === null || s.nilai === undefined) return '';
  if (s.format === 'teks') return String(s.nilai);
  const n = Number(s.nilai) * (s.format === 'persen' ? 100 : 1);
  return String(Math.round(n * 1e6) / 1e6).replace('.', ',');
}

function renderBarisHasil(prefix, hasil, editable, cari) {
  const q = (cari || '').toLowerCase();
  const tampilPenjelasan = hasil.baris.length <= 10;
  const rows = hasil.baris.map((b, i) => ({ b, i })).filter(x => !q || x.b.label.toLowerCase().indexOf(q) >= 0 || hasil.kolomMetrik.some(k => x.b.sel[k.key] && String(x.b.sel[k.key].nilai).toLowerCase().indexOf(q) >= 0));
  $(prefix + '-tbody').innerHTML = rows.length ? rows.map(({ b, i }) => {
    const labelSel = editable
      ? '<input class="cell-input" value="' + esc(b.label) + '" maxlength="120" oninput="editLabel(' + i + ', this.value)">'
      : '<span class="fw-medium">' + esc(b.label) + '</span>';
    return '<tr><td style="min-width:150px">' + labelSel + '</td>' + hasil.kolomMetrik.map(k => {
      const s = b.sel[k.key];
      if (!s) return '<td>-</td>';
      const nilai = editable
        ? '<input class="cell-input' + (s.manual ? ' changed' : '') + '" value="' + esc(nilaiEdit(s)) + '" oninput="editNilai(' + i + ',\'' + k.key + '\', this)"' + (s.format === 'persen' ? ' placeholder="dalam %"' : '') + '>' + (s.format === 'persen' ? '<span class="small text-muted-2"> %</span>' : '')
        : '<div class="val">' + esc(fmtSel(s)) + (s.manual ? ' <span class="badge-manual">manual</span>' : '') + '</div>';
      return '<td style="min-width:200px">' + nilai + selFormula(s) + (tampilPenjelasan && !editable && s.penjelasan ? '<div class="penjelasan">' + esc(s.penjelasan) + '</div>' : '') + '</td>';
    }).join('') + '</tr>';
  }).join('') : '<tr><td colspan="' + (hasil.kolomMetrik.length + 1) + '" class="text-center text-muted-2 py-4">Tidak ada baris yang cocok.</td></tr>';
}

function unduhExcel(hasil, meta) {
  meta = meta || state.hasilBaruMeta;
  if (!hasil || !meta) return showToast('warning', 'Belum ada hasil', 'Jalankan analisis terlebih dahulu.');
  try {
    const header = ['Keterangan'];
    hasil.kolomMetrik.forEach(k => { header.push(k.label); header.push('Rumus ' + k.label); });
    const aoa = [header];
    hasil.baris.forEach(b => {
      const r = [b.label];
      hasil.kolomMetrik.forEach(k => {
        const s = b.sel[k.key] || {};
        r.push(s.nilai === null || s.nilai === undefined ? '' : s.nilai);
        r.push(s.rumus ? ubahPemisah(s.rumus) + (s.manual ? '   [nilai diubah manual]' : '') : '');
      });
      aoa.push(r);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    hasil.kolomMetrik.forEach((k, i) => {
      for (let r = 1; r < aoa.length; r++) {
        const ref = XLSX.utils.encode_cell({ r, c: 1 + i * 2 });
        if (ws[ref] && ws[ref].t === 'n') ws[ref].z = k.format === 'persen' ? '0.0%' : k.format === 'bulat' ? '#,##0' : '#,##0.##';
      }
    });
    ws['!cols'] = header.map((h, i) => ({ wch: i === 0 ? 26 : (h.indexOf('Rumus') === 0 ? 60 : 16) }));
    const info = [['Judul', meta.judul], ['Jenis Analisis', meta.namaJenis], ['File Asal', meta.namaFile], ['Sheet Asal', meta.namaSheet], ['Jumlah Baris', meta.jumlahBaris],
      ['Diunduh', fmtTgl(new Date().toISOString())], ['Cara memakai rumus', 'Salin teks di kolom "Rumus ..." ke sel kosong pada file asal. Rumus merujuk ke sheet "' + meta.namaSheet + '".']];
    (hasil.ringkasan || []).forEach((s, i) => info.push([i === 0 ? 'Ringkasan' : '', s]));
    const wsInfo = XLSX.utils.aoa_to_sheet(info);
    wsInfo['!cols'] = [{ wch: 20 }, { wch: 100 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hasil');
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Info');
    XLSX.writeFile(wb, (meta.judul || 'hasil-analisis').replace(/[\\/:*?"<>|]/g, '').slice(0, 60) + '.xlsx');
    showToast('success', 'Mengunduh', 'File Excel hasil sedang diunduh.');
  } catch (e) {
    showToast('warning', 'Unduhan diblokir browser', 'Gunakan lampiran Excel di email hasil analisis. (' + e.message + ')');
  }
}

function simpanHasilBaru() {
  const m = state.hasilBaruMeta;
  if (!state.hasilBaru || !m) return;
  const btn = $('btnSimpan');
  setBusy(btn, true, 'Menyimpan & mengirim email...');
  apiPesan('apiSimpanHasil', state.token, Object.assign({}, m, { hasil: state.hasilBaru, catatan: $('catatanBaru').value.trim(), pemisah: state.pemisah }))
    .then(({ data }) => {
      showToast(data.email.ok ? 'success' : 'warning', data.email.ok ? 'Hasil tersimpan & email terkirim' : 'Hasil tersimpan, email gagal', data.email.pesan, 7000);
      resetWizard(true);
      bukaDetail(data.id);
    }).catch(toastError).finally(() => setBusy(btn, false));
}

// ════════════════════════════════════════════════════════
// BAGIAN 9: RIWAYAT
// ════════════════════════════════════════════════════════
function loadRiwayat() {
  const admin = state.user.peran === 'ADMIN';
  $('riwayatTitle').textContent = admin ? 'Semua Hasil Analisis' : 'Riwayat Analisis';
  $('riwayatSub').textContent = admin ? 'Hasil analisis dari seluruh pengguna.' : 'Semua hasil analisis yang pernah Anda simpan.';
  $('riwayatBody').innerHTML = [1, 2, 3].map(() => '<tr><td colspan="7"><div class="skeleton"></div></td></tr>').join('');
  api('apiGetRiwayat', state.token).then(list => {
    state.riwayat = list;
    const isiSelect = (id, nilai, awal) => { const el = $(id), lama = el.value; el.innerHTML = '<option value="">' + awal + '</option>' + nilai.map(v => '<option>' + esc(v) + '</option>').join(''); el.value = nilai.indexOf(lama) >= 0 ? lama : ''; };
    isiSelect('riwayatJenis', [...new Set(list.map(h => h.namaJenis))], 'Semua jenis');
    isiSelect('riwayatPengguna', [...new Set(list.map(h => h.pemilik))], 'Semua pengguna');
    renderRiwayat();
  }).catch(toastError);
}

function renderRiwayat() {
  const q = $('riwayatCari').value.toLowerCase(), jn = $('riwayatJenis').value, pg = $('riwayatPengguna').value;
  const dari = $('riwayatDari').value, sampai = $('riwayatSampai').value;
  const admin = state.user && state.user.peran === 'ADMIN';
  const list = state.riwayat.filter(h => {
    const tgl = keYmd(new Date(h.diubahPada));
    return (!q || (h.judul + ' ' + h.namaFile).toLowerCase().indexOf(q) >= 0) && (!jn || h.namaJenis === jn) && (!pg || h.pemilik === pg) && (!dari || tgl >= dari) && (!sampai || tgl <= sampai);
  });
  $('riwayatKosong').classList.toggle('d-none', list.length > 0);
  $('riwayatBody').innerHTML = list.map(h =>
    '<tr><td class="clickable" onclick="bukaDetail(\'' + h.id + '\')"><div class="fw-medium">' + esc(h.judul) + '</div><div class="small text-muted-2">' + fmtAngka(h.jumlahBaris) + ' baris</div></td>' +
    '<td><span class="badge-pill badge-o">' + esc(h.namaJenis) + '</span></td>' +
    '<td class="small">' + esc(h.namaFile) + '<div class="text-muted-2">' + esc(h.namaSheet) + '</div></td>' +
    (admin ? '<td class="small">' + esc(h.pemilik) + '</td>' : '') +
    '<td class="small text-nowrap">' + fmtTgl(h.diubahPada) + '</td><td class="text-center"><span class="badge-pill badge-n">v' + h.versi + '</span></td>' +
    '<td class="text-end text-nowrap">' +
      '<button class="btn-icon sm glass" title="Lihat" onclick="bukaDetail(\'' + h.id + '\')"><i class="bi bi-eye"></i></button> ' +
      '<button class="btn-icon sm glass" title="Edit" onclick="bukaDetail(\'' + h.id + '\', true)"><i class="bi bi-pencil"></i></button> ' +
      '<button class="btn-icon sm glass" title="Kirim ulang email" onclick="kirimUlang(\'' + h.id + '\', this)"><i class="bi bi-envelope"></i></button>' +
      (admin ? ' <button class="btn-icon sm glass danger" title="Hapus" onclick="hapusHasil(\'' + h.id + '\')"><i class="bi bi-trash"></i></button>' : '') +
    '</td></tr>'
  ).join('');
}

function kirimUlang(id, btn) {
  if (btn) btn.disabled = true;
  apiPesan('apiKirimUlang', state.token, id, state.pemisah)
    .then(({ message }) => { showToast('success', 'Email dikirim ulang', message); if (state.section === 'detail' && state.detail && state.detail.id === id) bukaDetail(id); })
    .catch(toastError).finally(() => { if (btn) btn.disabled = false; });
}

function hapusHasil(id) {
  const h = state.riwayat.find(x => x.id === id);
  konfirmasi('Hapus hasil analisis?', 'Hasil "' + (h ? h.judul : '') + '" akan dihapus dari daftar. Tindakan ini tidak bisa dibatalkan dari aplikasi.', 'Ya, hapus').then(ya => {
    if (!ya) return;
    api('apiHapusHasil', state.token, id).then(() => { showToast('success', 'Dihapus', 'Hasil analisis telah dihapus.'); loadRiwayat(); }).catch(toastError);
  });
}

// ════════════════════════════════════════════════════════
// BAGIAN 10: DETAIL & EDIT HASIL
// ════════════════════════════════════════════════════════
function bukaDetail(id, edit) {
  state.editMode = false; state.editHasil = null;
  navigateTo('detail', { tanpaMuat: true });
  $('detailJudul').textContent = 'Memuat...'; $('detailMeta').textContent = '';
  $('detailWrap').innerHTML = '<div class="glass card-glass"><div class="skeleton mb-2" style="height:28px"></div><div class="skeleton mb-2"></div><div class="skeleton" style="height:180px"></div></div>';
  toggleEditUI(false);
  api('apiGetHasil', state.token, id).then(d => {
    state.detail = d;
    renderDetail();
    if (edit) mulaiEdit();
  }).catch(e => { toastError(e); navigateTo('riwayat'); });
}

function metaDetail() {
  const d = state.detail;
  return { judul: d.judul, namaJenis: d.namaJenis, namaFile: d.namaFile, namaSheet: d.namaSheet, jumlahBaris: d.jumlahBaris };
}

function renderDetail() {
  const d = state.detail;
  if (!d.hasil) { $('detailWrap').innerHTML = '<div class="alert-glass alert-danger-glass">Data hasil rusak dan tidak bisa ditampilkan.</div>'; return; }
  $('detailJudul').textContent = d.judul;
  $('detailMeta').innerHTML = 'Versi ' + d.versi + ' · diperbarui ' + fmtTgl(d.diubahPada) + ' · dibuat ' + fmtTgl(d.dibuatPada) + (state.user.peran === 'ADMIN' ? ' · milik <b>' + esc(d.pemilik) + '</b>' : '');
  const hasil = state.editMode ? state.editHasil : d.hasil;
  renderHasil('detailWrap', 'detail', hasil, metaDetail(), state.editMode);
  $('detailCatatanCard').classList.toggle('d-none', state.editMode);
  $('detailCatatan').textContent = d.catatan || 'Tidak ada catatan.';
  $('detailLogEmail').innerHTML = d.logEmail && d.logEmail.length ? d.logEmail.map(l =>
    '<div class="d-flex justify-content-between gap-2 py-2 border-soft flex-wrap"><span><span class="badge-pill ' + (l.status === 'TERKIRIM' ? 'badge-g' : 'badge-r') + '">' + esc(l.status) + '</span> v' + esc(l.versi) + ' · ' + esc(l.jenis === 'EDIT' ? 'Revisi' : 'Baru') + ' → ' + esc(l.tujuan) + (l.pesan ? '<div class="text-muted-2">' + esc(l.pesan) + '</div>' : '') + '</span><span class="text-muted-2 text-nowrap">' + fmtTgl(l.waktu) + '</span></div>'
  ).join('') : '<span class="text-muted-2">Belum ada email terkirim.</span>';
}

function toggleEditUI(on) {
  $('detailAksiView').classList.toggle('d-none', on);
  $('detailAksiEdit').classList.toggle('d-none', !on);
  $('editMetaCard').classList.toggle('d-none', !on);
}

function mulaiEdit() {
  const d = state.detail;
  state.editMode = true;
  state.editHasil = clone(d.hasil);
  state.editHasil.baris.forEach(b => Object.keys(b.sel).forEach(k => { b.sel[k]._asli = b.sel[k].nilai; b.sel[k]._manualAwal = !!b.sel[k].manual; }));
  $('editJudul').value = d.judul;
  $('editCatatan').value = d.catatan || '';
  $('editGrafik').innerHTML = Object.keys(NAMA_GRAFIK).map(t => '<option value="' + t + '">' + NAMA_GRAFIK[t] + '</option>').join('');
  $('editGrafik').value = state.editHasil.grafik.tipe;
  toggleEditUI(true);
  renderDetail();
}

function batalEdit() {
  state.editMode = false; state.editHasil = null;
  toggleEditUI(false);
  renderDetail();
}

function editLabel(i, v) { state.editHasil.baris[i].label = v; }
function editNilai(i, key, el) {
  const s = state.editHasil.baris[i].sel[key];
  let v;
  if (s.format === 'teks') v = el.value;
  else { const n = parseAngka(el.value); v = n === null ? null : (s.format === 'persen' ? n / 100 : n); }
  s.nilai = v;
  const beda = s.format === 'teks' ? String(v) !== String(s._asli) : (v === null ? s._asli !== null : Math.abs(v - Number(s._asli)) > 1e-9);
  s.manual = s._manualAwal || beda;
  el.classList.toggle('changed', s.manual);
}

function simpanEdit() {
  const judul = $('editJudul').value.trim();
  if (!judul) { $('editJudul').focus(); return showToast('warning', 'Judul kosong', 'Judul wajib diisi.'); }
  const hasil = clone(state.editHasil);
  hasil.grafik.tipe = $('editGrafik').value;
  hasil.baris.forEach(b => Object.keys(b.sel).forEach(k => { delete b.sel[k]._asli; delete b.sel[k]._manualAwal; }));
  const btn = $('btnSimpanEdit');
  setBusy(btn, true, 'Menyimpan & mengirim ulang...');
  apiPesan('apiUpdateHasil', state.token, state.detail.id, { judul, catatan: $('editCatatan').value.trim(), hasil, versi: state.detail.versi, pemisah: state.pemisah })
    .then(({ data }) => {
      showToast(data.email.ok ? 'success' : 'warning', 'Perubahan tersimpan (v' + data.versi + ')', data.email.pesan, 7000);
      bukaDetail(state.detail.id);
    }).catch(toastError).finally(() => setBusy(btn, false));
}

// ════════════════════════════════════════════════════════
// BAGIAN 11: PROFIL & SANDI
// ════════════════════════════════════════════════════════
function renderProfil() {
  const u = state.user;
  $('profilAvatar').textContent = (u.nama || '?').trim().charAt(0).toUpperCase();
  $('profilNama').textContent = u.nama; $('profilEmail').textContent = u.email;
  $('profilPeran').innerHTML = '<span class="badge-pill ' + (u.peran === 'ADMIN' ? 'badge-b' : 'badge-n') + '">' + (u.peran === 'ADMIN' ? 'Admin' : 'Pengguna') + '</span>';
  $('profilLogin').textContent = fmtTgl(u.loginTerakhir);
  syncPemisahSelect();
}

function validasiSandiBaru(baru, ulang) {
  if (baru.length < 8 || !/[A-Za-z]/.test(baru) || !/\d/.test(baru)) return 'Sandi baru minimal 8 karakter dan harus berisi huruf serta angka.';
  if (baru !== ulang) return 'Ulangan sandi baru tidak sama.';
  return '';
}
function prosesGantiSandi(lama, baru, ulang) {
  const err = validasiSandiBaru(baru, ulang);
  if (err) { showToast('warning', 'Periksa sandi', err); return Promise.reject(null); }
  return api('apiGantiSandi', state.token, lama, baru).then(d => {
    state.token = d.token; store.set('da_token', d.token); state.user = d.user;
    showToast('success', 'Sandi diganti', 'Sandi baru Anda sudah aktif.');
  });
}
function gantiSandi(ev) {
  ev.preventDefault();
  const btn = ev.target.querySelector('button[type=submit]');
  setBusy(btn, true);
  prosesGantiSandi($('sandiLama').value, $('sandiBaru').value, $('sandiBaru2').value)
    .then(() => ev.target.reset()).catch(e => e && toastError(e)).finally(() => setBusy(btn, false));
}
function simpanWajibSandi() {
  prosesGantiSandi($('wajibLama').value, $('wajibBaru').value, $('wajibBaru2').value)
    .then(() => { modal('modalWajibSandi').hide(); $('formWajibSandi').reset(); }).catch(e => e && toastError(e));
}

// ════════════════════════════════════════════════════════
// BAGIAN 12: ADMIN — JENIS ANALISIS (MASTER DATA)
// ════════════════════════════════════════════════════════
function loadJenisAdmin() {
  $('jenisBody').innerHTML = '<tr><td colspan="7"><div class="skeleton"></div></td></tr>';
  const pm = state.mesin ? Promise.resolve(state.mesin) : api('apiGetMesin', state.token).then(m => (state.mesin = m));
  Promise.all([pm, api('apiGetJenisAdmin', state.token)]).then(([m, list]) => { state.adminJenis = list; renderJenisTable(); }).catch(toastError);
}

function renderJenisTable() {
  const q = $('jenisCari').value.toLowerCase();
  const list = state.adminJenis.filter(j => !q || (j.nama + ' ' + j.deskripsi).toLowerCase().indexOf(q) >= 0);
  $('jenisBody').innerHTML = list.length ? list.map(j =>
    '<tr><td class="text-muted-2">' + j.urutan + '</td><td><div class="d-flex align-items-center gap-2"><div class="item-icon"><i class="bi ' + esc(j.ikon) + '"></i></div><div class="min-w-0"><div class="fw-medium">' + esc(j.nama) + '</div><div class="small text-muted-2 text-truncate" style="max-width:300px">' + esc(j.deskripsi) + '</div></div></div></td>' +
    '<td class="small">' + esc(NAMA_MESIN[j.kodeMesin] || j.kodeMesin) + '</td>' +
    '<td class="small">' + j.item.map(it => '<span class="badge-pill badge-n me-1 mb-1">' + esc(it.label) + '</span>').join('') + '</td>' +
    '<td class="small">' + esc(NAMA_GRAFIK[j.jenisGrafik] || j.jenisGrafik) + '</td>' +
    '<td class="text-center"><label class="switch-glass"><input type="checkbox"' + (j.status === 'AKTIF' ? ' checked' : '') + ' onchange="ubahStatusJenis(\'' + j.id + '\', this)"><span></span></label></td>' +
    '<td class="text-end"><button class="btn-icon sm glass" title="Edit" onclick="bukaFormJenis(\'' + j.id + '\')"><i class="bi bi-pencil"></i></button></td></tr>'
  ).join('') : '<tr><td colspan="7" class="text-center text-muted-2 py-4">Tidak ada jenis analisis.</td></tr>';
}

function ubahStatusJenis(id, el) {
  el.disabled = true;
  api('apiStatusJenis', state.token, id, el.checked ? 'AKTIF' : 'NONAKTIF').then(() => {
    const j = state.adminJenis.find(x => x.id === id); if (j) j.status = el.checked ? 'AKTIF' : 'NONAKTIF';
    showToast('success', 'Status diperbarui', el.checked ? 'Jenis analisis ditampilkan ke pengguna.' : 'Jenis analisis disembunyikan dari pengguna.');
    segarkanJenisAktif();
  }).catch(e => { el.checked = !el.checked; toastError(e); }).finally(() => el.disabled = false);
}

function segarkanJenisAktif() {
  api('apiInit', state.token).then(d => { state.jenis = d.jenis; }).catch(() => {});
}

function bukaFormJenis(id) {
  const j = id ? state.adminJenis.find(x => x.id === id) : null;
  if (!state.mesin) return showToast('warning', 'Tunggu sebentar', 'Data mesin hitung belum termuat.');
  $('jenisModalJudul').textContent = j ? 'Edit Jenis Analisis' : 'Tambah Jenis Analisis';
  $('jenisId').value = j ? j.id : '';
  $('jenisNama').value = j ? j.nama : '';
  $('jenisDeskripsi').value = j ? j.deskripsi : '';
  $('jenisUrutan').value = j ? j.urutan : state.adminJenis.length + 1;
  $('jenisIkon').innerHTML = IKON.map(i => '<option value="' + i + '">' + i.replace('bi-', '') + '</option>').join('');
  $('jenisIkon').value = j && IKON.indexOf(j.ikon) >= 0 ? j.ikon : 'bi-bar-chart';
  $('jenisMesin').innerHTML = Object.keys(state.mesin.mesin).map(k => '<option value="' + k + '">' + esc(state.mesin.mesin[k].nama) + '</option>').join('');
  $('jenisMesin').value = j ? j.kodeMesin : 'REKAP_KATEGORI';
  $('jenisMesin').disabled = false;
  $('jenisGrafik').innerHTML = Object.keys(NAMA_GRAFIK).map(t => '<option value="' + t + '">' + NAMA_GRAFIK[t] + '</option>').join('');
  $('jenisGrafik').value = j ? j.jenisGrafik : 'BAR';
  $('jenisStatus').value = j ? j.status : 'AKTIF';
  $('ujiHasilWrap').innerHTML = '';
  state._itemJenis = j ? clone(j.item) : null;
  state._paramJenis = j ? clone(j.parameter) : null;
  gantiMesinJenis(false);
  modal('modalJenis').show();
}

function gantiMesinJenis(dariUser) {
  const kode = $('jenisMesin').value, m = state.mesin.mesin[kode];
  if (dariUser || !state._itemJenis) {
    const keys = Object.keys(m.metrik).slice(0, kode === 'STAT_DESKRIPTIF' ? 6 : 2);
    state._itemJenis = keys.map(k => ({ metrik: k, label: m.metrik[k].label, rumus: m.metrik[k].rumus, penjelasan: m.metrik[k].penjelasan, grafik: m.metrik[k].grafik !== false }));
    state._paramJenis = clone(m.parameter || {});
    const g = { STAT_DESKRIPTIF: 'BAR', REKAP_KATEGORI: 'BAR', TREN_WAKTU: 'LINE', PROPORSI: 'DOUGHNUT', PERINGKAT: 'BAR_H' }[kode];
    if (dariUser) $('jenisGrafik').value = g;
  }
  const p = state._paramJenis || {};
  const keb = m.kebutuhan.map(k => state.mesin.labelKebutuhan[k]).join(', ');
  let html = '<div class="alert-glass alert-info-glass small mb-0"><i class="bi bi-info-circle me-1"></i>Mesin ini membutuhkan: <b>' + esc(keb) + '</b>.</div>';
  if (kode === 'TREN_WAKTU') html += '<div class="row g-3 mt-1"><div class="col-md-4"><label class="form-label small">Periode bawaan</label><select class="form-select select-glass" id="jpPeriode">' + ['hari', 'bulan', 'tahun'].map(x => '<option value="' + x + '"' + ((p.periode || 'bulan') === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div></div>';
  if (kode === 'PERINGKAT') html += '<div class="row g-3 mt-1"><div class="col-md-4"><label class="form-label small">Jumlah peringkat bawaan</label><input type="number" class="form-control input-pill" id="jpN" min="1" max="100" value="' + (p.n || 10) + '"></div><div class="col-md-4"><label class="form-label small">Urutan bawaan</label><select class="form-select select-glass" id="jpUrutan"><option value="tertinggi">Tertinggi</option><option value="terendah"' + (p.urutan === 'terendah' ? ' selected' : '') + '>Terendah</option></select></div></div>';
  $('jenisParamWrap').innerHTML = html;
  renderItemJenis();
}

function renderItemJenis() {
  const kode = $('jenisMesin').value, m = state.mesin.mesin[kode];
  $('itemJenisList').innerHTML = state._itemJenis.map((it, i) =>
    '<div class="item-row"><div class="row g-2 align-items-end">' +
      '<div class="col-md-3"><label class="form-label small">Metrik</label><select class="form-select select-glass" onchange="gantiMetrikItem(' + i + ', this.value)">' +
        Object.keys(m.metrik).map(k => '<option value="' + k + '"' + (it.metrik === k ? ' selected' : '') + '>' + esc(m.metrik[k].label) + ' (' + k + ')</option>').join('') + '</select></div>' +
      '<div class="col-md-3"><label class="form-label small">Label tampil</label><input class="form-control input-pill" value="' + esc(it.label) + '" maxlength="60" oninput="state._itemJenis[' + i + '].label=this.value"></div>' +
      '<div class="col-md-5"><label class="form-label small">Penjelasan</label><input class="form-control input-pill" value="' + esc(it.penjelasan) + '" maxlength="300" oninput="state._itemJenis[' + i + '].penjelasan=this.value"></div>' +
      '<div class="col-md-1 text-end"><button type="button" class="btn-icon sm glass danger" title="Hapus item" onclick="hapusItemJenis(' + i + ')"><i class="bi bi-trash"></i></button></div>' +
      '<div class="col-12"><label class="form-label small">Template rumus</label><textarea class="form-control textarea-glass font-mono" rows="1" maxlength="500" oninput="state._itemJenis[' + i + '].rumus=this.value">' + esc(it.rumus) + '</textarea></div>' +
      (kode === 'STAT_DESKRIPTIF' ? '<div class="col-12"><div class="form-check"><input class="form-check-input" type="checkbox" id="itg' + i + '"' + (it.grafik !== false ? ' checked' : '') + ' onchange="state._itemJenis[' + i + '].grafik=this.checked"><label class="form-check-label small" for="itg' + i + '">Tampilkan di grafik</label></div></div>' : '') +
    '</div></div>'
  ).join('') || '<p class="small text-muted-2">Belum ada item. Klik "Tambah Item".</p>';
}

function gantiMetrikItem(i, k) {
  const d = state.mesin.mesin[$('jenisMesin').value].metrik[k];
  state._itemJenis[i] = { metrik: k, label: d.label, rumus: d.rumus, penjelasan: d.penjelasan, grafik: d.grafik !== false };
  renderItemJenis();
}
function tambahItemJenis() {
  const m = state.mesin.mesin[$('jenisMesin').value];
  const pakai = state._itemJenis.map(x => x.metrik);
  const k = Object.keys(m.metrik).find(x => pakai.indexOf(x) < 0) || Object.keys(m.metrik)[0];
  state._itemJenis.push({ metrik: k, label: m.metrik[k].label, rumus: m.metrik[k].rumus, penjelasan: m.metrik[k].penjelasan, grafik: m.metrik[k].grafik !== false });
  renderItemJenis();
}
function hapusItemJenis(i) { state._itemJenis.splice(i, 1); renderItemJenis(); }

function bacaFormJenis() {
  const kode = $('jenisMesin').value, parameter = {};
  if ($('jpPeriode')) parameter.periode = $('jpPeriode').value;
  if ($('jpN')) { parameter.n = Number($('jpN').value) || 10; parameter.urutan = $('jpUrutan').value; }
  return {
    id: $('jenisId').value || null, nama: $('jenisNama').value.trim(), deskripsi: $('jenisDeskripsi').value.trim(), ikon: $('jenisIkon').value,
    urutan: Number($('jenisUrutan').value) || 1, kodeMesin: kode, jenisGrafik: $('jenisGrafik').value, status: $('jenisStatus').value,
    parameter, item: state._itemJenis
  };
}
function validasiFormJenis(d) {
  if (!d.nama) { $('jenisNama').focus(); return 'Nama jenis analisis wajib diisi.'; }
  if (!d.item.length) return 'Tambahkan minimal satu item rumus.';
  const salah = d.item.find(it => !/^=/.test((it.rumus || '').trim()));
  if (salah) return 'Rumus untuk "' + salah.label + '" harus diawali tanda "=".';
  return '';
}

function ujiJenis() {
  const d = bacaFormJenis(), err = validasiFormJenis(d);
  if (err) return showToast('warning', 'Periksa form', err);
  const btn = $('btnUjiJenis');
  setBusy(btn, true, 'Menguji...');
  api('apiUjiJenis', state.token, d).then(r => {
    $('ujiHasilWrap').innerHTML = '<div class="alert-glass alert-info-glass small mb-2"><i class="bi bi-check-circle me-1"></i>' + esc(r.keterangan) + '</div><div id="ujiInner"></div>';
    renderHasil('ujiInner', 'uji', r.hasil, { namaSheet: 'Penjualan' }, false, { tanpaMeta: true, tanpaGrafik: true });
    $('ujiHasilWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }).catch(toastError).finally(() => setBusy(btn, false));
}

function simpanJenis() {
  const d = bacaFormJenis(), err = validasiFormJenis(d);
  if (err) return showToast('warning', 'Periksa form', err);
  const btn = $('btnSimpanJenis');
  setBusy(btn, true, 'Menyimpan...');
  apiPesan('apiSimpanJenis', state.token, d).then(({ message }) => {
    modal('modalJenis').hide();
    showToast('success', 'Tersimpan', message);
    loadJenisAdmin(); segarkanJenisAktif();
  }).catch(toastError).finally(() => setBusy(btn, false));
}

// ════════════════════════════════════════════════════════
// BAGIAN 13: ADMIN — PENGGUNA
// ════════════════════════════════════════════════════════
function loadPengguna() {
  $('penggunaBody').innerHTML = '<tr><td colspan="7"><div class="skeleton"></div></td></tr>';
  api('apiGetPengguna', state.token).then(list => { state.pengguna = list; renderPengguna(); }).catch(toastError);
}

function renderPengguna() {
  const q = $('penggunaCari').value.toLowerCase();
  const list = state.pengguna.filter(u => !q || (u.nama + ' ' + u.email).toLowerCase().indexOf(q) >= 0);
  $('penggunaBody').innerHTML = list.length ? list.map(u =>
    '<tr><td><div class="d-flex align-items-center gap-2"><div class="avatar sm">' + esc((u.nama || '?').charAt(0).toUpperCase()) + '</div><div><div class="fw-medium">' + esc(u.nama) + (u.id === state.user.id ? ' <span class="small text-muted-2">(Anda)</span>' : '') + '</div>' +
      (u.wajibGantiSandi ? '<div class="small text-warning-2">Belum ganti sandi awal</div>' : '') + '</div></div></td>' +
    '<td class="small">' + esc(u.email) + '</td><td><span class="badge-pill ' + (u.peran === 'ADMIN' ? 'badge-b' : 'badge-n') + '">' + (u.peran === 'ADMIN' ? 'Admin' : 'Pengguna') + '</span></td>' +
    '<td class="text-center">' + u.jumlahAnalisis + '</td><td class="small text-nowrap">' + fmtTgl(u.loginTerakhir) + '</td>' +
    '<td class="text-center"><label class="switch-glass"><input type="checkbox"' + (u.status === 'AKTIF' ? ' checked' : '') + (u.id === state.user.id ? ' disabled' : '') + ' onchange="ubahStatusPengguna(\'' + u.id + '\', this)"><span></span></label></td>' +
    '<td class="text-end text-nowrap"><button class="btn-icon sm glass" title="Edit" onclick="bukaFormPengguna(\'' + u.id + '\')"><i class="bi bi-pencil"></i></button> ' +
      '<button class="btn-icon sm glass" title="Reset sandi" onclick="resetSandi(\'' + u.id + '\')"><i class="bi bi-key"></i></button></td></tr>'
  ).join('') : '<tr><td colspan="7" class="text-center text-muted-2 py-4">Tidak ada pengguna.</td></tr>';
}

function bukaFormPengguna(id) {
  const u = id ? state.pengguna.find(x => x.id === id) : null;
  $('penggunaModalJudul').textContent = u ? 'Edit Pengguna' : 'Tambah Pengguna';
  $('penggunaId').value = u ? u.id : '';
  $('penggunaNama').value = u ? u.nama : '';
  $('penggunaEmail').value = u ? u.email : '';
  $('penggunaPeran').value = u ? u.peran : 'PENGGUNA';
  $('penggunaStatus').value = u ? u.status : 'AKTIF';
  $('penggunaKirimWrap').classList.toggle('d-none', !!u);
  modal('modalPengguna').show();
}

function simpanPengguna(dataOverride) {
  const d = dataOverride || { id: $('penggunaId').value || null, nama: $('penggunaNama').value.trim(), email: $('penggunaEmail').value.trim(), peran: $('penggunaPeran').value, status: $('penggunaStatus').value, kirimEmail: $('penggunaKirimEmail').checked };
  if (!dataOverride) {
    if (!d.nama) { $('penggunaNama').focus(); return showToast('warning', 'Periksa form', 'Nama wajib diisi.'); }
    if (!$('penggunaEmail').checkValidity() || !d.email) { $('penggunaEmail').focus(); return showToast('warning', 'Periksa form', 'Format email tidak valid.'); }
  }
  const btn = dataOverride ? null : $('btnSimpanPengguna');
  setBusy(btn, true, 'Menyimpan...');
  return apiPesan('apiSimpanPengguna', state.token, d).then(({ data, message }) => {
    if (!dataOverride) modal('modalPengguna').hide();
    showToast('success', 'Tersimpan', message);
    if (data.sandi) tampilSandi(d.nama + ' (' + d.email + ')', data.sandi);
    loadPengguna();
  }).catch(e => { toastError(e); throw e; }).finally(() => setBusy(btn, false));
}

function ubahStatusPengguna(id, el) {
  const u = state.pengguna.find(x => x.id === id);
  el.disabled = true;
  simpanPengguna({ id: u.id, nama: u.nama, email: u.email, peran: u.peran, status: el.checked ? 'AKTIF' : 'NONAKTIF' })
    .catch(() => { el.checked = !el.checked; }).finally(() => el.disabled = false);
}

function resetSandi(id) {
  const u = state.pengguna.find(x => x.id === id);
  konfirmasi('Reset sandi?', 'Sandi ' + u.nama + ' akan diganti dengan sandi sementara baru dan dikirim ke ' + u.email + '. Sesi login aktifnya akan diakhiri.', 'Ya, reset', 'btn-glass-admin').then(ya => {
    if (!ya) return;
    apiPesan('apiResetSandi', state.token, id, true).then(({ data, message }) => { showToast('success', 'Sandi direset', message); tampilSandi(u.nama + ' (' + u.email + ')', data.sandi); loadPengguna(); }).catch(toastError);
  });
}

function tampilSandi(untuk, sandi) {
  $('sandiUntuk').textContent = 'Sandi sementara untuk ' + untuk + ':';
  $('sandiTampil').value = sandi;
  modal('modalSandi').show();
}

// ════════════════════════════════════════════════════════
// BAGIAN 14: ADMIN — PENGATURAN & LOG
// ════════════════════════════════════════════════════════
function loadPengaturan() {
  const p = state.pengaturan;
  $('setNama').value = p.namaAplikasi || ''; $('setPengirim').value = p.namaPengirim || ''; $('setLogo').value = p.logoUrl || '';
  $('setMaksMB').value = p.maksUkuranMB; $('setMaksBaris').value = p.maksBaris; $('setPemisah').value = p.pemisahDefault || ';';
  $('setUrlFrontend').value = p.urlFrontend || (location.protocol === 'https:' ? location.origin + location.pathname.replace(/index\.html$/, '') : '');
  $('statusSistem').innerHTML = '<div class="skeleton mb-2"></div><div class="skeleton"></div>';
  api('apiDashboard', state.token).then(d => {
    const a = d.admin || {};
    const baris = [['Pengguna aktif', a.penggunaAktif + ' dari ' + a.jumlahPengguna], ['Jenis analisis aktif', a.jenisAktif], ['Total hasil tersimpan', d.kpi.totalAnalisis],
      ['Sisa kuota email hari ini', '<b class="' + (a.sisaKuotaEmail < 10 ? 'text-danger-2' : 'text-success-2') + '">' + a.sisaKuotaEmail + '</b> penerima'], ['Email gagal (total)', d.kpi.emailGagal]];
    $('statusSistem').innerHTML = baris.map(b => '<div class="d-flex justify-content-between py-2 border-soft"><span class="text-muted-2">' + b[0] + '</span><span>' + b[1] + '</span></div>').join('');
  }).catch(toastError);
}

function simpanPengaturan(ev) {
  ev.preventDefault();
  const d = { namaAplikasi: $('setNama').value.trim(), namaPengirim: $('setPengirim').value.trim(), logoUrl: $('setLogo').value.trim(), maksUkuranMB: $('setMaksMB').value, maksBaris: $('setMaksBaris').value, pemisahDefault: $('setPemisah').value, urlFrontend: $('setUrlFrontend').value.trim() };
  if (!d.namaAplikasi) return showToast('warning', 'Periksa form', 'Nama aplikasi wajib diisi.');
  if (d.urlFrontend && !/^https:\/\//.test(d.urlFrontend)) return showToast('warning', 'Periksa form', 'URL aplikasi harus diawali https://');
  if (d.logoUrl && !/^https:\/\//.test(d.logoUrl)) return showToast('warning', 'Periksa form', 'URL logo harus diawali https://');
  const btn = ev.target.querySelector('button[type=submit]');
  setBusy(btn, true, 'Menyimpan...');
  api('apiSimpanPengaturan', state.token, d).then(p => {
    Object.assign(state.pengaturan, p);
    terapkanBranding(state.pengaturan);
    $('batasFileInfo').textContent = 'Format .xlsx, .xls, .csv · maks. ' + p.maksUkuranMB + ' MB · maks. ' + Number(p.maksBaris).toLocaleString('id-ID') + ' baris';
    showToast('success', 'Tersimpan', 'Pengaturan aplikasi diperbarui.');
  }).catch(toastError).finally(() => setBusy(btn, false));
}

function loadLog(jenis) {
  const body = jenis === 'EMAIL' ? 'logEmailBody' : 'logAktBody';
  $(body).innerHTML = '<tr><td colspan="7"><div class="skeleton"></div></td></tr>';
  api('apiGetLog', state.token, jenis).then(list => { state.log[jenis] = list; renderLog(jenis); }).catch(toastError);
}

function renderLog(jenis) {
  if (jenis === 'EMAIL') {
    const q = $('logEmailCari').value.toLowerCase(), st = $('logEmailStatus').value;
    const list = state.log.EMAIL.filter(l => (!q || (l.judul + ' ' + l.tujuan).toLowerCase().indexOf(q) >= 0) && (!st || l.status === st));
    $('logEmailBody').innerHTML = list.length ? list.map(l =>
      '<tr><td class="small text-nowrap">' + fmtTgl(l.waktu) + '</td><td class="small">' + esc(l.judul) + '</td><td class="small">v' + esc(l.versi) + '</td><td class="small">' + esc(l.tujuan) + '</td>' +
      '<td class="small">' + (l.jenis === 'EDIT' ? 'Revisi' : 'Baru') + '</td><td><span class="badge-pill ' + (l.status === 'TERKIRIM' ? 'badge-g' : 'badge-r') + '">' + esc(l.status) + '</span></td><td class="small text-muted-2">' + esc(l.pesan) +
      (l.status === 'GAGAL' ? ' <button class="btn btn-glass btn-sm ms-1" onclick="kirimUlang(\'' + l.idHasil + '\', this)">Kirim ulang</button>' : '') + '</td></tr>'
    ).join('') : '<tr><td colspan="7" class="text-center text-muted-2 py-4">Tidak ada data.</td></tr>';
  } else {
    const q = $('logAktCari').value.toLowerCase();
    const list = state.log.AKTIVITAS.filter(l => !q || (l.email + ' ' + l.aksi + ' ' + l.detail).toLowerCase().indexOf(q) >= 0);
    $('logAktBody').innerHTML = list.length ? list.map(l =>
      '<tr><td class="small text-nowrap">' + fmtTgl(l.waktu) + '</td><td class="small">' + esc(l.email) + '</td><td><span class="badge-pill badge-n">' + esc(l.aksi) + '</span></td><td class="small text-muted-2">' + esc(l.detail) + '</td></tr>'
    ).join('') : '<tr><td colspan="4" class="text-center text-muted-2 py-4">Tidak ada data.</td></tr>';
  }
}
