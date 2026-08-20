// ══════════════════════════════════════════════════════════
//  ADMIN — Approval Akun Baru (v4.0)
//  Hanya aktif kalau APP.me.role === 'admin' (dicek juga di backend)
// ══════════════════════════════════════════════════════════

/** Tampilkan nama/foto user yang sedang login di topbar */
function applyUserBadge() {
  const badge = document.getElementById('userBadge');
  if (!badge || !APP.me) return;
  const avatar = document.getElementById('userBadgeAvatar');
  const nameEl = document.getElementById('userBadgeName');
  if (APP.me.picture) { avatar.src = APP.me.picture; avatar.style.display = 'inline-block'; }
  nameEl.textContent = APP.me.name || APP.me.email;
  badge.style.display = 'flex';
}

/** Tampilkan/sembunyikan tab Approval sesuai role user yang login */
function applyAdminUI() {
  const tab = document.getElementById('tabApproval');
  if (!tab) return;
  if (APP.isAdmin) {
    tab.hidden = false;
    refreshPendingBadge();
  } else {
    tab.hidden = true;
  }
}

async function refreshPendingBadge() {
  if (!APP.isAdmin) return;
  try {
    const r = await api('getPendingUsers', {});
    const badge = document.getElementById('pendingBadge');
    if (!badge) return;
    const count = Array.isArray(r) ? r.length : 0;
    if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
    else { badge.style.display = 'none'; }
  } catch (e) { /* diam-diam gagal, tidak ganggu UI utama */ }
}

async function loadApprovalSettings() {
  if (!APP.isAdmin) return;
  showLoader('Memuat data user...');
  try {
    const [pending, all] = await Promise.all([
      api('getPendingUsers', {}),
      api('getAllUsers', {})
    ]);
    renderPendingUsers(Array.isArray(pending) ? pending : []);
    renderAllUsers(Array.isArray(all) ? all : []);
  } catch (e) {
    showToast('❌ Gagal memuat data user: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
}

function renderPendingUsers(list) {
  const el = document.getElementById('pendingUsersList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt2);font-size:12px;">Tidak ada pendaftar baru yang menunggu persetujuan.</div>';
    return;
  }
  el.innerHTML = list.map(u => `
    <div class="pending-row">
      <div style="display:flex;align-items:center;gap:10px;">
        ${u.picture ? `<img src="${u.picture}" alt="">` : ''}
        <div>
          <div style="font-weight:700;font-size:12.5px;">${u.name || u.email}</div>
          <div style="font-size:11px;color:var(--txt2);">${u.email} · daftar ${u.daftar || '-'}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-gold btn-sm" onclick="adminApprove('${u.email}')">✅ Approve</button>
        <button class="btn btn-danger btn-sm" onclick="adminReject('${u.email}')">✕ Tolak</button>
      </div>
    </div>
  `).join('');
}

function renderAllUsers(list) {
  const el = document.getElementById('allUsersBody');
  if (!el) return;
  const statusBadge = s => ({
    active:   '<span style="color:var(--c-green2);font-weight:700;">Aktif</span>',
    pending:  '<span style="color:var(--c-gold);font-weight:700;">Pending</span>',
    rejected: '<span style="color:var(--c-red2);font-weight:700;">Ditolak</span>',
    inactive: '<span style="color:var(--txt2);font-weight:700;">Nonaktif</span>'
  }[s] || s);

  el.innerHTML = list.map(u => `
    <tr>
      <td>${u.email}</td>
      <td>${u.name || '-'}</td>
      <td>${u.role === 'admin' ? '👑 Admin' : 'Member'}</td>
      <td>${statusBadge(u.status)}</td>
      <td>${u.daftar || '-'}</td>
      <td style="white-space:nowrap;">
        ${u.role === 'admin' ? '<span style="color:var(--txt2);font-size:11px;">—</span>' : (
          u.status === 'active'
            ? `<button class="btn btn-ghost btn-sm" onclick="adminSetStatus('${u.email}','inactive')">Nonaktifkan</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="adminSetStatus('${u.email}','active')">Aktifkan</button>`
        )}
      </td>
    </tr>
  `).join('');
}

async function adminApprove(email) {
  if (!confirm('Setujui akun ' + email + '? User akan dapat email notifikasi dan spreadsheet pribadi otomatis dibuatkan.')) return;
  showLoader('Menyetujui user...');
  try {
    const r = await api('approveUser', { email });
    if (r.error) throw new Error(r.error);
    showToast('✅ ' + email + ' disetujui!');
    await loadApprovalSettings();
  } catch (e) {
    showToast('❌ Gagal approve: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
}

async function adminReject(email) {
  if (!confirm('Tolak pendaftaran ' + email + '?')) return;
  showLoader('Memproses...');
  try {
    const r = await api('rejectUser', { email });
    if (r.error) throw new Error(r.error);
    showToast('🚫 ' + email + ' ditolak.', 'info');
    await loadApprovalSettings();
  } catch (e) {
    showToast('❌ Gagal menolak: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
}

async function adminSetStatus(email, status) {
  const label = status === 'active' ? 'mengaktifkan' : 'menonaktifkan';
  if (!confirm('Yakin ' + label + ' akun ' + email + '?')) return;
  showLoader('Memproses...');
  try {
    const r = await api('setUserStatus', { email, status });
    if (r.error) throw new Error(r.error);
    showToast('✅ Status ' + email + ' diubah.');
    await loadApprovalSettings();
  } catch (e) {
    showToast('❌ Gagal ubah status: ' + e.message, 'error');
  } finally {
    hideLoader();
  }
}

// Muat data approval otomatis begitu tab-nya dibuka
const _origShowSettingsSec = showSettingsSec;
showSettingsSec = function (id, el) {
  _origShowSettingsSec(id, el);
  if (id === 'approval') loadApprovalSettings();
};

// ── Logout ──────────────────────────────────────────────────
function logout() {
  if (!confirm('Keluar dari akun ini?')) return;
  clearAuth();
  location.href = 'login.html';
}
