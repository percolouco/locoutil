// ─── API helpers ───────────────────────────────────────────────────────────
const api = {
  get: (u) => fetch(u).then(r => r.json()),
  post: (u, b) => fetch(u, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b)}).then(r => r.status===204?null:r.json()),
  put:  (u, b) => fetch(u, {method:'PUT',  headers:{'Content-Type':'application/json'}, body:JSON.stringify(b)}).then(r => r.json()),
  del:  (u)    => fetch(u, {method:'DELETE'}),
  form: (u, fd, method='POST') => fetch(u, {method, body:fd}).then(r => r.status===204?null:r.json()),
};

// ─── State ──────────────────────────────────────────────────────────────────
let tools=[], clients=[], platforms=[], rentals=[];
let calYear = new Date().getFullYear(), calMonth = new Date().getMonth()+1;
let rentalFilter = '';

// ─── Navigation ─────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    el.classList.add('active');
    const sec = 'section-' + el.dataset.section;
    document.getElementById(sec).classList.remove('hidden');
    if (el.dataset.section === 'dashboard') loadDashboard();
    if (el.dataset.section === 'tools') loadTools();
    if (el.dataset.section === 'clients') loadClients();
    if (el.dataset.section === 'rentals') loadRentals();
    if (el.dataset.section === 'calendar') loadCalendar();
    if (el.dataset.section === 'listings') loadListings();
    if (el.dataset.section === 'settings') loadPlatforms();
  });
});

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if(e.target===m) m.classList.add('hidden'); }));

// ─── Dashboard ──────────────────────────────────────────────────────────────
async function loadDashboard() {
  const d = await api.get('/api/dashboard');
  const stats = document.getElementById('dash-stats');
  stats.innerHTML = `
    <div class="stat-card primary"><div class="stat-val">${d.active_rentals}</div><div class="stat-label">Location(s) en cours</div></div>
    <div class="stat-card success"><div class="stat-val">${fmtEuro(d.revenue_month)}</div><div class="stat-label">Revenus ce mois</div></div>
    <div class="stat-card info"><div class="stat-val">${fmtEuro(d.revenue_total)}</div><div class="stat-label">Revenus total</div></div>
    <div class="stat-card"><div class="stat-val">${d.tools_count}</div><div class="stat-label">Outils</div></div>
    <div class="stat-card"><div class="stat-val">${d.clients_count}</div><div class="stat-label">Clients</div></div>
    <div class="stat-card warning"><div class="stat-val">${d.pending_deposit_return}</div><div class="stat-label">Cautions à rendre</div></div>
  `;
  const ret = document.getElementById('dash-returning');
  if (!d.returning_soon.length) { ret.innerHTML = '<div class="empty-state">Aucun retour prévu dans les 7 jours</div>'; return; }
  ret.innerHTML = d.returning_soon.map(r => `
    <div class="return-row" onclick="openRentalDetail(${r.id})">
      <span>🔨 <strong>${r.tool_name}</strong></span>
      <span>👤 ${r.client_name}</span>
      <span>📅 Retour le ${fmtDate(r.end_date)}</span>
      <span class="badge badge-${r.status}">${statusLabel(r.status)}</span>
    </div>
  `).join('');
}

// ─── Tools ──────────────────────────────────────────────────────────────────
async function loadTools() {
  tools = await api.get('/api/tools');
  renderTools();
}

