// API BASE PATH
const API_BASE = '';

// STATE GLOBAL
let activePage = 'dashboard';
let cachedUnits = [];
let cachedFormats = [];
let currentSelectorTargetInput = null; // Menyimpan input element target dari pemilih nomor

// DOM ELEMENTS & INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // Navigation Links
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = item.getAttribute('data-page');
      switchPage(pageId);
    });
  });

  // Setup Event Listeners untuk form & search
  setupEventListeners();

  // Load Awal
  switchPage('dashboard');
});

// ROUTING / NAVIGATION CONTROLLER
function switchPage(pageId) {
  activePage = pageId;

  // Update Active Link di Sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-page') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle Sections
  document.querySelectorAll('.page-section').forEach(section => {
    if (section.id === `page-${pageId}`) {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });

  // Load Data Spesifik Halaman
  if (pageId === 'dashboard') {
    loadDashboardData();
  } else if (pageId === 'generator') {
    loadGeneratorData();
  } else if (pageId === 'surat-masuk') {
    loadSuratData('masuk');
  } else if (pageId === 'surat-keluar') {
    loadSuratData('keluar');
  } else if (pageId === 'quotation') {
    loadQuotationData();
  } else if (pageId === 'invoicing') {
    loadInvoiceData();
  } else if (pageId === 'unit') {
    loadUnitData();
  } else if (pageId === 'format-nomor') {
    loadFormatData();
  }
}

// SETUP LISTENERS
function setupEventListeners() {
  // Form Unit Kerja
  document.getElementById('form-unit').addEventListener('submit', handleUnitSubmit);
  document.getElementById('btn-cancel-unit').addEventListener('click', resetUnitForm);

  // Form Generator Nomor
  document.getElementById('form-generator').addEventListener('submit', handleGenerateNumber);
  
  // Copy Number Button
  document.getElementById('btn-copy-number').addEventListener('click', () => {
    const num = document.getElementById('generated-number-value').innerText;
    navigator.clipboard.writeText(num);
    const btn = document.getElementById('btn-copy-number');
    btn.innerHTML = `<i data-lucide="check"></i> Berhasil Disalin!`;
    lucide.createIcons();
    setTimeout(() => {
      btn.innerHTML = `<i data-lucide="copy"></i> Salin Nomor`;
      lucide.createIcons();
    }, 2000);
  });

  // Search Inputs
  setupSearchInput('search-surat-masuk', () => loadSuratData('masuk'));
  setupSearchInput('search-surat-keluar', () => loadSuratData('keluar'));
  setupSearchInput('search-quotation', () => loadQuotationData());
  setupSearchInput('search-invoicing', () => loadInvoiceData());

  // Form Submit Handler
  document.getElementById('form-document').addEventListener('submit', handleDocumentSubmit);
  document.getElementById('form-quotation').addEventListener('submit', handleQuotationSubmit);
  document.getElementById('form-invoice').addEventListener('submit', handleInvoiceSubmit);

  // Selector Nomor Buttons
  document.getElementById('btn-use-gen-number').addEventListener('click', () => {
    const type = document.getElementById('doc-type').value;
    openSelectorModal(type, 'doc-number');
  });

  document.getElementById('btn-use-gen-q').addEventListener('click', () => {
    openSelectorModal('quotation', 'q-number');
  });

  document.getElementById('btn-use-gen-i').addEventListener('click', () => {
    openSelectorModal('invoicing', 'i-number');
  });
}

function setupSearchInput(id, callback) {
  let debounceTimer;
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(callback, 300);
    });
  }
}

