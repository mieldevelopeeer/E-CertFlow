const SUPABASE_URL = 'https://egzmtpkkrljolfqfxoph.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OVw6qNttAE8Iop48_B3vkg_rOEBbenf';
const API_URL = new URL('api/send-email', window.location.href).pathname;
const STORAGE_BUCKET = 'attachments';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let credentials = [];
let globalAttachmentFile = null;
let isSending = false;
let allSendLogs = [];
let logFilter = 'sent';
let editingCredId = null;
let storageBucketOk = null;

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg, type = '') {
  const toastDiv = document.getElementById('toast');
  document.getElementById('toastMsg').innerText = msg;
  toastDiv.className = 'toast show' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
  setTimeout(() => toastDiv.classList.remove('show', 'ok', 'err'), 3200);
}

function navigate(page) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach((n) => n.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  if (page === 'logs') loadLogs();
  if (page === 'credentials') loadCredentials();
}

async function testConnection() {
  try {
    const { error } = await supabaseClient.from('credentials').select('id').limit(1);
    document.getElementById('dbStatus').className = 'status-dot ' + (error ? 'err' : 'ok');
    document.getElementById('dbStatusText').textContent = error ? 'error' : 'connected';
  } catch {
    document.getElementById('dbStatus').className = 'status-dot err';
    document.getElementById('dbStatusText').textContent = 'error';
  }
}

// ── Credentials ─────────────────────────────────────────────
function getCredPhotoUrl(c) {
  if (c?.photo_url) return c.photo_url;
  if (c?.email) return `https://unavatar.io/google/${encodeURIComponent(c.email)}`;
  return null;
}
function getCredDisplayName(c) {
  return (c?.display_name || c?.label || '').trim() || (c?.email || 'Unknown');
}
function credInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function updateCredPreview() {
  const email = document.getElementById('credEmail')?.value.trim() || 'email@gmail.com';
  const name = document.getElementById('credDisplayName')?.value.trim() || 'Your Gmail name';
  const photoInput = document.getElementById('credPhotoUrl')?.value.trim();
  const img = document.getElementById('credPreviewImg');
  const initials = document.getElementById('credPreviewInitials');
  document.getElementById('credPreviewName').textContent = name;
  document.getElementById('credPreviewEmail').textContent = email;
  initials.textContent = credInitials(name);
  initials.hidden = false;
  const photo = photoInput || (email.includes('@') ? `https://unavatar.io/google/${encodeURIComponent(email)}` : '');
  if (photo && img) {
    img.src = photo;
    img.hidden = false;
    img.onerror = () => { img.hidden = true; initials.hidden = false; };
    img.onload = () => { initials.hidden = true; };
  } else if (img) img.hidden = true;
}

function resetCredForm() {
  editingCredId = null;
  document.getElementById('credFormTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Add credential';
  document.getElementById('credSaveLabel').textContent = 'Save credential';
  document.getElementById('credCancelBtn').hidden = true;
  document.getElementById('credDisplayName').value = '';
  document.getElementById('credLabel').value = '';
  document.getElementById('credEmail').value = '';
  document.getElementById('credPhotoUrl').value = '';
  document.getElementById('credPass').value = '';
  document.getElementById('credPass').placeholder = 'Gmail App Password (16 characters)';
  updateCredPreview();
}

function editCred(id) {
  const c = credentials.find((x) => x.id === id);
  if (!c) return;
  editingCredId = id;
  document.getElementById('credFormTitle').innerHTML = '<i class="fas fa-pen"></i> Update credential';
  document.getElementById('credSaveLabel').textContent = 'Update credential';
  document.getElementById('credCancelBtn').hidden = false;
  document.getElementById('credDisplayName').value = c.display_name || c.label || '';
  document.getElementById('credLabel').value = '';
  document.getElementById('credEmail').value = c.email || '';
  document.getElementById('credPhotoUrl').value = c.photo_url || '';
  document.getElementById('credHost').value = c.smtp_host || 'smtp.gmail.com';
  document.getElementById('credPort').value = c.smtp_port || 465;
  document.getElementById('credPass').value = '';
  document.getElementById('credPass').placeholder = 'Leave blank to keep current password';
  updateCredPreview();
  navigate('credentials');
  document.querySelector('.cred-form-card')?.scrollIntoView({ behavior: 'smooth' });
}

function cancelCredEdit() {
  resetCredForm();
}

function parseGoogleJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(base64).split('').map((c) =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')));
  } catch { return null; }
}