function renderTools() {
  const q = document.getElementById('tools-search').value.toLowerCase();
  const grid = document.getElementById('tools-grid');
  const filtered = tools.filter(t => t.name.toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q));
  if (!filtered.length) { grid.innerHTML = '<div class="empty-state">Aucun outil trouvé</div>'; return; }
  grid.innerHTML = filtered.map(t => {
    const img = t.main_image ? `<img class="tool-img" src="/uploads/tools/${t.main_image}" loading="lazy"/>` : `<div class="tool-img">🔧</div>`;
    return `<div class="tool-card" onclick="openToolDetail(${t.id})">
      ${img}
      <div class="tool-info">
        <div class="tool-name">${esc(t.name)}</div>
        <div class="tool-cat">${esc(t.category||'')}</div>
        <div class="tool-prices">
          <span>${fmtEuro(t.daily_price)}/j</span>
          ${t.weekend_price ? `<span>${fmtEuro(t.weekend_price)}/wk</span>` : ''}
          ${t.deposit ? `<span>🔒 ${fmtEuro(t.deposit)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function openToolModal(tool=null) {
  document.getElementById('tool-id').value = tool?.id || '';
  document.getElementById('modal-tool-title').textContent = tool ? 'Modifier l\'outil' : 'Ajouter un outil';
  document.getElementById('tool-name').value = tool?.name || '';
  document.getElementById('tool-category').value = tool?.category || '';
  document.getElementById('tool-daily').value = tool?.daily_price ?? 0;
  document.getElementById('tool-weekend').value = tool?.weekend_price ?? 0;
  document.getElementById('tool-deposit').value = tool?.deposit ?? 0;
  document.getElementById('tool-desc').value = tool?.description || '';
  document.getElementById('tool-notes').value = tool?.notes || '';
  document.getElementById('tool-images').value = '';
  const preview = document.getElementById('tool-images-preview');
  preview.innerHTML = '';
  if (tool?.images) {
    tool.images.forEach(img => {
      preview.innerHTML += `<div class="img-thumb">
        <img src="/uploads/tools/${img.filename}"/>
        ${img.is_main ? '<span class="img-main">★</span>' : `<button class="img-main" onclick="setMainImage(${tool.id},${img.id})">★</button>`}
        <button class="img-del" onclick="deleteToolImage(${tool.id},${img.id})">×</button>
      </div>`;
    });
  }
  document.getElementById('modal-tool').classList.remove('hidden');
}

async function saveTool() {
  const id = document.getElementById('tool-id').value;
  const name = document.getElementById('tool-name').value.trim();
  if (!name) return;
  if (id) {
    // update fields
    await api.put(`/api/tools/${id}`, {
      name, description: document.getElementById('tool-desc').value,
      category: document.getElementById('tool-category').value,
      daily_price: parseFloat(document.getElementById('tool-daily').value)||0,
      weekend_price: parseFloat(document.getElementById('tool-weekend').value)||0,
      deposit: parseFloat(document.getElementById('tool-deposit').value)||0,
      notes: document.getElementById('tool-notes').value
    });
    // upload new images if any
    const files = document.getElementById('tool-images').files;
    for (const file of files) {
      const fd = new FormData(); fd.append('image', file);
      await api.form(`/api/tools/${id}/images`, fd);
    }
  } else {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', document.getElementById('tool-desc').value);
    fd.append('category', document.getElementById('tool-category').value);
    fd.append('daily_price', document.getElementById('tool-daily').value||0);
    fd.append('weekend_price', document.getElementById('tool-weekend').value||0);
    fd.append('deposit', document.getElementById('tool-deposit').value||0);
    fd.append('notes', document.getElementById('tool-notes').value);
    const files = document.getElementById('tool-images').files;
    for (const file of files) fd.append('images', file);
    await api.form('/api/tools', fd);
  }
  closeModal('modal-tool');
  await loadTools();
}

async function openToolDetail(id) {
  const t = await api.get(`/api/tools/${id}`);
  const rents = await api.get(`/api/rentals?tool_id=${id}`);
  const imgUrls = t.images.map(img => `/uploads/tools/${img.filename}`);
  const gallery = t.images.length ? t.images.map((img, idx) =>
    `<img src="/uploads/tools/${img.filename}" class="${img.is_main?'main-img':''}" title="Cliquer pour agrandir" onclick="openLightbox(${JSON.stringify(imgUrls).replace(/"/g,'&quot;')}, ${idx})"/>`
  ).join('') : '<span style="color:var(--muted)">Aucune photo</span>';

  document.getElementById('tool-detail-content').innerHTML = `
    <h2>${esc(t.name)} ${t.category ? `<span style="font-size:.8rem;color:var(--muted)">${esc(t.category)}</span>` : ''}</h2>
    <div class="tool-detail-gallery">${gallery}</div>
    <div class="tool-detail-info">
      <div class="detail-field"><label>Prix / jour</label><div class="val price">${fmtEuro(t.daily_price)}</div></div>
      <div class="detail-field"><label>Prix week-end</label><div class="val price">${t.weekend_price ? fmtEuro(t.weekend_price) : '—'}</div></div>
      <div class="detail-field"><label>Caution</label><div class="val">${t.deposit ? fmtEuro(t.deposit) : '—'}</div></div>
      <div class="detail-field"><label>Description</label><div class="val">${esc(t.description)||'—'}</div></div>
      ${t.notes ? `<div class="detail-field"><label>Notes</label><div class="val">${esc(t.notes)}</div></div>` : ''}
    </div>
    <h3 style="margin-top:12px">Historique locations (${rents.length})</h3>
    ${rents.slice(0,5).map(r => `<div class="rental-row" onclick="closeModal('modal-tool-detail');openRentalDetail(${r.id})">
      <div class="rental-info">
        <div class="rental-title">👤 ${esc(r.client?.name||'')}</div>
        <div class="rental-meta"><span>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</span><span>${fmtEuro(r.price)}</span><span class="badge badge-${r.status}">${statusLabel(r.status)}</span></div>
      </div>
    </div>`).join('')}
    ${rents.length > 5 ? `<div style="color:var(--muted);font-size:.8rem">… et ${rents.length-5} autres</div>` : ''}
  `;
  document.getElementById('btn-edit-tool').onclick = () => { closeModal('modal-tool-detail'); openToolModal(t); };
  document.getElementById('btn-delete-tool').onclick = async () => {
    if (!confirm('Supprimer cet outil ?')) return;
    await api.del(`/api/tools/${id}`);
    closeModal('modal-tool-detail');
    loadTools();
  };
  document.getElementById('modal-tool-detail').classList.remove('hidden');
}

async function deleteToolImage(toolId, imgId) {
  await api.del(`/api/tools/${toolId}/images/${imgId}`);
  const t = await api.get(`/api/tools/${toolId}`);
  openToolModal(t);
}
async function setMainImage(toolId, imgId) {
  await api.form(`/api/tools/${toolId}/images/${imgId}/main`, new FormData(), 'POST');
  const t = await api.get(`/api/tools/${toolId}`);
  openToolModal(t);
}

// ─── Clients ────────────────────────────────────────────────────────────────
async function loadClients() {
  clients = await api.get('/api/clients');
  renderClients();
}

function renderClients() {
  const q = document.getElementById('clients-search').value.toLowerCase();
  const list = document.getElementById('clients-list');
  const filtered = clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone||'').includes(q) || (c.email||'').toLowerCase().includes(q));
  if (!filtered.length) { list.innerHTML = '<div class="empty-state">Aucun client trouvé</div>'; return; }
  list.innerHTML = filtered.map(c => `
    <div class="client-row" onclick="openClientDetail(${c.id})">
      <div class="client-avatar">${c.name[0].toUpperCase()}</div>
      <div class="client-info">
        <div class="client-name">${esc(c.name)}</div>
        <div class="client-meta">
          ${c.phone ? `<span>📞 ${esc(c.phone)}</span>` : ''}
          ${c.email ? `<span>✉️ ${esc(c.email)}</span>` : ''}
          <span>📋 ${c.rental_count} location(s)</span>
        </div>
      </div>
    </div>
  `).join('');
}

function openClientModal(client=null) {
  document.getElementById('client-id').value = client?.id || '';
  document.getElementById('modal-client-title').textContent = client ? 'Modifier le client' : 'Ajouter un client';
  document.getElementById('client-name').value = client?.name || '';
  document.getElementById('client-phone').value = client?.phone || '';
  document.getElementById('client-email').value = client?.email || '';
  document.getElementById('client-address').value = client?.address || '';
  document.getElementById('client-notes').value = client?.notes || '';
  document.getElementById('modal-client').classList.remove('hidden');
}

async function saveClient() {
  const id = document.getElementById('client-id').value;
  const name = document.getElementById('client-name').value.trim();
  if (!name) return;
  const fd = new FormData();
  fd.append('name', name);
  fd.append('phone', document.getElementById('client-phone').value);
  fd.append('email', document.getElementById('client-email').value);
  fd.append('address', document.getElementById('client-address').value);
  fd.append('notes', document.getElementById('client-notes').value);
  if (id) {
    await api.put(`/api/clients/${id}`, {
      name, phone: document.getElementById('client-phone').value,
      email: document.getElementById('client-email').value,
      address: document.getElementById('client-address').value,
      notes: document.getElementById('client-notes').value
    });
  } else {
    await api.form('/api/clients', fd);
  }
  closeModal('modal-client');
  loadClients();
}

async function openClientDetail(id) {
  const c = await api.get(`/api/clients/${id}`);
  const docsHtml = c.documents.length ? c.documents.map(d => {
    const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(d.filename);
    return `<div class="doc-item">
      ${isImg ? `<img src="/uploads/clients/${d.filename}"/>` : `<div class="doc-file">📄</div>`}
      <div class="doc-label">${esc(d.label)}</div>
      <button class="doc-del" onclick="deleteDoc(${id},${d.id})">×</button>
    </div>`;
  }).join('') : '';

  document.getElementById('client-detail-content').innerHTML = `
    <h2>${esc(c.name)}</h2>
    <div class="tool-detail-info" style="margin-bottom:12px">
      ${c.phone ? `<div class="detail-field"><label>Téléphone</label><div class="val">${esc(c.phone)}</div></div>` : ''}
      ${c.email ? `<div class="detail-field"><label>Email</label><div class="val">${esc(c.email)}</div></div>` : ''}
      ${c.address ? `<div class="detail-field"><label>Adresse</label><div class="val">${esc(c.address)}</div></div>` : ''}
      ${c.notes ? `<div class="detail-field"><label>Notes</label><div class="val">${esc(c.notes)}</div></div>` : ''}
    </div>
    <h3>Documents (${c.documents.length})</h3>
    <div class="doc-grid">${docsHtml}</div>
    <div class="upload-zone" onclick="document.getElementById('doc-upload-${id}').click()">
      📎 Ajouter un document
      <input type="file" id="doc-upload-${id}" accept="image/*,.pdf" style="display:none" onchange="uploadDoc(${id},this)"/>
    </div>
    <h3 style="margin-top:12px">Historique locations (${c.rentals.length})</h3>
    ${c.rentals.slice(0,5).map(r => `<div class="rental-row" onclick="closeModal('modal-client-detail');openRentalDetail(${r.id})">
      <div class="rental-info">
        <div class="rental-title">🔨 ${esc(r.tool_name)}</div>
        <div class="rental-meta"><span>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</span><span>${fmtEuro(r.price)}</span><span class="badge badge-${r.status}">${statusLabel(r.status)}</span></div>
      </div>
    </div>`).join('')}
  `;
  document.getElementById('btn-edit-client').onclick = () => { closeModal('modal-client-detail'); openClientModal(c); };
  document.getElementById('btn-delete-client').onclick = async () => {
    if (!confirm('Supprimer ce client ?')) return;
    await api.del(`/api/clients/${id}`);
    closeModal('modal-client-detail');
    loadClients();
  };
  document.getElementById('modal-client-detail').classList.remove('hidden');
}

async function uploadDoc(clientId, input) {
  const file = input.files[0]; if (!file) return;
  const label = prompt('Libellé du document ?', 'Pièce d\'identité') || 'Document';
  const fd = new FormData(); fd.append('file', file); fd.append('label', label);
  await api.form(`/api/clients/${clientId}/documents`, fd);
  openClientDetail(clientId);
}
async function deleteDoc(clientId, docId) {
  if (!confirm('Supprimer ce document ?')) return;
  await api.del(`/api/clients/${clientId}/documents/${docId}`);
  openClientDetail(clientId);
}

// ─── Rentals ────────────────────────────────────────────────────────────────
async function loadRentals() {
  [tools, clients, platforms] = await Promise.all([api.get('/api/tools'), api.get('/api/clients'), api.get('/api/platforms')]);
  const url = rentalFilter ? `/api/rentals?status=${rentalFilter}` : '/api/rentals';
  rentals = await api.get(url);
  renderRentals();
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    rentalFilter = btn.dataset.status;
    loadRentals();
  });
});