// ==========================================
// 1. DASHBOARD LOGIC
// ==========================================
async function loadDashboardData() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    const data = await res.json();

    // Populate counts
    document.getElementById('stat-masuk').innerText = data.totalMasuk.toLocaleString('id-ID');
    document.getElementById('stat-keluar').innerText = data.totalKeluar.toLocaleString('id-ID');
    document.getElementById('stat-quotation').innerText = data.totalQuotation.toLocaleString('id-ID');
    document.getElementById('stat-invoice').innerText = data.totalInvoice.toLocaleString('id-ID');

    // Populate Recent Activity
    const actList = document.getElementById('recent-activities');
    actList.innerHTML = '';
    
    if (data.recentActivities.length === 0) {
      actList.innerHTML = `<li class="text-center text-muted py-4">Belum ada aktivitas dokumen saat ini.</li>`;
    } else {
      data.recentActivities.forEach(act => {
        const item = document.createElement('li');
        item.className = 'activity-item';

        const rawDate = new Date(act.time);
        const timeFormatted = formatTimeDifference(rawDate);

        let badgeClass = act.category.toLowerCase().replace(' ', '-');
        if (act.type === 'number') badgeClass = 'nomor';

        item.innerHTML = `
          <div class="activity-marker"></div>
          <div class="activity-details">
            <div class="activity-title">${act.title}</div>
            <div class="activity-meta-row">
              <span class="activity-badge ${badgeClass}">${act.category}</span>
              <span class="activity-meta">${act.meta || '-'}</span>
            </div>
          </div>
          <div class="activity-time">${timeFormatted}</div>
        `;
        actList.appendChild(item);
      });
    }

    // Populate Unit Stats
    const unitList = document.getElementById('unit-stats');
    unitList.innerHTML = '';

    if (data.unitStats.length === 0) {
      unitList.innerHTML = `<li class="text-center text-muted py-4">Belum ada dokumen terdaftar pada unit.</li>`;
    } else {
      const maxCount = Math.max(...data.unitStats.map(u => u.count), 1);
      
      data.unitStats.forEach(u => {
        const percentage = Math.round((u.count / maxCount) * 100);
        const item = document.createElement('div');
        item.className = 'unit-stat-item';
        item.innerHTML = `
          <div class="unit-stat-meta">
            <span>${u.name}</span>
            <span class="unit-stat-count">${u.count} dokumen</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${percentage}%"></div>
          </div>
        `;
        unitList.appendChild(item);
      });
    }

  } catch (err) {
    console.error('Gagal mengambil data dashboard:', err.message);
  }
}

// Helper Selisih Waktu
function formatTimeDifference(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  return `${days} hari lalu`;
}


// ==========================================
// 2. GENERATOR NOMOR LOGIC
// ==========================================
async function loadGeneratorData() {
  try {
    // Load dropdown units
    await loadUnitsDropdown('gen-unit');
    // Load Table Riwayat
    fetchGeneratedNumbers();
  } catch (e) {}
}

async function loadUnitsDropdown(selectId) {
  const select = document.getElementById(selectId);
  select.innerHTML = `<option value="" disabled selected>Pilih Unit...</option>`;

  const units = await fetchUnits();
  units.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.innerText = `${u.name} (${u.code})`;
    select.appendChild(opt);
  });
}