function handleGoogleCredential(response) {
  const payload = parseGoogleJwt(response.credential);
  if (!payload) return toast('Could not read Google profile', 'err');
  document.getElementById('credEmail').value = payload.email || '';
  document.getElementById('credDisplayName').value = payload.name || '';
  document.getElementById('credPhotoUrl').value = payload.picture || '';
  updateCredPreview();
  toast('Google profile loaded — add App Password and save', 'ok');
}

async function initGoogleSignIn() {
  const wrap = document.getElementById('googleSignInWrap');
  if (!wrap) return;
  try {
    const res = await fetch(new URL('api/public-config.php', window.location.href).href);
    const { googleClientId } = await res.json();
    if (!googleClientId) return;
    const start = () => {
      if (!window.google?.accounts?.id) { setTimeout(start, 150); return; }
      wrap.hidden = false;
      google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential });
      google.accounts.id.renderButton(document.getElementById('googleSignInBtn'), {
        theme: 'outline', size: 'medium', text: 'continue_with', shape: 'pill', width: 280,
      });
    };
    start();
  } catch { /* optional */ }
}

async function saveCred() {
  const displayName = document.getElementById('credDisplayName').value.trim();
  const email = document.getElementById('credEmail').value.trim();
  const extraLabel = document.getElementById('credLabel').value.trim();
  const label = displayName || extraLabel || email;
  const host = document.getElementById('credHost').value.trim();
  const port = parseInt(document.getElementById('credPort').value, 10);
  const pass = document.getElementById('credPass').value;

  if (!email || !host) return toast('Email and SMTP host are required', 'err');

  const row = {
    label,
    email,
    smtp_host: host,
    smtp_port: port,
  };
  if (pass) row.app_password = pass;

  let error;
  if (editingCredId) {
    if (!pass) delete row.app_password;
    ({ error } = await supabaseClient.from('credentials').update(row).eq('id', editingCredId));
  } else {
    if (!pass) return toast('App Password is required for new credentials', 'err');
    ({ error } = await supabaseClient.from('credentials').insert(row));
  }

  if (error) {
    return toast('Error: ' + error.message, 'err');
  }
  toast(editingCredId ? 'Credential updated ✓' : 'Credential saved ✓', 'ok');
  resetCredForm();
  await loadCredentials();
}

async function loadCredentials() {
  const { data } = await supabaseClient.from('credentials').select('*').order('created_at', { ascending: false });
  credentials = data || [];
  renderCredList();
  renderCredSelect();
}