function renderRentals() {
  const list = document.getElementById('rentals-list');
  if (!rentals.length) { list.innerHTML = '<div class="empty-state">Aucune location trouvée</div>'; return; }
  list.innerHTML = rentals.map(r => `
    <div class="rental-row" onclick="openRentalDetail(${r.id})">
      <div class="rental-info">
        <div class="rental-title">🔨 ${esc(r.tool?.name||'')} — 👤 ${esc(r.client?.name||'')}</div>
        <div class="rental-meta">
          <span>📅 ${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</span>
          <span>💶 ${fmtEuro(r.price)}</span>
          ${r.platform ? `<span>🔗 ${esc(r.platform.name)}</span>` : ''}
          <span class="badge badge-${r.status}">${statusLabel(r.status)}</span>
          ${r.deposit_collected && !r.deposit_returned ? '<span style="color:var(--warning)">🔒 Caution à rendre</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function openRentalModal(rental=null) {
  if (!tools.length) [tools, clients, platforms] = await Promise.all([api.get('/api/tools'), api.get('/api/clients'), api.get('/api/platforms')]);
  document.getElementById('rental-id').value = rental?.id || '';
  document.getElementById('modal-rental-title').textContent = rental ? 'Modifier la location' : 'Nouvelle location';
  const tSel = document.getElementById('rental-tool');
  const cSel = document.getElementById('rental-client');
  const pSel = document.getElementById('rental-platform');
  tSel.innerHTML = tools.map(t => `<option value="${t.id}" ${rental?.tool_id===t.id?'selected':''}>${esc(t.name)}</option>`).join('');
  cSel.innerHTML = clients.map(c => `<option value="${c.id}" ${rental?.client_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
  pSel.innerHTML = `<option value="">—</option>` + platforms.map(p => `<option value="${p.id}" ${rental?.platform_id===p.id?'selected':''}>${esc(p.name)}</option>`).join('');
  document.getElementById('rental-start').value = rental?.start_date || '';
  document.getElementById('rental-end').value = rental?.end_date || '';
  document.getElementById('rental-price').value = rental?.price ?? '';
  document.getElementById('rental-deposit-collected').checked = !!rental?.deposit_collected;
  document.getElementById('rental-deposit-returned').checked = !!rental?.deposit_returned;
  document.getElementById('rental-notes').value = rental?.return_notes || '';
  document.getElementById('rental-status').value = rental?.status || 'confirmed';
  document.getElementById('rental-price-hint').textContent = '';
  document.getElementById('modal-rental').classList.remove('hidden');
}

function calcRentalPrice() {
  const start = document.getElementById('rental-start').value;
  const end = document.getElementById('rental-end').value;
  const toolId = parseInt(document.getElementById('rental-tool').value);
  if (!start || !end || !toolId) return;
  const t = tools.find(t => t.id === toolId);
  if (!t) return;
  const days = Math.max(1, Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1);
  const isWeekend = days <= 3 && [6,0].includes(new Date(start).getDay());
  const price = isWeekend && t.weekend_price ? t.weekend_price : t.daily_price * days;
  document.getElementById('rental-price').value = price.toFixed(2);
  document.getElementById('rental-price-hint').textContent = `${days} jour(s) × ${fmtEuro(t.daily_price)} = ${fmtEuro(price)} (estimé)`;
}

async function saveRental() {
  const id = document.getElementById('rental-id').value;
  const data = {
    tool_id: parseInt(document.getElementById('rental-tool').value),
    client_id: parseInt(document.getElementById('rental-client').value),
    platform_id: parseInt(document.getElementById('rental-platform').value)||null,
    start_date: document.getElementById('rental-start').value,
    end_date: document.getElementById('rental-end').value,
    price: parseFloat(document.getElementById('rental-price').value)||0,
    deposit_collected: document.getElementById('rental-deposit-collected').checked,
    deposit_returned: document.getElementById('rental-deposit-returned').checked,
    status: document.getElementById('rental-status').value,
    return_notes: document.getElementById('rental-notes').value
  };
  if (!data.start_date || !data.end_date) return;
  if (id) await api.put(`/api/rentals/${id}`, data);
  else await api.post('/api/rentals', data);
  closeModal('modal-rental');
  loadRentals();
}

async function openRentalDetail(id) {
  const r = await api.get(`/api/rentals/${id}`);
  const days = Math.max(1, Math.ceil((new Date(r.end_date) - new Date(r.start_date)) / 86400000) + 1);
  // reuse rental modal for edit
  await openRentalModal(r);
  document.getElementById('modal-rental-title').textContent = 'Modifier la location';
  // add delete button
  const actions = document.querySelector('#modal-rental .modal-actions');
  if (!document.getElementById('btn-del-rental')) {
    const del = document.createElement('button');
    del.className = 'btn btn-danger'; del.id = 'btn-del-rental'; del.textContent = 'Supprimer';
    del.onclick = async () => {
      if (!confirm('Supprimer cette location ?')) return;
      await api.del(`/api/rentals/${id}`);
      closeModal('modal-rental');
      loadRentals();
    };
    actions.prepend(del);
  } else {
    document.getElementById('btn-del-rental').onclick = async () => {
      if (!confirm('Supprimer cette location ?')) return;
      await api.del(`/api/rentals/${id}`);
      closeModal('modal-rental');
      loadRentals();
    };
  }
}

// ─── Calendar ────────────────────────────────────────────────────────────────
async function loadCalendar() {
  const data = await api.get(`/api/rentals/calendar?year=${calYear}&month=${calMonth}`);
  renderCalendar(data);
}

function calPrev() { calMonth--; if(calMonth<1){calMonth=12;calYear--;} loadCalendar(); }
function calNext() { calMonth++; if(calMonth>12){calMonth=1;calYear++;} loadCalendar(); }

// Palette de couleurs par outil (stable par ID)
const CAL_COLORS = [
  '#6366f1','#22c55e','#f59e0b','#38bdf8','#f472b6',
  '#a78bfa','#34d399','#fb923c','#60a5fa','#e879f9','#4ade80'
];
function toolColor(toolId) { return CAL_COLORS[(toolId - 1) % CAL_COLORS.length]; }

function renderCalendar(rentals) {
  document.getElementById('cal-title').textContent =
    new Date(calYear, calMonth-1, 1).toLocaleDateString('fr-FR', {month:'long', year:'numeric'});

  const today = new Date().toISOString().slice(0,10);
  const firstDay = new Date(calYear, calMonth-1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const startOffset = (firstDay + 6) % 7;

  // Légende des outils présents ce mois
  const toolsInMonth = [...new Map(rentals.map(r => [r.tool_id, r])).values()];
  const legend = toolsInMonth.map(r =>
    `<span class="cal-legend-item"><span class="cal-legend-dot" style="background:${toolColor(r.tool_id)}"></span>${esc(r.tool_name)}</span>`
  ).join('');

  let html = `<div class="cal-legend">${legend}</div>
<div class="cal-grid-wrap">
  <div class="cal-grid">`;

  ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach((d, i) => {
    html += `<div class="cal-header-cell${i>=5?' cal-weekend':''}">${d}</div>`;
  });

  for (let i = 0; i < startOffset; i++) html += `<div class="cal-cell cal-empty"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayRentals = rentals.filter(r => r.start_date <= dateStr && r.end_date >= dateStr);
    const isToday = dateStr === today;
    const dow = (startOffset + day - 1) % 7;
    const isWeekend = dow >= 5;

    const events = dayRentals.map(r => {
      const color = toolColor(r.tool_id);
      const isStart = r.start_date === dateStr;
      const isEnd = r.end_date === dateStr;
      const label = isStart ? `🔨 ${esc(r.tool_name)}` : esc(r.tool_name);
      return `<div class="cal-event-block${isStart?' cal-event-start':''}${isEnd?' cal-event-end':''}"
        style="background:${color}22;border-left:3px solid ${color};color:${color}"
        onclick="openRentalDetail(${r.id})"
        title="${esc(r.tool_name)} → ${esc(r.client_name)}">${label}</div>`;
    }).join('');

    html += `<div class="cal-cell${isToday?' cal-today':''}${isWeekend?' cal-weekend':''}">
      <div class="cal-day-num${isToday?' today':''}">${day}</div>
      ${events}
    </div>`;
  }

  // Remplir la dernière ligne
  const total = startOffset + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 0; i < remaining; i++) html += `<div class="cal-cell cal-empty"></div>`;

  html += `</div></div>`;
  document.getElementById('calendar-wrap').innerHTML = html;
}

// ─── Platforms ───────────────────────────────────────────────────────────────
async function loadPlatforms() {
  platforms = await api.get('/api/platforms');
  const list = document.getElementById('platforms-list');
  list.innerHTML = platforms.length ? platforms.map(p => `
    <div class="platform-row">
      <span>${esc(p.name)}</span>
      <button class="btn-icon" onclick="deletePlatform(${p.id})">🗑️</button>
    </div>
  `).join('') : '<div style="color:var(--muted);padding:8px">Aucune plateforme</div>';
}

async function addPlatform() {
  const name = document.getElementById('new-platform').value.trim();
  if (!name) return;
  await api.post('/api/platforms', {name});
  document.getElementById('new-platform').value = '';
  loadPlatforms();
}
document.getElementById('new-platform').addEventListener('keydown', e => { if(e.key==='Enter') addPlatform(); });

async function deletePlatform(id) {
  if (!confirm('Supprimer cette plateforme ?')) return;
  await api.del(`/api/platforms/${id}`);
  loadPlatforms();
}

// ─── Utils ──────────────────────────────────────────────────────────────────
function fmtEuro(v) { return Number(v).toLocaleString('fr-FR', {style:'currency', currency:'EUR'}); }
function fmtDate(d) { if(!d) return '—'; return new Date(d+'T00:00:00').toLocaleDateString('fr-FR'); }
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function statusLabel(s) {
  return {confirmed:'Confirmée', ongoing:'En cours', returned:'Retournée', cancelled:'Annulée'}[s] || s;
}

// ─── Listings ───────────────────────────────────────────────────────────────
let _matrix = null;

async function loadListings() {
  _matrix = await api.get('/api/listings/matrix');
  renderListingsMatrix();
}

function renderListingsMatrix() {
  const { tools, platforms, listings } = _matrix;
  if (!tools.length) { document.getElementById('listings-matrix').innerHTML = '<div class="empty-state">Aucun outil</div>'; return; }
  if (!platforms.length) { document.getElementById('listings-matrix').innerHTML = '<div class="empty-state">Aucune plateforme configurée (allez dans ⚙️)</div>'; return; }

  let html = `<div class="listings-matrix"><table class="listings-table"><thead><tr>
    <th>Outil</th>`;
  platforms.forEach(p => { html += `<th class="platform-col">${esc(p.name)}</th>`; });
  html += `</tr></thead><tbody>`;

  tools.forEach(t => {
    html += `<tr><td><div class="tool-name">${esc(t.name)}</div><div style="font-size:.75rem;color:var(--muted)">${fmtEuro(t.daily_price)}/j</div></td>`;
    platforms.forEach(p => {
      const key = `${t.id},${p.id}`;
      const l = listings[key];
      let cls = 'empty', icon = '＋', title = 'Créer une annonce';
      if (l) {
        if (l.is_active) { cls = 'active'; icon = '✓'; title = 'Annonce active — cliquer pour modifier'; }
        else { cls = 'inactive'; icon = '✗'; title = 'Annonce inactive — cliquer pour modifier'; }
      }
      html += `<td><div class="listing-cell"><button class="listing-btn ${cls}" title="${title}" onclick="openListingModal(${t.id},${p.id})">${icon}</button></div></td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  document.getElementById('listings-matrix').innerHTML = html;
}

async function openListingModal(toolId, platformId) {
  const { tools, platforms, listings } = _matrix;
  const tool = tools.find(t => t.id === toolId);
  const platform = platforms.find(p => p.id === platformId);
  const key = `${toolId},${platformId}`;
  const l = listings[key] || null;

  document.getElementById('listing-id').value = l?.id || '';
  document.getElementById('listing-tool-id').value = toolId;
  document.getElementById('listing-platform-id').value = platformId;
  document.getElementById('modal-listing-title').textContent = `Annonce — ${tool?.name}`;
  document.getElementById('listing-meta').textContent = `Plateforme : ${platform?.name}`;
  document.getElementById('listing-title').value = l?.title || (tool ? `${tool.name} à louer — ${tool.daily_price}€/jour` : '');
  document.getElementById('listing-desc').value = l?.description || '';
  document.getElementById('listing-price').value = l?.price ?? tool?.daily_price ?? '';
  document.getElementById('listing-url').value = l?.url || '';
  document.getElementById('listing-notes').value = l?.notes || '';
  document.getElementById('listing-active').checked = l ? !!l.is_active : true;

  const delBtn = document.getElementById('btn-listing-delete');
  const copyBtn = document.getElementById('btn-listing-copy');
  if (l) {
    delBtn.style.display = '';
    delBtn.onclick = () => deleteListing(l.id);
    copyBtn.style.display = '';
  } else {
    delBtn.style.display = 'none';
    copyBtn.style.display = 'none';
  }
  document.getElementById('modal-listing').classList.remove('hidden');
}

async function saveListing() {
  const data = {
    tool_id: parseInt(document.getElementById('listing-tool-id').value),
    platform_id: parseInt(document.getElementById('listing-platform-id').value),
    is_active: document.getElementById('listing-active').checked,
    title: document.getElementById('listing-title').value.trim(),
    description: document.getElementById('listing-desc').value.trim(),
    price: parseFloat(document.getElementById('listing-price').value) || null,
    url: document.getElementById('listing-url').value.trim(),
    notes: document.getElementById('listing-notes').value.trim()
  };
  await api.post('/api/listings', data);
  closeModal('modal-listing');
  _matrix = await api.get('/api/listings/matrix');
  renderListingsMatrix();
}

async function deleteListing(id) {
  if (!confirm('Supprimer cette annonce ?')) return;
  await api.del(`/api/listings/${id}`);
  closeModal('modal-listing');
  _matrix = await api.get('/api/listings/matrix');
  renderListingsMatrix();
}

function copyListingText() {
  const title = document.getElementById('listing-title').value;
  const desc = document.getElementById('listing-desc').value;
  const price = document.getElementById('listing-price').value;
  const text = [title, price ? `Prix : ${price}€/jour` : '', '', desc].filter(Boolean).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-listing-copy');
    btn.textContent = '✅ Copié !';
    setTimeout(() => btn.textContent = '📋 Copier', 2000);
  });
}

// ─── Lightbox ───────────────────────────────────────────────────────────────
let _lbImages = [], _lbIdx = 0;

function openLightbox(images, idx) {
  _lbImages = images;
  _lbIdx = idx;
  _lbRender();
  document.getElementById('lightbox').classList.remove('hidden');
  document.addEventListener('keydown', _lbKey);
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.removeEventListener('keydown', _lbKey);
}

function lightboxNav(dir) {
  _lbIdx = (_lbIdx + dir + _lbImages.length) % _lbImages.length;
  _lbRender();
}

function _lbRender() {
  const url = _lbImages[_lbIdx];
  const img = document.getElementById('lightbox-img');
  img.src = url;
  document.getElementById('lightbox-counter').textContent = `${_lbIdx + 1} / ${_lbImages.length}`;
  const dl = document.getElementById('lightbox-download');
  dl.href = url;
  dl.download = url.split('/').pop();
  document.querySelector('.lightbox-prev').style.display = _lbImages.length > 1 ? '' : 'none';
  document.querySelector('.lightbox-next').style.display = _lbImages.length > 1 ? '' : 'none';
}

function _lbKey(e) {
  if (e.key === 'ArrowLeft') lightboxNav(-1);
  else if (e.key === 'ArrowRight') lightboxNav(1);
  else if (e.key === 'Escape') closeLightbox();
}

// ─── Init ───────────────────────────────────────────────────────────────────
loadDashboard();