async function fetchGeneratedNumbers() {
  try {
    const res = await fetch(`${API_BASE}/api/generated-numbers`);
    const data = await res.json();

    const tbody = document.getElementById('table-generated-numbers-body');
    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center">Belum ada nomor yang digenerate.</td></tr>`;
      return;
    }

    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold font-mono">${item.number}</td>
        <td><span class="badge badge-status-sent">${getCategoryLabel(item.type)}</span></td>
        <td>${item.unitName}</td>
        <td>${new Date(item.createdAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {}
}

async function handleGenerateNumber(e) {
  e.preventDefault();
  const type = document.getElementById('gen-type').value;
  const unitId = document.getElementById('gen-unit').value;

  try {
    const res = await fetch(`${API_BASE}/api/generate-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, unitId })
    });
    
    if (!res.ok) {
      alert('Gagal me-generate nomor.');
      return;
    }

    const data = await res.json();
    
    // Tampilkan Hasil
    document.getElementById('generated-number-value').innerText = data.number;
    document.getElementById('generator-result-box').classList.remove('hidden');

    // Refresh Riwayat
    fetchGeneratedNumbers();
  } catch (err) {
    console.error(err);
  }
}

function getCategoryLabel(type) {
  const labels = {
    masuk: 'Surat Masuk',
    keluar: 'Surat Keluar',
    quotation: 'Quotation',
    invoicing: 'Invoicing'
  };
  return labels[type] || type;
}


// ==========================================
// 3. SURAT (MASUK / KELUAR) LOGIC
// ==========================================
async function loadSuratData(type) {
  const searchInput = document.getElementById(`search-surat-${type}`);
  const q = searchInput ? searchInput.value : '';

  try {
    const res = await fetch(`${API_BASE}/api/surat?type=${type}&search=${encodeURIComponent(q)}`);
    const data = await res.json();

    const tbody = document.getElementById(`table-surat-${type}-body`);
    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">Belum ada arsip surat.</td></tr>`;
      return;
    }

    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold font-mono">${item.number}</td>
        <td>${item.senderOrReceiver}</td>
        <td>${item.subject}</td>
        <td>${formatDateString(item.date)}</td>
        <td>${formatDateString(item.receivedOrSentDate)}</td>
        <td>${item.unitName}</td>
        <td class="actions-column">
          <div class="action-buttons-group">
            ${item.filePath ? `
              <button class="btn-icon-only" onclick="previewFile('${item.filePath}', '${item.number}')" title="Preview File">
                <i data-lucide="eye"></i>
              </button>
            ` : ''}
            <button class="btn-icon-only" onclick="editSurat('${item.id}', '${item.type}')" title="Edit Data">
              <i data-lucide="edit-2"></i>
            </button>
            <button class="btn-icon-only delete" onclick="deleteSurat('${item.id}', '${item.type}')" title="Hapus Data">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {}
}

function formatDateString(str) {
  if (!str) return '-';
  const d = new Date(str);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Open Modal Add/Edit Surat
async function openDocModal(type, editId = null) {
  const modal = document.getElementById('modal-document');
  const form = document.getElementById('form-document');
  form.reset();

  document.getElementById('doc-id').value = editId || '';
  document.getElementById('doc-type').value = type;

  // Load dropdown unit
  await loadUnitsDropdown('doc-unit');

  // Set default dates to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('doc-date').value = today;
  document.getElementById('doc-received-date').value = today;

  // Ubah label secara dinamis
  if (type === 'masuk') {
    document.getElementById('modal-doc-title').innerText = editId ? 'Edit Surat Masuk' : 'Tambah Surat Masuk';
    document.getElementById('lbl-sender').innerText = 'Asal Surat (Pengirim) *';
    document.getElementById('lbl-received-date').innerText = 'Tanggal Diterima';
    document.getElementById('doc-sender').placeholder = 'Contoh: Dinas Pendidikan Kota';
  } else {
    document.getElementById('modal-doc-title').innerText = editId ? 'Edit Surat Keluar' : 'Tambah Surat Keluar';
    document.getElementById('lbl-sender').innerText = 'Tujuan Surat (Penerima) *';
    document.getElementById('lbl-received-date').innerText = 'Tanggal Dikirim';
    document.getElementById('doc-sender').placeholder = 'Contoh: PT. Hexa Jaya Sentosa';
  }

  // Jika Edit mode, ambil data dari API
  if (editId) {
    try {
      const res = await fetch(`${API_BASE}/api/surat?type=${type}`);
      const list = await res.json();
      const current = list.find(s => s.id === editId);
      if (current) {
        document.getElementById('doc-number').value = current.number;
        document.getElementById('doc-unit').value = current.unitId;
        document.getElementById('doc-date').value = current.date;
        document.getElementById('doc-received-date').value = current.receivedOrSentDate;
        document.getElementById('doc-sender').value = current.senderOrReceiver;
        document.getElementById('doc-subject').value = current.subject;
        if (current.fileName) {
          document.getElementById('doc-file-info').innerHTML = `File saat ini: <strong>${current.fileName}</strong> (Unggah lagi untuk mengganti).`;
        }
      }
    } catch(e) {}
  } else {
    document.getElementById('doc-file-info').innerText = 'File akan disimpan secara lokal di drive D:.';
  }

  modal.classList.add('active');
  lucide.createIcons();
}

function closeDocModal() {
  document.getElementById('modal-document').classList.remove('active');
}

async function handleDocumentSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('doc-id').value;
  const type = document.getElementById('doc-type').value;

  const formData = new FormData();
  formData.append('type', type);
  formData.append('category', type); // Digunakan multer destination
  formData.append('number', document.getElementById('doc-number').value);
  formData.append('unitId', document.getElementById('doc-unit').value);
  formData.append('date', document.getElementById('doc-date').value);
  formData.append('receivedOrSentDate', document.getElementById('doc-received-date').value);
  formData.append('senderOrReceiver', document.getElementById('doc-sender').value);
  formData.append('subject', document.getElementById('doc-subject').value);

  const fileInput = document.getElementById('doc-file');
  if (fileInput.files[0]) {
    formData.append('document', fileInput.files[0]);
  }

  const url = id ? `${API_BASE}/api/surat/${id}` : `${API_BASE}/api/surat`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      body: formData
    });

    if (res.ok) {
      closeDocModal();
      loadSuratData(type);
    } else {
      const err = await res.json();
      alert(`Gagal menyimpan: ${err.error}`);
    }
  } catch(e) {}
}