function renderCredList() {
  const el = document.getElementById('credList');
  if (!credentials.length) {
    el.innerHTML = '<div class="empty-state">No credentials yet.</div>';
    return;
  }
  el.innerHTML = credentials.map((c) => {
    const photo = getCredPhotoUrl(c);
    const name = getCredDisplayName(c);
    return `
    <div class="cred-card">
      <img class="avatar" src="${escapeHtml(photo)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false" />
      <div class="avatar avatar--initials" hidden>${escapeHtml(credInitials(name))}</div>
      <div class="cred-card__body">
        <strong>${escapeHtml(name)}</strong>
        <span class="muted">${escapeHtml(c.email)}</span>
      </div>
      <div class="btn-group">
        <button type="button" class="btn-outline btn-sm" onclick="editCred('${c.id}')"><i class="fas fa-pen"></i> Edit</button>
        <button type="button" class="btn-danger btn-sm" onclick="deleteCred('${c.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function renderCredSelect() {
  const sel = document.getElementById('credSelect');
  sel.innerHTML = '<option value="">— select sender —</option>' +
    credentials.map((c) => `<option value="${c.id}">${escapeHtml(getCredDisplayName(c))} (${escapeHtml(c.email)})</option>`).join('');
}

async function deleteCred(id) {
  if (!confirm('Delete this credential?')) return;
  const { error } = await supabaseClient.from('credentials').delete().eq('id', id);
  if (error) return toast('Error: ' + error.message, 'err');
  if (editingCredId === id) resetCredForm();
  await loadCredentials();
  toast('Deleted ✓', 'ok');
}

// ── Recipients & compose ────────────────────────────────────
function bindRecipFileInput(row) {
  const input = row.querySelector('.recip-file-input');
  const hint = row.querySelector('.recip-file-hint');
  if (!input || !hint) return;
  input.addEventListener('change', () => {
    const f = input.files[0];
    if (f) {
      hint.innerHTML = `<span class="file-chip file-chip--sm"><i class="fas fa-paperclip"></i> ${escapeHtml(f.name)}</span>`;
    } else {
      hint.innerHTML = '<span class="muted">No file</span>';
    }
  });
}

function addRecipRow(name = '', email = '') {
  const tbody = document.getElementById('recipBody');
  const row = document.createElement('tr');
  row.className = 'recip-row';
  row.innerHTML = `
    <td><input type="text" placeholder="Full name" value="${escapeHtml(name)}" /></td>
    <td><input type="email" placeholder="email@example.com" value="${escapeHtml(email)}" /></td>
    <td class="col-attach-cell">
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" class="recip-file-input input-file" />
      <div class="recip-file-hint muted">No file</div>
    </td>
    <td><button type="button" class="btn-ghost btn-sm" onclick="delRow(this)"><i class="fas fa-times"></i></button></td>`;
  tbody.appendChild(row);
  bindRecipFileInput(row);
  updateRecipCount();
}

function delRow(btn) {
  btn.closest('tr').remove();
  updateRecipCount();
}

function updateRecipCount() {
  document.getElementById('recipCount').textContent = document.querySelectorAll('#recipBody .recip-row').length;
}

function getRecipientsWithFiles() {
  return Array.from(document.querySelectorAll('#recipBody .recip-row')).map((row) => {
    const inputs = row.querySelectorAll('input');
    const fileInput = row.querySelector('.recip-file-input');
    return {
      name: inputs[0]?.value.trim() || '',
      email: inputs[1]?.value.trim() || '',
      attachmentFile: fileInput?.files[0] || null,
    };
  }).filter((r) => r.email);
}

function importCSV() {
  document.getElementById('csvInput').click();
}

document.getElementById('csvInput')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const lines = ev.target.result.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return toast('CSV needs header + rows', 'err');
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = headers.findIndex((h) => h.includes('name'));
    const emailIdx = headers.findIndex((h) => h.includes('email'));
    if (emailIdx === -1) return toast('CSV must have email column', 'err');
    document.getElementById('recipBody').innerHTML = '';
    lines.slice(1).forEach((line) => {
      const parts = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      addRecipRow(nameIdx !== -1 ? parts[nameIdx] : '', parts[emailIdx] || '');
    });
    toast(`Imported ${lines.length - 1} rows ✓`, 'ok');
    updateRecipCount();
  };
  reader.readAsText(file);
  e.target.value = '';
});

function setupGlobalDrop() {
  const zone = document.getElementById('globalDropArea');
  const inp = document.getElementById('globalFileInput');
  if (!zone) return;
  zone.addEventListener('click', () => inp.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drop-zone--active'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drop-zone--active'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drop-zone--active');
    if (e.dataTransfer.files[0]) setGlobalFile(e.dataTransfer.files[0]);
  });
  inp.addEventListener('change', () => { if (inp.files[0]) setGlobalFile(inp.files[0]); });
}

function setGlobalFile(file) {
  globalAttachmentFile = file;
  document.getElementById('globalFilePreview').innerHTML = `
    <span class="file-chip"><i class="fas fa-paperclip"></i> ${escapeHtml(file.name)}
      <button type="button" class="file-chip__x" onclick="clearGlobalFile()">×</button></span>`;
}

function clearGlobalFile() {
  globalAttachmentFile = null;
  document.getElementById('globalFilePreview').innerHTML = '';
  document.getElementById('globalFileInput').value = '';
}

async function checkStorageBucket() {
  if (storageBucketOk !== null) return storageBucketOk;
  try {
    const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).list('', { limit: 1 });
    storageBucketOk = !error || !/not found|does not exist/i.test(error.message);
  } catch {
    storageBucketOk = false;
  }
  return storageBucketOk;
}

async function uploadToStorage(file, folder) {
  if (!file) return { name: null, url: null, stored: false };
  const ok = await checkStorageBucket();
  if (!ok) {
    return { name: file.name, url: null, stored: false };
  }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}-${safe}`;
  const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) {
    console.warn('Storage upload:', error.message);
    return { name: file.name, url: null, stored: false };
  }
  const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { name: file.name, url: data.publicUrl, stored: true };
}

function personalize(text, r) {
  let out = text;
  ['name', 'email'].forEach((field) => {
    out = out.replace(new RegExp(`{{${field}}}`, 'gi'), r[field] || '');
  });
  return out;
}

async function sendOneEmail({ credId, to, toName, subject, body, globalFile, recipFile, globalMeta, recipMeta }) {
  const formData = new FormData();
  formData.append('credentialId', credId);
  formData.append('to', to);
  formData.append('toName', toName || '');
  formData.append('subject', subject);
  formData.append('body', body);

  if (globalFile) formData.append('globalAttachment', globalFile, globalFile.name);
  else if (globalMeta?.url) {
    formData.append('globalAttachmentUrl', globalMeta.url);
    formData.append('globalAttachmentName', globalMeta.name || '');
  }
  if (recipFile) formData.append('perRecipAttachment', recipFile, recipFile.name);
  else if (recipMeta?.url) {
    formData.append('recipAttachmentUrl', recipMeta.url);
    formData.append('recipAttachmentName', recipMeta.name || '');
  }

  const resp = await fetch(API_URL, { method: 'POST', body: formData });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.success) throw new Error(json.error || 'Send failed');
  return true;
}

