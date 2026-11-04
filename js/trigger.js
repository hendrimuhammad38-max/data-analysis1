/**
 * ============================================================
 * DATA ANALYSIS — Upgrade: Trigger Otomatis (frontend)
 * File TAMBAHAN; memakai helper yang sudah ada di JavaScript.html
 * (api, apiPesan, setBusy, showToast, konfirmasi, modal, esc, fmtTgl, state).
 * ============================================================
 */
const trg = { data: null, aksiDipilih: null };

// Tambahkan rute "trigger" ke navigasi tanpa mengubah navigateTo() asli
(function () {
  const navigateAsli = navigateTo;
  navigateTo = function (section, opsi) {
    if (section !== 'trigger') return navigateAsli(section, opsi);
    if (!state.user || state.user.peran !== 'ADMIN') return navigateAsli('beranda', opsi);
    navigateAsli('trigger', { tanpaMuat: true });
    $('pageTitle').textContent = 'Trigger Otomatis';
    if (!(opsi && opsi.tanpaMuat)) loadTrigger();
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  $('triggerCari').addEventListener('input', renderTrigger);
  ['trgFrekuensi', 'trgInterval', 'trgHari', 'trgTanggal', 'trgJam'].forEach(id => $(id).addEventListener('change', perbaruiFormJadwal));
  $('trgNama').addEventListener('input', () => { $('trgNama').dataset.otomatis = ''; });
});

function loadTrigger() {
  $('triggerBody').innerHTML = [1, 2].map(() => '<tr><td colspan="5"><div class="skeleton"></div></td></tr>').join('');
  api('apiGetTrigger', state.token).then(d => { trg.data = d; renderTrigger(); }).catch(toastError);
}

const jam2 = h => ('0' + h).slice(-2) + '.00';
function badgeStatusJalan(s) {
  if (!s) return '<span class="badge-pill badge-n">Belum pernah</span>';
  const k = { BERHASIL: 'badge-g', GAGAL: 'badge-r', DILEWATI: 'badge-n' }[s] || 'badge-n';
  return '<span class="badge-pill ' + k + '">' + esc(s) + '</span>';
}

function renderTrigger() {
  const d = trg.data;
  if (!d) return;
  $('trgAktif').textContent = d.list.filter(t => t.status === 'AKTIF').length + ' / ' + d.list.length;
  $('trgKuota').innerHTML = d.terpakai + ' <small class="fs-6 text-muted-2">/ ' + d.batas + '</small>';
  $('trgZona').textContent = d.zonaWaktu;
  $('trgSistem').innerHTML = d.sistem.length ? '<i class="bi bi-gear me-1"></i>Trigger sistem (dikelola otomatis): ' + d.sistem.map(s => '<code>' + esc(s.fungsi) + '</code>').join(', ') + '.' : '';
  const q = $('triggerCari').value.toLowerCase();
  const list = d.list.filter(t => !q || (t.nama + ' ' + t.namaAksi).toLowerCase().indexOf(q) >= 0);
  $('triggerKosong').classList.toggle('d-none', d.list.length > 0);
  $('triggerBody').innerHTML = list.map(t =>
    '<tr><td><div class="d-flex align-items-center gap-2"><div class="item-icon"><i class="bi ' + esc(t.ikon) + '"></i></div><div class="min-w-0">' +
      '<div class="fw-medium">' + esc(t.nama) + '</div><div class="small text-muted-2">' + esc(t.namaAksi) + '</div>' +
      (t.terpasang === false ? '<div class="small text-danger-2"><i class="bi bi-exclamation-triangle me-1"></i>Tidak terpasang di Apps Script. <a href="#" class="link-accent" onclick="pasangUlangTrigger(\'' + t.id + '\'); return false;">Pasang ulang</a></div>' : '') +
    '</div></div></td>' +
    '<td class="small">' + esc(t.jadwal) + '</td>' +
    '<td class="small">' + badgeStatusJalan(t.statusTerakhir) + (t.terakhirJalan ? ' <span class="text-muted-2 text-nowrap">' + fmtTgl(t.terakhirJalan) + '</span>' : '') +
      (t.pesanTerakhir ? '<div class="text-muted-2 mt-1" style="max-width:320px">' + esc(t.pesanTerakhir) + '</div>' : '') + '</td>' +
    '<td class="text-center"><label class="switch-glass"><input type="checkbox"' + (t.status === 'AKTIF' ? ' checked' : '') + ' onchange="ubahStatusTrigger(\'' + t.id + '\', this)"><span></span></label></td>' +
    '<td class="text-end text-nowrap">' +
      '<button class="btn-icon sm glass" title="Jalankan sekarang (uji coba)" onclick="jalankanTriggerSekarang(\'' + t.id + '\', this)"><i class="bi bi-play-fill"></i></button> ' +
      '<button class="btn-icon sm glass" title="Edit" onclick="bukaFormTrigger(\'' + t.id + '\')"><i class="bi bi-pencil"></i></button> ' +
      '<button class="btn-icon sm glass danger" title="Hapus" onclick="hapusTrigger(\'' + t.id + '\')"><i class="bi bi-trash"></i></button></td></tr>'
  ).join('') || (d.list.length ? '<tr><td colspan="5" class="text-center text-muted-2 py-4">Tidak ada trigger yang cocok.</td></tr>' : '');
}

// ── Form ──
function bukaFormTrigger(id) {
  const d = trg.data;
  if (!d) return showToast('warning', 'Tunggu sebentar', 'Data trigger belum termuat.');
  const t = id ? d.list.find(x => x.id === id) : null;
  if (!t && d.list.length >= d.maksKustom) return showToast('warning', 'Batas tercapai', 'Maksimal ' + d.maksKustom + ' trigger. Hapus trigger yang tidak dipakai.');
  $('triggerModalJudul').textContent = t ? 'Edit Trigger' : 'Tambah Trigger';
  $('trgId').value = t ? t.id : '';
  $('trgNama').value = t ? t.nama : d.aksi.LAPORAN_RINGKAS.nama;
  $('trgNama').dataset.otomatis = t ? '' : '1';
  $('trgStatus').value = t ? t.status : 'AKTIF';
  $('trgFrekuensi').innerHTML = Object.keys(d.frekuensi).map(k => '<option value="' + k + '">' + esc(d.frekuensi[k]) + '</option>').join('');
  $('trgInterval').innerHTML = d.intervalJam.map(n => '<option value="' + n + '">' + n + ' jam</option>').join('');
  $('trgHari').innerHTML = Object.keys(d.hari).map(k => '<option value="' + k + '">' + esc(d.hari[k]) + '</option>').join('');
  $('trgTanggal').innerHTML = Array.from({ length: 28 }, (_, i) => '<option value="' + (i + 1) + '">Tanggal ' + (i + 1) + '</option>').join('');
  $('trgJam').innerHTML = Array.from({ length: 24 }, (_, i) => '<option value="' + i + '">' + jam2(i) + ' – ' + jam2((i + 1) % 24) + '</option>').join('');
  $('trgFrekuensi').value = t ? t.frekuensi : 'MINGGUAN';
  $('trgInterval').value = t ? t.interval : 4;
  $('trgHari').value = t ? t.hari : 'MONDAY';
  $('trgTanggal').value = t ? t.tanggal : 1;
  $('trgJam').value = t ? t.jam : 8;
  trg.aksiDipilih = t ? t.aksi : 'LAPORAN_RINGKAS';
  trg.paramAwal = t ? t.parameter : {};
  renderAksiTrigger();
  perbaruiFormJadwal();
  modal('modalTrigger').show();
}

function renderAksiTrigger() {
  const a = trg.data.aksi;
  $('trgAksiList').innerHTML = Object.keys(a).map(k =>
    '<div class="col-md-6"><div class="glass jenis-card' + (trg.aksiDipilih === k ? ' selected' : '') + '" tabindex="0" onclick="pilihAksiTrigger(\'' + k + '\')" onkeydown="if(event.key===\'Enter\')pilihAksiTrigger(\'' + k + '\')">' +
    '<span class="check"><i class="bi bi-check-lg"></i></span><div class="jicon"><i class="bi ' + esc(a[k].ikon) + '"></i></div>' +
    '<h6>' + esc(a[k].nama) + '</h6><p>' + esc(a[k].deskripsi) + '</p></div></div>'
  ).join('');
  renderParamTrigger();
}

function pilihAksiTrigger(k) {
  trg.aksiDipilih = k;
  trg.paramAwal = {};
  if (!$('trgNama').value.trim() || $('trgNama').dataset.otomatis === '1') { $('trgNama').value = trg.data.aksi[k].nama; $('trgNama').dataset.otomatis = '1'; }
  renderAksiTrigger();
  perbaruiFormJadwal();
}

function renderParamTrigger() {
  const k = trg.aksiDipilih, p = trg.paramAwal || {};
  let html = '';
  if (k === 'LAPORAN_RINGKAS') {
    html = '<div class="row g-3"><div class="col-md-8"><label class="form-label small" for="trgPenerima">Email penerima</label>' +
      '<input class="form-control input-pill" id="trgPenerima" placeholder="Kosongkan = semua Admin aktif" value="' + esc(p.penerima || '') + '">' +
      '<div class="form-text">Pisahkan beberapa email dengan koma. Maksimal 10.</div></div>' +
      '<div class="col-md-4 d-flex align-items-center"><div class="form-check mt-md-3"><input class="form-check-input" type="checkbox" id="trgLewati"' + (p.lewatiJikaKosong !== false ? ' checked' : '') + '>' +
      '<label class="form-check-label small" for="trgLewati">Jangan kirim jika tidak ada aktivitas</label></div></div></div>';
  }
  if (k === 'KIRIM_ULANG_GAGAL') {
    html = '<div class="row g-3"><div class="col-md-6"><label class="form-label small" for="trgRentang">Cari email gagal dalam … hari terakhir</label>' +
      '<input type="number" class="form-control input-pill" id="trgRentang" min="1" max="30" value="' + (p.rentangHari || 3) + '"></div></div>';
  }
  if (k === 'CADANGAN_DB') {
    html = '<div class="row g-3"><div class="col-md-6"><label class="form-label small" for="trgSimpan">Jumlah cadangan yang disimpan</label>' +
      '<input type="number" class="form-control input-pill" id="trgSimpan" min="1" max="30" value="' + (p.simpan || 7) + '"><div class="form-text">Cadangan yang lebih lama akan dihapus otomatis.</div></div></div>';
  }
  $('trgParamWrap').innerHTML = html;
}

function perbaruiFormJadwal() {
  const f = $('trgFrekuensi').value;
  document.querySelectorAll('#formTrigger .trg-f').forEach(el => el.classList.toggle('d-none', !el.classList.contains('trg-' + f)));
  const rentang = 'antara pukul ' + jam2(Number($('trgJam').value)) + '–' + jam2((Number($('trgJam').value) + 1) % 24);
  const jadwal = f === 'JAM' ? 'setiap ' + $('trgInterval').value + ' jam'
    : f === 'HARIAN' ? 'setiap hari, ' + rentang
    : f === 'MINGGUAN' ? 'setiap ' + trg.data.hari[$('trgHari').value] + ', ' + rentang
    : 'setiap tanggal ' + $('trgTanggal').value + ', ' + rentang;
  const periode = { JAM: $('trgInterval').value + ' jam', HARIAN: '1 hari', MINGGUAN: '7 hari', BULANAN: '30 hari' }[f];
  $('trgPreview').innerHTML = '<i class="bi bi-clock me-1"></i>Aksi <b>' + esc(trg.data.aksi[trg.aksiDipilih].nama.toLowerCase()) + '</b> akan berjalan <b>' + esc(jadwal) + '</b> (' + esc(trg.data.zonaWaktu) + ').' +
    (trg.aksiDipilih === 'LAPORAN_RINGKAS' ? ' Laporan mencakup aktivitas ' + periode + ' terakhir.' : '') +
    '<br><span class="text-muted-2">Google menjalankan trigger pada waktu acak di dalam rentang jam yang dipilih.</span>';
}

function bacaFormTrigger() {
  const k = trg.aksiDipilih, parameter = {};
  if (k === 'LAPORAN_RINGKAS') { parameter.penerima = $('trgPenerima').value.trim(); parameter.lewatiJikaKosong = $('trgLewati').checked; }
  if (k === 'KIRIM_ULANG_GAGAL') parameter.rentangHari = Number($('trgRentang').value) || 3;
  if (k === 'CADANGAN_DB') parameter.simpan = Number($('trgSimpan').value) || 7;
  return {
    id: $('trgId').value || null, nama: $('trgNama').value.trim(), aksi: k, status: $('trgStatus').value,
    frekuensi: $('trgFrekuensi').value, interval: Number($('trgInterval').value), jam: Number($('trgJam').value),
    hari: $('trgHari').value, tanggal: Number($('trgTanggal').value), parameter
  };
}

function simpanTrigger() {
  const d = bacaFormTrigger();
  if (!d.nama) { $('trgNama').focus(); return showToast('warning', 'Periksa form', 'Nama trigger wajib diisi.'); }
  if (d.parameter.penerima) {
    const salah = d.parameter.penerima.split(/[,;\s]+/).filter(Boolean).find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (salah) return showToast('warning', 'Periksa form', 'Email penerima tidak valid: ' + salah);
  }
  const btn = $('btnSimpanTrigger');
  setBusy(btn, true, 'Menyimpan...');
  apiPesan('apiSimpanTrigger', state.token, d).then(({ message }) => {
    modal('modalTrigger').hide();
    $('trgNama').dataset.otomatis = '';
    showToast('success', 'Trigger tersimpan', message);
    loadTrigger();
  }).catch(toastError).finally(() => setBusy(btn, false));
}

// ── Aksi baris ──
function ubahStatusTrigger(id, el) {
  el.disabled = true;
  apiPesan('apiStatusTrigger', state.token, id, el.checked ? 'AKTIF' : 'NONAKTIF')
    .then(({ message }) => { showToast('success', 'Status diperbarui', message); loadTrigger(); })
    .catch(e => { el.checked = !el.checked; toastError(e); }).finally(() => el.disabled = false);
}
function pasangUlangTrigger(id) {
  apiPesan('apiStatusTrigger', state.token, id, 'AKTIF').then(({ message }) => { showToast('success', 'Terpasang ulang', message); loadTrigger(); }).catch(toastError);
}
function jalankanTriggerSekarang(id, btn) {
  const t = trg.data.list.find(x => x.id === id);
  konfirmasi('Jalankan sekarang?', 'Aksi "' + t.namaAksi + '" akan dijalankan saat ini juga sebagai uji coba. Jadwal tetap berlaku seperti biasa.', 'Ya, jalankan', 'btn-glass-admin').then(ya => {
    if (!ya) return;
    setBusy(btn, true, '');
    apiPesan('apiJalankanTriggerSekarang', state.token, id)
      .then(({ data }) => { showToast(data.status === 'DILEWATI' ? 'info' : 'success', data.status === 'DILEWATI' ? 'Dilewati' : 'Selesai dijalankan', data.pesan, 7000); loadTrigger(); })
      .catch(e => { toastError(e); loadTrigger(); }).finally(() => setBusy(btn, false));
  });
}
function hapusTrigger(id) {
  const t = trg.data.list.find(x => x.id === id);
  konfirmasi('Hapus trigger?', 'Trigger "' + t.nama + '" akan dihapus dan tidak akan berjalan lagi.', 'Ya, hapus').then(ya => {
    if (!ya) return;
    api('apiHapusTrigger', state.token, id).then(() => { showToast('success', 'Dihapus', 'Trigger telah dihapus.'); loadTrigger(); }).catch(toastError);
  });
}