async function editSurat(id, type) {
  openDocModal(type, id);
}

async function deleteSurat(id, type) {
  if (!confirm('Apakah Anda yakin ingin menghapus data surat ini beserta filenya?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/surat/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadSuratData(type);
    }
  } catch(e) {}
}


// ==========================================
// 4. QUOTATION LOGIC
// ==========================================
async function loadQuotationData() {
  const searchInput = document.getElementById('search-quotation');
  const q = searchInput ? searchInput.value : '';

  try {
    const res = await fetch(`${API_BASE}/api/quotations?search=${encodeURIComponent(q)}`);
    const data = await res.json();

    const tbody = document.getElementById('table-quotation-body');
    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Belum ada quotation terarsip.</td></tr>`;
      return;
    }

    data.forEach(item => {
      const tr = document.createElement('tr');
      const formattedAmount = item.amount ? `Rp ${parseFloat(item.amount).toLocaleString('id-ID')}` : 'Rp 0';
      const statusBadgeClass = `badge-status-${item.status.toLowerCase()}`;

      tr.innerHTML = `
        <td class="bold font-mono">${item.number}</td>
        <td>${item.client}</td>
        <td>${item.subject}</td>
        <td>${formatDateString(item.date)}</td>
        <td class="bold">${formattedAmount}</td>
        <td>${item.unitName}</td>
        <td><span class="badge ${statusBadgeClass}">${item.status}</span></td>
        <td class="actions-column">
          <div class="action-buttons-group">
            ${item.filePath ? `
              <button class="btn-icon-only" onclick="previewFile('${item.filePath}', '${item.number}')" title="Preview File">
                <i data-lucide="eye"></i>
              </button>
            ` : ''}
            <button class="btn-icon-only" onclick="editQuotation('${item.id}')" title="Edit Data">
              <i data-lucide="edit-2"></i>
            </button>
            <button class="btn-icon-only delete" onclick="deleteQuotation('${item.id}')" title="Hapus Data">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    lucide.createIcons();
  } catch(e) {}
}

async function openQuotationModal(editId = null) {
  const modal = document.getElementById('modal-quotation');
  const form = document.getElementById('form-quotation');
  form.reset();

  document.getElementById('q-id').value = editId || '';
  await loadUnitsDropdown('q-unit');

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('q-date').value = today;

  document.getElementById('modal-q-title').innerText = editId ? 'Edit Quotation' : 'Tambah Quotation';

  if (editId) {
    try {
      const res = await fetch(`${API_BASE}/api/quotations`);
      const list = await res.json();
      const current = list.find(item => item.id === editId);
      if (current) {
        document.getElementById('q-number').value = current.number;
        document.getElementById('q-unit').value = current.unitId;
        document.getElementById('q-date').value = current.date;
        document.getElementById('q-amount').value = current.amount;
        document.getElementById('q-client').value = current.client;
        document.getElementById('q-status').value = current.status;
        document.getElementById('q-subject').value = current.subject;
      }
    } catch(e) {}
  }

  modal.classList.add('active');
  lucide.createIcons();
}

function closeQuotationModal() {
  document.getElementById('modal-quotation').classList.remove('active');
}