async function sendEmails() {
  if (isSending) return toast('Already sending…', 'err');
  const credId = document.getElementById('credSelect').value;
  const subject = document.getElementById('emailSubject').value.trim();
  const body = document.getElementById('emailBody').value.trim();
  if (!credId) return toast('Select a sender', 'err');
  if (!subject || !body) return toast('E-Certificate subject and message are required', 'err');
  const recipients = getRecipientsWithFiles();
  if (!recipients.length) return toast('Add recipients', 'err');

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  document.getElementById('sendLabel').textContent = 'Sending…';
  isSending = true;

  const progressWrap = document.getElementById('progressWrap');
  const fill = document.getElementById('progressBarFill');
  const progText = document.getElementById('progressText');
  progressWrap.hidden = false;

  let sentCount = 0;
  let failedCount = 0;
  let globalMeta = { name: null, url: null, stored: false };
  if (globalAttachmentFile) {
    globalMeta = await uploadToStorage(globalAttachmentFile, 'global');
  }

  for (let idx = 0; idx < recipients.length; idx++) {
    const r = recipients[idx];
    const recipientName = r.name || 'Valued Member';
    const personalSubject = personalize(subject, r);
    const personalBody = `Dear ${recipientName},\n\n${personalize(body, r)}`;

    let recipMeta = { name: null, url: null, stored: false };
    if (r.attachmentFile) {
      recipMeta = await uploadToStorage(r.attachmentFile, `recip/${r.email.replace(/[^a-z0-9]/gi, '_')}`);
    }

    let status = 'failed';
    let errorMsg = null;

    try {
      await sendOneEmail({
        credId,
        to: r.email,
        toName: r.name,
        subject: personalSubject,
        body: personalBody,
        globalFile: !globalMeta.url ? globalAttachmentFile : null,
        recipFile: !recipMeta.url ? r.attachmentFile : null,
        globalMeta,
        recipMeta,
      });
      status = 'sent';
      sentCount++;
    } catch (err) {
      errorMsg = err.message;
      failedCount++;
    }

    const logRow = {
      credential_id: credId,
      recipient_email: r.email,
      recipient_name: r.name,
      subject: personalSubject,
      body: personalBody,
      status,
      error_msg: errorMsg,
      global_attachment_name: globalMeta.name || (globalAttachmentFile?.name ?? null),
      global_attachment_url: globalMeta.url,
      recip_attachment_name: recipMeta.name || (r.attachmentFile?.name ?? null),
      recip_attachment_url: recipMeta.url,
    };

    const { error: logErr } = await supabaseClient.from('send_logs').insert(logRow);
    if (logErr) console.warn('Log insert:', logErr.message);

    fill.style.width = `${((idx + 1) / recipients.length) * 100}%`;
    progText.textContent = `${idx + 1} / ${recipients.length}`;
  }

  btn.disabled = false;
  isSending = false;
  document.getElementById('sendLabel').textContent = 'Send e-certificates';
  progressWrap.hidden = true;
  fill.style.width = '0%';
  toast(`${sentCount} sent, ${failedCount} failed`, sentCount ? 'ok' : 'err');
  await loadLogs();
  if (sentCount || failedCount) {
    logFilter = failedCount && !sentCount ? 'failed' : 'sent';
    navigate('logs');
  }
}