async function handleQuotationSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('q-id').value;

  const formData = new FormData();
  formData.append('category', 'quotation');
  formData.append('number', document.getElementById('q-number').value);
  formData.append('unitId', document.getElementById('q-unit').value);
  formData.append('date', document.getElementById('q-date').value);
  formData.append('amount', document.getElementById('q-amount').value);
  formData.append('client', document.getElementById('q-client').value);
  formData.append('status', document.getElementById('q-status').value);
  formData.append('subject', document.getElementById('q-subject').value);

  const fileInput = document.getElementById('q-file');
  if (fileInput.files[0]) {
    formData.append('document', fileInput.files[0]);
  }

  const url = id ? `${API_BASE}/api/quotations/${id}` : `${API_BASE}/api/quotations`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      body: formData
    });

    if (res.ok) {
      closeQuotationModal();
      loadQuotationData();
    } else {
      alert('Gagal menyimpan quotation.');
    }
  } catch(e) {}
}

function editQuotation(id) {
  openQuotationModal(id);
}

async function deleteQuotation(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus quotation ini?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/quotations/${id}`, { method: 'DELETE' });
    if (res.ok) loadQuotationData();
  } catch(e) {}
}


// ==========================================
// 5. INVOICING LOGIC
// ==========================================
async function loadInvoiceData() {
  const searchInput = document.getElementById('search-invoicing');
  const q = searchInput ? searchInput.value : '';

  try {
    const res = await fetch(`${API_BASE}/api/invoices?search=${encodeURIComponent(q)}`);
    const data = await res.json();

    const tbody = document.getElementById('table-invoicing-body');
    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Belum ada invoice terarsip.</td></tr>`;
      return;
    }

    data.forEach(item => {
      const tr = document.createElement('tr');
      const formattedAmount = item.amount ? `Rp ${parseFloat(item.amount).toLocaleString('id-ID')}` : 'Rp 0';
      const statusBadgeClass = `badge-status-${item.status.toLowerCase()}`;

      tr.innerHTML = `
        <td class="bold font-mono">${item.number}</td>
        <td>${item.client}</td>
        <td>${formatDateString(item.date)}</td>
        <td>${formatDateString(item.dueDate)}</td>
        <td class="bold">${formattedAmount}</td>
        <td>${item.unitName}</td>
        <td><span class="badge ${statusBadgeClass}">${item.status}</span></td>
        <td class="actions-column">
          <div class="action-buttons-group">
            ${item.filePath ? `
              <button class="btn-icon-only" onclick="previewFile('${item.filePath}', '${item.number}')" title="Preview File">
                <i data-lucide="eye"></i>
              </button>
            ` : ''}
            <button class="btn-icon-only" onclick="editInvoice('${item.id}')" title="Edit Data">
              <i data-lucide="edit-2"></i>
            </button>
            <button class="btn-icon-only delete" onclick="deleteInvoice('${item.id}')" title="Hapus Data">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    lucide.createIcons();
  } catch(e) {}
}

async function openInvoiceModal(editId = null) {
  const modal = document.getElementById('modal-invoice');
  const form = document.getElementById('form-invoice');
  form.reset();

  document.getElementById('i-id').value = editId || '';
  await loadUnitsDropdown('i-unit');

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('i-date').value = today;
  document.getElementById('i-due-date').value = today;

  document.getElementById('modal-i-title').innerText = editId ? 'Edit Invoice' : 'Tambah Invoice';

  if (editId) {
    try {
      const res = await fetch(`${API_BASE}/api/invoices`);
      const list = await res.json();
      const current = list.find(item => item.id === editId);
      if (current) {
        document.getElementById('i-number').value = current.number;
        document.getElementById('i-unit').value = current.unitId;
        document.getElementById('i-date').value = current.date;
        document.getElementById('i-due-date').value = current.dueDate;
        document.getElementById('i-amount').value = current.amount;
        document.getElementById('i-client').value = current.client;
        document.getElementById('i-status').value = current.status;
      }
    } catch(e) {}
  }

  modal.classList.add('active');
  lucide.createIcons();
}

function closeInvoiceModal() {
  document.getElementById('modal-invoice').classList.remove('active');
}

async function handleInvoiceSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('i-id').value;

  const formData = new FormData();
  formData.append('category', 'invoicing');
  formData.append('number', document.getElementById('i-number').value);
  formData.append('unitId', document.getElementById('i-unit').value);
  formData.append('date', document.getElementById('i-date').value);
  formData.append('dueDate', document.getElementById('i-due-date').value);
  formData.append('amount', document.getElementById('i-amount').value);
  formData.append('client', document.getElementById('i-client').value);
  formData.append('status', document.getElementById('i-status').value);

  const fileInput = document.getElementById('i-file');
  if (fileInput.files[0]) {
    formData.append('document', fileInput.files[0]);
  }

  const url = id ? `${API_BASE}/api/invoices/${id}` : `${API_BASE}/api/invoices`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      body: formData
    });

    if (res.ok) {
      closeInvoiceModal();
      loadInvoiceData();
    } else {
      alert('Gagal menyimpan invoice.');
    }
  } catch(e) {}
}

function editInvoice(id) {
  openInvoiceModal(id);
}

async function deleteInvoice(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus invoice ini?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/invoices/${id}`, { method: 'DELETE' });
    if (res.ok) loadInvoiceData();
  } catch(e) {}
}


// ==========================================
// 6. UNIT KERJA SETTINGS LOGIC
// ==========================================
async function fetchUnits() {
  try {
    const res = await fetch(`${API_BASE}/api/units`);
    cachedUnits = await res.json();
    return cachedUnits;
  } catch(e) {
    return [];
  }
}

async function loadUnitData() {
  const units = await fetchUnits();
  const tbody = document.getElementById('table-units-body');
  tbody.innerHTML = '';

  if (units.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center">Belum ada unit terdaftar.</td></tr>`;
    return;
  }

  units.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${u.name}</td>
      <td><span class="badge badge-status-draft">${u.code}</span></td>
      <td class="actions-column">
        <div class="action-buttons-group">
          <button class="btn-icon-only" onclick="editUnit('${u.id}', '${u.name}', '${u.code}')" title="Edit Unit">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="btn-icon-only delete" onclick="deleteUnit('${u.id}')" title="Hapus Unit">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

async function handleUnitSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('unit-id').value;
  const name = document.getElementById('unit-name').value;
  const code = document.getElementById('unit-code').value;

  const url = id ? `${API_BASE}/api/units/${id}` : `${API_BASE}/api/units`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code })
    });

    if (res.ok) {
      resetUnitForm();
      loadUnitData();
    }
  } catch(err) {}
}

function editUnit(id, name, code) {
  document.getElementById('unit-id').value = id;
  document.getElementById('unit-name').value = name;
  document.getElementById('unit-code').value = code;
  
  document.getElementById('unit-form-title').innerText = 'Edit Unit Kerja';
  document.getElementById('btn-cancel-unit').classList.remove('hidden');
}

async function deleteUnit(id) {
  if (!confirm('Hapus unit ini? Unit yang terikat dengan nomor surat lama tidak akan terganggu.')) return;
  try {
    await fetch(`${API_BASE}/api/units/${id}`, { method: 'DELETE' });
    loadUnitData();
  } catch(e) {}
}

function resetUnitForm() {
  document.getElementById('unit-id').value = '';
  document.getElementById('unit-name').value = '';
  document.getElementById('unit-code').value = '';
  document.getElementById('unit-form-title').innerText = 'Tambah Unit Kerja';
  document.getElementById('btn-cancel-unit').classList.add('hidden');
}


// ==========================================
// 7. FORMAT NOMOR SETTINGS LOGIC
// ==========================================
async function loadFormatData() {
  try {
    const res = await fetch(`${API_BASE}/api/number-formats`);
    cachedFormats = await res.json();

    const tbody = document.getElementById('table-formats-body');
    tbody.innerHTML = '';

    cachedFormats.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">${f.name}</td>
        <td>
          <input type="text" class="form-group" style="width: 100%; font-family: monospace; font-size: 13px; font-weight: 600;" 
                 id="format-input-${f.id}" value="${f.format}">
        </td>
        <td class="actions-column">
          <button class="btn btn-primary btn-small" onclick="saveFormat('${f.id}')">
            <i data-lucide="save"></i> Simpan
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    lucide.createIcons();
  } catch(e) {}
}