// ── Sent emails ───────────────────────────────────────────────
async function loadLogs() {
  const el = document.getElementById('logList');
  let { data, error } = await supabaseClient
    .from('send_logs')
    .select('*, credentials(label, email)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error && /credentials|column/i.test(error.message)) {
    ({ data, error } = await supabaseClient
      .from('send_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500));
  }

  if (error) {
    el.innerHTML = `<div class="empty-state">Could not load: ${escapeHtml(error.message)}<br><small>Run supabase-migration-v2.sql in Supabase</small></div>`;
    return;
  }
  allSendLogs = data || [];
  syncLogFilterPills();
  renderSentEmailsList();
}

function syncLogFilterPills() {
  document.querySelectorAll('.filter-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === logFilter);
  });
}

function setLogFilter(filter) {
  logFilter = filter;
  syncLogFilterPills();
  renderSentEmailsList();
}

function filterLogs() {
  renderSentEmailsList();
}

function attachmentChips(log) {
  const items = [];
  if (log.global_attachment_name) {
    items.push({
      name: log.global_attachment_name,
      url: log.global_attachment_url || null,
      label: 'All recipients',
    });
  }
  if (log.recip_attachment_name) {
    items.push({
      name: log.recip_attachment_name,
      url: log.recip_attachment_url || null,
      label: 'Per recipient',
    });
  }
  if (!items.length) return '<span class="muted"><i class="fas fa-minus"></i> None</span>';
  return items.map((a) => {
    if (a.url) {
      return `<a class="attach-chip attach-chip--saved" href="${escapeHtml(a.url)}" target="_blank" rel="noopener" title="${escapeHtml(a.label)}">
        <i class="fas fa-paperclip"></i> ${escapeHtml(a.name)} <i class="fas fa-external-link-alt" style="font-size:9px;opacity:0.7"></i></a>`;
    }
    return `<span class="attach-chip attach-chip--sent-only" title="Was sent with the email. Create Supabase Storage bucket &quot;attachments&quot; (public) to view/download later.">
      <i class="fas fa-paperclip"></i> ${escapeHtml(a.name)} <span class="attach-tag">sent</span></span>`;
  }).join('');
}

function renderSentEmailsList() {
  const el = document.getElementById('logList');
  const statsEl = document.getElementById('sentStats');
  const search = (document.getElementById('logSearch')?.value || '').trim().toLowerCase();

  const sentTotal = allSendLogs.filter((l) => l.status === 'sent').length;
  const failedTotal = allSendLogs.filter((l) => l.status === 'failed').length;

  statsEl.innerHTML = `
    <div class="stat-card stat-card--ok"><span class="stat-card__n">${sentTotal}</span><span class="stat-card__l">Delivered</span></div>
    <div class="stat-card stat-card--err"><span class="stat-card__n">${failedTotal}</span><span class="stat-card__l">Failed</span></div>
    <div class="stat-card"><span class="stat-card__n">${allSendLogs.length}</span><span class="stat-card__l">All records</span></div>`;

  let rows = allSendLogs;
  if (logFilter !== 'all') rows = rows.filter((l) => l.status === logFilter);
  if (search) {
    rows = rows.filter((l) => {
      const hay = [
        l.recipient_email, l.recipient_name, l.subject,
        l.recipient_name, l.credentials?.email, l.credentials?.label,
      ].join(' ').toLowerCase();
      return hay.includes(search);
    });
  }

  if (!allSendLogs.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No e-certificates sent yet. Use Compose to deliver.</p></div>';
    return;
  }
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-filter"></i><p>No matches.</p></div>';
    return;
  }

  el.innerHTML = `
    <div class="table-wrapper sent-table-wrap">
      <table class="data-table sent-table">
        <thead>
          <tr>
            <th>Recipient</th>
            <th>Subject</th>
            <th>Attachments</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((l) => `
            <tr class="row--${escapeHtml(l.status)}">
              <td>
                <strong>${escapeHtml(l.recipient_name || '—')}</strong>
                <div class="email-chip">${escapeHtml(l.recipient_email)}</div>
              </td>
              <td class="col-subject">${escapeHtml((l.subject || '—').slice(0, 48))}${(l.subject || '').length > 48 ? '…' : ''}</td>
              <td class="col-attach">${attachmentChips(l)}</td>
              <td>
                <span class="badge badge--${escapeHtml(l.status)}">${escapeHtml(l.status)}</span>
                ${l.error_msg ? `<div class="text-err">${escapeHtml(l.error_msg)}</div>` : ''}
              </td>
              <td class="muted nowrap">${new Date(l.created_at).toLocaleString()}</td>
              <td class="col-actions">
                <div class="btn-group">
                  <button type="button" class="btn-outline btn-sm" onclick="openEmailModal('${l.id}')" title="View / edit / resend"><i class="fas fa-eye"></i></button>
                  <button type="button" class="btn-danger btn-sm" onclick="deleteLog('${l.id}')"><i class="fas fa-trash"></i></button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="list-foot">
      <span class="muted">Showing <strong>${rows.length}</strong> of <strong>${allSendLogs.length}</strong></span>
      <button type="button" class="btn-outline btn-outline--danger btn-sm" onclick="deleteAllLogs()"><i class="fas fa-trash-alt"></i> Clear all</button>
    </div>`;
}

async function deleteLog(logId) {
  if (!confirm('Delete this record?')) return;
  const { error } = await supabaseClient.from('send_logs').delete().eq('id', logId);
  if (error) return toast(error.message, 'err');
  await loadLogs();
  toast('Deleted ✓', 'ok');
}

async function deleteAllLogs() {
  if (!confirm('Delete ALL sent email records?')) return;
  const { error } = await supabaseClient.from('send_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) return toast(error.message, 'err');
  await loadLogs();
  toast('Cleared ✓', 'ok');
}

// ── Email modal: view, edit, resend ───────────────────────────
function openEmailModal(logId) {
  const log = allSendLogs.find((l) => l.id === logId);
  if (!log) return;
  document.getElementById('modalLogId').value = logId;
  document.getElementById('modalSubject').value = log.subject || '';
  document.getElementById('modalBody').value = log.body || '';
  document.getElementById('modalError').hidden = true;

  const sender = log.credentials?.label || log.credentials?.email || '—';
  const statusLabel = log.status === 'failed' ? 'Failed' : 'Sent';
  const statusClass = log.status === 'failed' ? 'badge--failed' : 'badge--sent';
  document.getElementById('modalMeta').innerHTML = `
    <div class="modal-meta__row"><span>Recipient</span><strong>${escapeHtml(log.recipient_name || '—')} &lt;${escapeHtml(log.recipient_email)}&gt;</strong></div>
    <div class="modal-meta__row"><span>Sender</span><strong>${escapeHtml(sender)}</strong></div>
    <div class="modal-meta__row"><span>Status</span><strong><span class="badge ${statusClass}">${statusLabel}</span></strong></div>
    <div class="modal-meta__row"><span>Delivered</span><strong>${new Date(log.created_at).toLocaleString()}</strong></div>`;

  document.getElementById('modalAttachments').innerHTML = attachmentChips(log);
  document.getElementById('modalGlobalFile').value = '';
  document.getElementById('modalRecipFile').value = '';

  const modal = document.getElementById('emailModal');
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function closeEmailModal() {
  const modal = document.getElementById('emailModal');
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

function openAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function closeAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

async function saveEmailLog() {
  const logId = document.getElementById('modalLogId').value;
  const subject = document.getElementById('modalSubject').value.trim();
  const body = document.getElementById('modalBody').value.trim();
  if (!subject || !body) return toast('E-Certificate subject and message are required', 'err');

  const updates = { subject, body };
  const globalFile = document.getElementById('modalGlobalFile').files[0];
  const recipFile = document.getElementById('modalRecipFile').files[0];

  try {
    if (globalFile) {
      const g = await uploadToStorage(globalFile, 'global');
      updates.global_attachment_name = g.name;
      updates.global_attachment_url = g.url;
    }
    if (recipFile) {
      const log = allSendLogs.find((l) => l.id === logId);
      const r = await uploadToStorage(recipFile, `recip/${(log?.recipient_email || 'x').replace(/[^a-z0-9]/gi, '_')}`);
      updates.recip_attachment_name = r.name;
      updates.recip_attachment_url = r.url;
    }
  } catch (e) {
    return toast(e.message, 'err');
  }

  const { error } = await supabaseClient.from('send_logs').update(updates).eq('id', logId);
  if (error) return toast(error.message, 'err');
  toast('Saved ✓', 'ok');
  await loadLogs();
  openEmailModal(logId);
}

async function resendFromModal() {
  const logId = document.getElementById('modalLogId').value;
  let log = allSendLogs.find((l) => l.id === logId);
  if (!log) return;

  const subject = document.getElementById('modalSubject').value.trim();
  const body = document.getElementById('modalBody').value.trim();
  const credId = log.credential_id;
  if (!credId) return toast('No sender credential on this record', 'err');

  const errEl = document.getElementById('modalError');
  errEl.hidden = true;

  let globalMeta = { name: log.global_attachment_name, url: log.global_attachment_url };
  let recipMeta = { name: log.recip_attachment_name, url: log.recip_attachment_url };

  const globalFile = document.getElementById('modalGlobalFile').files[0];
  const recipFile = document.getElementById('modalRecipFile').files[0];

  try {
    if (globalFile) globalMeta = await uploadToStorage(globalFile, 'global');
    if (recipFile) {
      recipMeta = await uploadToStorage(recipFile, `recip/${log.recipient_email.replace(/[^a-z0-9]/gi, '_')}`);
    }

    await sendOneEmail({
      credId,
      to: log.recipient_email,
      toName: log.recipient_name,
      subject,
      body,
      globalMeta,
      recipMeta,
    });

    await supabaseClient.from('send_logs').update({
      subject,
      body,
      status: 'sent',
      error_msg: null,
      global_attachment_name: globalMeta.name,
      global_attachment_url: globalMeta.url,
      recip_attachment_name: recipMeta.name,
      recip_attachment_url: recipMeta.url,
    }).eq('id', logId);

    toast('Resent successfully ✓', 'ok');
    await loadLogs();
    closeEmailModal();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.hidden = false;
    await supabaseClient.from('send_logs').update({ status: 'failed', error_msg: e.message }).eq('id', logId);
    await loadLogs();
  }
}

function setupCollapsible() {
  const header = document.getElementById('settingsHeader');
  const content = document.getElementById('settingsContent');
  if (!header || !content) return;
  let collapsed = false;
  header.addEventListener('click', () => {
    collapsed = !collapsed;
    content.classList.toggle('collapsed', collapsed);
    header.classList.toggle('collapsed', collapsed);
  });
}

function logout() {
  const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
  localStorage.removeItem('certflow_authenticated');
  window.location.href = basePath + 'login.html';
}

window.addEventListener('DOMContentLoaded', async () => {
  await testConnection();
  await loadCredentials();
  await checkStorageBucket();
  await loadLogs();
  addRecipRow();
  updateRecipCount();
  setupGlobalDrop();
  setupCollapsible();
  updateCredPreview();
  document.getElementById('credEmail')?.addEventListener('input', updateCredPreview);
  document.getElementById('credDisplayName')?.addEventListener('input', updateCredPreview);
  initGoogleSignIn();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeEmailModal();
    closeAboutModal();
  }
});

Object.assign(window, {
  navigate, addRecipRow, delRow, importCSV, sendEmails, saveCred, deleteCred, editCred, cancelCredEdit,
  clearGlobalFile, deleteLog, deleteAllLogs, setLogFilter, filterLogs, handleGoogleCredential,
  openEmailModal, closeEmailModal, openAboutModal, closeAboutModal, saveEmailLog, resendFromModal, logout,
});