async function saveFormat(id) {
  const newFormat = document.getElementById(`format-input-${id}`).value;
  try {
    const res = await fetch(`${API_BASE}/api/number-formats/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: newFormat })
    });
    if (res.ok) {
      alert('Format penomoran berhasil disimpan!');
      loadFormatData();
    }
  } catch(e) {}
}


// ==========================================
// 8. PREVIEW FILE LOGIC
// ==========================================
function previewFile(filePath, documentName) {
  const modal = document.getElementById('modal-preview');
  document.getElementById('modal-preview-title').innerText = `Preview: ${documentName}`;
  
  // Set Download Link
  const downloadBtn = document.getElementById('btn-download-file');
  downloadBtn.href = filePath;

  const contentBox = document.getElementById('preview-content-box');
  contentBox.innerHTML = '';

  const ext = filePath.split('.').pop().toLowerCase();
  
  if (ext === 'pdf') {
    // Tampilkan PDF memakai iframe
    contentBox.innerHTML = `<iframe src="${filePath}"></iframe>`;
  } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    // Tampilkan gambar memakai img tag
    contentBox.innerHTML = `<img src="${filePath}" alt="${documentName}">`;
  } else {
    contentBox.innerHTML = `
      <div class="text-center p-4">
        <i data-lucide="file-warning" style="width:48px; height:48px; color:var(--primary-color);"></i>
        <p class="mt-2">Format file <strong>.${ext}</strong> tidak dapat di-preview secara langsung.</p>
        <p class="text-muted">Silakan klik tombol download di atas untuk mengunduh dokumen.</p>
      </div>
    `;
    lucide.createIcons();
  }

  modal.classList.add('active');
  lucide.createIcons();
}

function closePreviewModal() {
  document.getElementById('modal-preview').classList.remove('active');
  // Bersihkan iframe agar tidak loading di background
  document.getElementById('preview-content-box').innerHTML = '';
}


// ==========================================
// 9. AUTOMATED "AMBIL NOMOR" CONTROLLER
// ==========================================
async function openSelectorModal(type, targetInputId) {
  currentSelectorTargetInput = document.getElementById(targetInputId);
  const modal = document.getElementById('modal-selector');
  const container = document.getElementById('selector-number-list');
  container.innerHTML = '<div class="text-center text-muted py-4">Memuat nomor...</div>';

  try {
    // 1. Ambil nomor yang digenerate dari API
    const resNumbers = await fetch(`${API_BASE}/api/generated-numbers`);
    const allGenerated = await resNumbers.json();
    const filteredGenerated = allGenerated.filter(item => item.type === type);

    // 2. Ambil dokumen yang sudah ada untuk memeriksa nomor terpakai
    let resDocs;
    let usedNumbers = new Set();

    if (type === 'masuk' || type === 'keluar') {
      resDocs = await fetch(`${API_BASE}/api/surat?type=${type}`);
      const docs = await resDocs.json();
      docs.forEach(d => usedNumbers.add(d.number));
    } else if (type === 'quotation') {
      resDocs = await fetch(`${API_BASE}/api/quotations`);
      const docs = await resDocs.json();
      docs.forEach(d => usedNumbers.add(d.number));
    } else if (type === 'invoicing') {
      resDocs = await fetch(`${API_BASE}/api/invoices`);
      const docs = await resDocs.json();
      docs.forEach(d => usedNumbers.add(d.number));
    }

    // 3. Filter nomor yang belum terpakai sama sekali
    const unusedNumbers = filteredGenerated.filter(g => !usedNumbers.has(g.number));

    container.innerHTML = '';

    if (unusedNumbers.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4">
          <p class="text-muted">Tidak ada nomor generated yang tersedia.</p>
          <a href="#" class="btn btn-primary btn-small mt-2" onclick="closeSelectorModal(); switchPage('generator');">Generate Nomor Baru</a>
        </div>
      `;
      modal.classList.add('active');
      return;
    }

    unusedNumbers.forEach(item => {
      const div = document.createElement('div');
      div.className = 'selector-item';
      div.onclick = () => selectNumber(item.number);
      div.innerHTML = `
        <div class="selector-item-num">${item.number}</div>
        <div class="selector-item-unit">${item.unitName}</div>
      `;
      container.appendChild(div);
    });

    modal.classList.add('active');
  } catch(e) {
    container.innerHTML = '<div class="text-center text-danger py-4">Gagal memuat nomor.</div>';
  }
}

function closeSelectorModal() {
  document.getElementById('modal-selector').classList.remove('active');
}

function selectNumber(number) {
  if (currentSelectorTargetInput) {
    currentSelectorTargetInput.value = number;
  }
  closeSelectorModal();
}
