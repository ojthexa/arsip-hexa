// FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyBHABjgAm-6m47H6FSDJ4QtZ_sdES6b0l0",
  authDomain: "arsip-hexa.firebaseapp.com",
  projectId: "arsip-hexa",
  storageBucket: "arsip-hexa.firebasestorage.app",
  messagingSenderId: "582953401500",
  appId: "1:582953401500:web:ea71b3f0bbddf766b5c159",
  measurementId: "G-7EJNVJ0S6D"
};

// Initialize Firebase
let db = null;

try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  } else {
    console.error("Firebase SDK tidak terdefinisi. Periksa koneksi internet atau pemblokir iklan.");
  }
} catch (e) {
  console.error("Gagal menginisialisasi Firebase:", e.message);
}

// CLOUDINARY CONFIGURATION & HELPERS
const cloudinaryConfig = {
  cloudName: "dvioaqz1i",
  apiKey: "319971473568786",
  apiSecret: "FMLsvi-omSbeFkWeNxm7mm_7ozM"
};

async function sha1(string) {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-1', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function uploadToCloudinary(file, folder) {
  const timestamp = Math.round(Date.now() / 1000);
  const stringToSign = `folder=${folder}&timestamp=${timestamp}${cloudinaryConfig.apiSecret}`;
  const signature = await sha1(stringToSign);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('timestamp', timestamp);
  formData.append('api_key', cloudinaryConfig.apiKey);
  formData.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error ? errData.error.message : 'Gagal upload ke Cloudinary');
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    name: data.original_filename + '.' + data.format
  };
}

// STATE GLOBAL
let activePage = 'dashboard';
let cachedUnits = [];
let cachedFormats = [];
let currentSelectorTargetInput = null;

// AUTHENTICATION LOGIC
function checkAuth() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');

  if (isLoggedIn) {
    if (loginContainer) loginContainer.classList.add('hidden');
    if (appContainer) appContainer.style.display = 'flex';
  } else {
    if (loginContainer) loginContainer.classList.remove('hidden');
    if (appContainer) appContainer.style.display = 'none';
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorMsg = document.getElementById('login-error');

  if (email === 'admin@gmail.com' && password === 'admin123') {
    localStorage.setItem('isLoggedIn', 'true');
    if (errorMsg) errorMsg.classList.add('hidden');
    checkAuth();
  } else {
    if (errorMsg) errorMsg.classList.remove('hidden');
  }
}

function handleLogout() {
  if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
    localStorage.removeItem('isLoggedIn');
    checkAuth();
  }
}

// DOM ELEMENTS & INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  // Check auth first
  checkAuth();

  // Attach login listener
  const loginForm = document.getElementById('form-login');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  // Attach logout listener
  const logoutProfile = document.getElementById('user-profile-logout');
  if (logoutProfile) {
    logoutProfile.addEventListener('click', handleLogout);
  }

  // Initialize Lucide Icons
  try {
    lucide.createIcons();
  } catch(e) {}

  // Navigation Links - Didaftarkan pertama kali agar menu selalu berfungsi
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = item.getAttribute('data-page');
      switchPage(pageId);
    });
  });

  // Setup Event Listeners
  try {
    setupEventListeners();
  } catch(e) {}

  // Load Awal Halaman
  switchPage('dashboard');

  // Jalankan inisialisasi Firebase secara asinkron tanpa memblokir UI utama
  if (db) {
    initializeFirebaseAndLoad();
  } else {
    const headerIndicator = document.getElementById('conn-indicator');
    const headerText = document.getElementById('conn-status-text');
    if (headerIndicator && headerText) {
      headerIndicator.className = 'status-indicator';
      headerIndicator.style.backgroundColor = '#d32f2f';
      headerIndicator.style.boxShadow = '0 0 8px rgba(211, 47, 47, 0.4)';
      headerText.innerText = 'Firebase SDK Eror';
    }
    alert("Firebase SDK gagal dimuat. Periksa koneksi internet Anda atau matikan adblocker.");
  }
});

async function initializeFirebaseAndLoad() {
  try {
    await initializeFirebaseDb();
    loadDashboardData();
    // Jalankan tes diagnostik secara senyap untuk mengupdate indikator di header
    runConnectionDiagnostics();
  } catch (err) {
    console.error("Gagal memuat data Firebase pada start-up:", err.message);
  }
}


// INITIALIZE DEFAULT FIREBASE DATA
async function initializeFirebaseDb() {
  try {
    // 1. Inisialisasi Unit jika kosong
    const unitsSnap = await db.collection('units').get();
    if (unitsSnap.empty) {
      const defaultUnits = [
        { name: 'Bagian Umum', code: 'UM' },
        { name: 'Kepegawaian', code: 'KEP' },
        { name: 'Keuangan', code: 'KEU' },
        { name: 'Perencanaan', code: 'REN' }
      ];
      for (const u of defaultUnits) {
        await db.collection('units').add(u);
      }
    }

    // 2. Inisialisasi Format Penomoran jika kosong
    const formatsSnap = await db.collection('number_formats').get();
    if (formatsSnap.empty) {
      const defaultFormats = [
        { id: 'masuk', name: 'Surat Masuk', format: 'SM/[NOMOR]/[UNIT]/[BULAN-ROMAWI]/[TAHUN]' },
        { id: 'keluar', name: 'Surat Keluar', format: 'SK/[NOMOR]/[UNIT]/[BULAN-ROMAWI]/[TAHUN]' },
        { id: 'quotation', name: 'Quotation', format: 'QT/[NOMOR]/[UNIT]/[BULAN]/[TAHUN]' },
        { id: 'invoicing', name: 'Invoicing', format: 'INV/[NOMOR]/[UNIT]/[BULAN]/[TAHUN]' }
      ];
      for (const fmt of defaultFormats) {
        await db.collection('number_formats').doc(fmt.id).set({
          name: fmt.name,
          format: fmt.format
        });
      }
    }

    // 3. Inisialisasi Daftar Klien jika kosong
    const clientsSnap = await db.collection('clients').get();
    if (clientsSnap.empty) {
      const defaultClients = [
        { name: 'PT. Telkom Indonesia', code: 'TLK', category: 'BUMN' },
        { name: 'Kementerian Keuangan', code: 'KEU', category: 'Pemerintah' },
        { name: 'PT. Solusi Prima', code: 'SLP', category: 'Swasta' }
      ];
      for (const c of defaultClients) {
        await db.collection('clients').add(c);
      }
    }
  } catch (err) {
    console.error('Firebase DB initialization error:', err.message);
  }
}

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
  } else if (pageId === 'klien') {
    loadKlienData();
  }
}

// SETUP LISTENERS
function setupEventListeners() {
  // Form Unit Kerja
  document.getElementById('form-unit').addEventListener('submit', handleUnitSubmit);
  document.getElementById('btn-cancel-unit').addEventListener('click', resetUnitForm);

  // Form Klien
  document.getElementById('form-klien').addEventListener('submit', handleKlienSubmit);
  document.getElementById('btn-cancel-klien').addEventListener('click', resetKlienForm);
  document.getElementById('filter-klien-category').addEventListener('change', loadKlienData);

  // Form Generator Nomor
  document.getElementById('form-generator').addEventListener('submit', handleGenerateNumber);
  document.getElementById('gen-type').addEventListener('change', handleGenTypeChange);
  
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

  // Theme Toggle Listener
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    themeBtn.innerHTML = currentTheme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    try {
      lucide.createIcons();
    } catch(e) {}

    themeBtn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = activeTheme === 'light' ? 'dark' : 'light';
      
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('theme', nextTheme);
      
      themeBtn.innerHTML = nextTheme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
      try {
        lucide.createIcons();
      } catch(e) {}
    });
  }
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
    // Ambil semua data secara asinkron dari Firebase
    const suratSnap = await db.collection('surat').get();
    const quotationsSnap = await db.collection('quotations').get();
    const invoicesSnap = await db.collection('invoices').get();
    const generatedSnap = await db.collection('generated_numbers').get();
    const unitsSnap = await db.collection('units').get();

    // Hitung Total Dokumen
    const totalMasuk = suratSnap.docs.filter(doc => doc.data().type === 'masuk').length;
    const totalKeluar = suratSnap.docs.filter(doc => doc.data().type === 'keluar').length;
    const totalQuotation = quotationsSnap.size;
    const totalInvoice = invoicesSnap.size;

    // Tampilkan Total
    document.getElementById('stat-masuk').innerText = totalMasuk.toLocaleString('id-ID');
    document.getElementById('stat-keluar').innerText = totalKeluar.toLocaleString('id-ID');
    document.getElementById('stat-quotation').innerText = totalQuotation.toLocaleString('id-ID');
    document.getElementById('stat-invoice').innerText = totalInvoice.toLocaleString('id-ID');

    // Susun Aktivitas Terbaru
    const activities = [];

    suratSnap.forEach(doc => {
      const d = doc.data();
      activities.push({
        title: d.subject || 'Surat Tanpa Perihal',
        category: d.type === 'masuk' ? 'Surat Masuk' : 'Surat Keluar',
        meta: d.senderOrReceiver,
        time: d.createdAt,
        type: 'surat'
      });
    });

    quotationsSnap.forEach(doc => {
      const d = doc.data();
      activities.push({
        title: d.subject || 'Penawaran',
        category: 'Quotation',
        meta: d.client,
        time: d.createdAt,
        type: 'quotation'
      });
    });

    invoicesSnap.forEach(doc => {
      const d = doc.data();
      activities.push({
        title: `Invoice #${d.number}`,
        category: 'Invoicing',
        meta: d.client,
        time: d.createdAt,
        type: 'invoice'
      });
    });

    generatedSnap.forEach(doc => {
      const d = doc.data();
      activities.push({
        title: d.number,
        category: 'Generator Nomor',
        meta: d.unitName,
        time: d.createdAt,
        type: 'number'
      });
    });

    // Urutkan aktivitas terbaru (descending)
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const recentActivities = activities.slice(0, 7);

    // Populate Aktivitas Terbaru ke UI
    const actList = document.getElementById('recent-activities');
    actList.innerHTML = '';
    
    if (recentActivities.length === 0) {
      actList.innerHTML = `<li class="text-center text-muted py-4">Belum ada aktivitas dokumen saat ini.</li>`;
    } else {
      recentActivities.forEach(act => {
        const item = document.createElement('li');
        item.className = 'activity-item';
        const timeFormatted = formatTimeDifference(new Date(act.time));

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

    // Hitung statistik per unit kerja
    const unitStats = {};
    unitsSnap.forEach(doc => {
      unitStats[doc.data().name] = 0;
    });

    // Masukkan hitungan dokumen
    suratSnap.forEach(doc => {
      const name = doc.data().unitName;
      if (name && unitStats[name] !== undefined) unitStats[name]++;
    });
    quotationsSnap.forEach(doc => {
      const name = doc.data().unitName;
      if (name && unitStats[name] !== undefined) unitStats[name]++;
    });
    invoicesSnap.forEach(doc => {
      const name = doc.data().unitName;
      if (name && unitStats[name] !== undefined) unitStats[name]++;
    });

    const unitStatsArray = Object.keys(unitStats).map(key => ({
      name: key,
      count: unitStats[key]
    })).sort((a, b) => b.count - a.count);

    // Populate Grafik Unit ke UI
    const unitList = document.getElementById('unit-stats');
    unitList.innerHTML = '';

    if (unitStatsArray.length === 0) {
      unitList.innerHTML = `<li class="text-center text-muted py-4">Belum ada unit kerja terdaftar.</li>`;
    } else {
      const maxCount = Math.max(...unitStatsArray.map(u => u.count), 1);
      
      unitStatsArray.forEach(u => {
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
    await loadUnitsDropdown('gen-unit');
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
    const snap = await db.collection('generated_numbers').orderBy('createdAt', 'desc').limit(20).get();
    const tbody = document.getElementById('table-generated-numbers-body');
    tbody.innerHTML = '';

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center">Belum ada nomor yang digenerate.</td></tr>`;
      return;
    }

    snap.forEach(doc => {
      const item = doc.data();
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
    const formatDoc = await db.collection('number_formats').doc(type).get();
    const unitDoc = await db.collection('units').doc(unitId).get();

    if (!formatDoc.exists || !unitDoc.exists) {
      alert('Format penomoran atau Unit Kerja tidak ditemukan.');
      return;
    }

    const formatPattern = formatDoc.data().format;
    const unitObj = unitDoc.data();

    const currentYear = new Date().getFullYear();
    const currentMonthNum = new Date().getMonth() + 1;
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const currentMonthRoman = romanMonths[currentMonthNum - 1];

    // Hitung nomor urut berikutnya berdasarkan jenis dokumen dan tahun berjalan
    const countSnap = await db.collection('generated_numbers')
      .where('type', '==', type)
      .where('year', '==', currentYear)
      .get();
      
    const nextNum = countSnap.size + 1;
    const paddedNum = String(nextNum).padStart(3, '0');

    // Ganti token dalam pola format
    let generated = formatPattern
      .replace('[NOMOR]', paddedNum)
      .replace('[UNIT]', unitObj.code)
      .replace('[BULAN]', String(currentMonthNum).padStart(2, '0'))
      .replace('[BULAN-ROMAWI]', currentMonthRoman)
      .replace('[TAHUN]', String(currentYear));

    const newNumRecord = {
      number: generated,
      type,
      unitName: unitObj.name,
      unitCode: unitObj.code,
      year: currentYear,
      createdAt: new Date().toISOString()
    };

    if (formatPattern.includes('[KLIEN]')) {
      const clientCode = document.getElementById('gen-client').value;
      if (!clientCode) {
        alert('Klien harus dipilih untuk format penomoran ini.');
        return;
      }
      generated = generated.replace('[KLIEN]', clientCode);
      newNumRecord.number = generated;
      newNumRecord.clientCode = clientCode;
    }

    await db.collection('generated_numbers').add(newNumRecord);
    
    // Tampilkan Hasil
    document.getElementById('generated-number-value').innerText = generated;
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
  const q = searchInput ? searchInput.value.toLowerCase() : '';

  try {
    const snap = await db.collection('surat').where('type', '==', type).get();
    
    const tbody = document.getElementById(`table-surat-${type}-body`);
    tbody.innerHTML = '';

    let list = [];
    snap.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });

    // Urutkan berdasarkan tanggal terbuat descending (karena offline filter manual)
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Lakukan pencarian client-side
    if (q) {
      list = list.filter(s => 
        (s.number && s.number.toLowerCase().includes(q)) ||
        (s.senderOrReceiver && s.senderOrReceiver.toLowerCase().includes(q)) ||
        (s.subject && s.subject.toLowerCase().includes(q)) ||
        (s.unitName && s.unitName.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">Belum ada arsip surat.</td></tr>`;
      return;
    }

    list.forEach(item => {
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
  } catch (err) {
    console.error(err);
  }
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
    document.getElementById('btn-use-gen-number').style.display = 'none';
  } else {
    document.getElementById('modal-doc-title').innerText = editId ? 'Edit Surat Keluar' : 'Tambah Surat Keluar';
    document.getElementById('lbl-sender').innerText = 'Tujuan Surat (Penerima) *';
    document.getElementById('lbl-received-date').innerText = 'Tanggal Dikirim';
    document.getElementById('doc-sender').placeholder = 'Contoh: PT. Hexa Jaya Sentosa';
    document.getElementById('btn-use-gen-number').style.display = 'inline-block';
  }

  // Jika Edit mode, ambil data dari Firebase
  if (editId) {
    try {
      const doc = await db.collection('surat').doc(editId).get();
      if (doc.exists) {
        const current = doc.data();
        document.getElementById('doc-number').value = current.number;
        document.getElementById('doc-unit').value = current.unitId;
        document.getElementById('doc-date').value = current.date;
        document.getElementById('doc-received-date').value = current.receivedOrSentDate;
        document.getElementById('doc-sender').value = current.senderOrReceiver;
        document.getElementById('doc-subject').value = current.subject;
        if (current.fileName) {
          let previewBtnHtml = '';
          if (current.filePath) {
            previewBtnHtml = `<button type="button" class="btn btn-outline btn-small px-2 py-1 ms-2" style="display:inline-flex; align-items:center; gap:4px;" onclick="previewFile('${current.filePath}', '${current.number}')"><i data-lucide="eye" style="width:14px; height:14px;"></i> Preview</button>`;
          }
          document.getElementById('doc-file-info').innerHTML = `File saat ini: <strong>${current.fileName}</strong>${previewBtnHtml} <br><small class="text-muted">(Unggah lagi untuk mengganti)</small>`;
        } else {
          document.getElementById('doc-file-info').innerText = '';
        }
      }
    } catch(e) {}
  } else {
    document.getElementById('doc-file-info').innerText = 'File akan disimpan di Cloud Storage (Cloudinary).';
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

  const docNumber = document.getElementById('doc-number').value;
  const unitId = document.getElementById('doc-unit').value;
  const date = document.getElementById('doc-date').value;
  const receivedOrSentDate = document.getElementById('doc-received-date').value;
  const senderOrReceiver = document.getElementById('doc-sender').value;
  const subject = document.getElementById('doc-subject').value;

  const unitObj = cachedUnits.find(u => u.id === unitId) || {};
  const fileInput = document.getElementById('doc-file');
  const file = fileInput.files[0];

  try {
    let filePath = '';
    let fileName = '';

    // Upload file ke Cloudinary jika ada file terpilih
    if (file) {
      const uploadResult = await uploadToCloudinary(file, 'surat');
      filePath = uploadResult.url;
      fileName = file.name;
    }

    const docData = {
      type,
      number: docNumber,
      unitId,
      unitName: unitObj.name || '',
      date,
      receivedOrSentDate: receivedOrSentDate || date,
      senderOrReceiver,
      subject
    };

    if (file) {
      docData.filePath = filePath;
      docData.fileName = fileName;
    }

    if (id) {
      await db.collection('surat').doc(id).update(docData);
    } else {
      docData.createdAt = new Date().toISOString();
      await db.collection('surat').add(docData);
    }

    closeDocModal();
    loadSuratData(type);
  } catch(e) {
    console.error("Gagal menyimpan surat:", e);
    alert('Gagal menyimpan surat ke cloud: ' + e.message);
  }
}

async function editSurat(id, type) {
  openDocModal(type, id);
}

async function deleteSurat(id, type) {
  if (!confirm('Apakah Anda yakin ingin menghapus data surat ini?')) return;

  try {
    await db.collection('surat').doc(id).delete();
    loadSuratData(type);
  } catch(e) {
    console.error("Gagal menghapus surat:", e);
    alert("Gagal menghapus surat: " + e.message);
  }
}


// ==========================================
// 4. QUOTATION LOGIC
// ==========================================
async function loadQuotationData() {
  const searchInput = document.getElementById('search-quotation');
  const q = searchInput ? searchInput.value.toLowerCase() : '';

  try {
    const snap = await db.collection('quotations').get();
    const tbody = document.getElementById('table-quotation-body');
    tbody.innerHTML = '';

    let list = [];
    snap.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });

    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (q) {
      list = list.filter(item => 
        (item.number && item.number.toLowerCase().includes(q)) ||
        (item.client && item.client.toLowerCase().includes(q)) ||
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.unitName && item.unitName.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Belum ada quotation terarsip.</td></tr>`;
      return;
    }

    list.forEach(item => {
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
  await loadClientsDropdown('q-client');

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('q-date').value = today;

  document.getElementById('modal-q-title').innerText = editId ? 'Edit Quotation' : 'Tambah Quotation';

  if (editId) {
    try {
      const doc = await db.collection('quotations').doc(editId).get();
      if (doc.exists) {
        const current = doc.data();
        document.getElementById('q-number').value = current.number;
        document.getElementById('q-unit').value = current.unitId;
        document.getElementById('q-date').value = current.date;
        document.getElementById('q-amount').value = current.amount;
        document.getElementById('q-client').value = current.client;
        document.getElementById('q-status').value = current.status;
        document.getElementById('q-subject').value = current.subject;
        if (current.fileName) {
          let previewBtnHtml = '';
          if (current.filePath) {
            previewBtnHtml = `<button type="button" class="btn btn-outline btn-small px-2 py-1 ms-2" style="display:inline-flex; align-items:center; gap:4px;" onclick="previewFile('${current.filePath}', '${current.number}')"><i data-lucide="eye" style="width:14px; height:14px;"></i> Preview</button>`;
          }
          document.getElementById('q-file-info').innerHTML = `File saat ini: <strong>${current.fileName}</strong>${previewBtnHtml} <br><small class="text-muted">(Unggah lagi untuk mengganti)</small>`;
        } else {
          document.getElementById('q-file-info').innerText = '';
        }
      }
    } catch(e) {}
  } else {
    document.getElementById('q-file-info').innerText = 'File akan disimpan di Cloud Storage (Cloudinary).';
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

  const number = document.getElementById('q-number').value;
  const unitId = document.getElementById('q-unit').value;
  const date = document.getElementById('q-date').value;
  const amount = document.getElementById('q-amount').value;
  const client = document.getElementById('q-client').value;
  const status = document.getElementById('q-status').value;
  const subject = document.getElementById('q-subject').value;

  const unitObj = cachedUnits.find(u => u.id === unitId) || {};
  const fileInput = document.getElementById('q-file');
  const file = fileInput.files[0];

  try {
    let filePath = '';
    let fileName = '';

    if (file) {
      const uploadResult = await uploadToCloudinary(file, 'quotation');
      filePath = uploadResult.url;
      fileName = file.name;
    }

    const qData = {
      number,
      unitId,
      unitName: unitObj.name || '',
      date,
      amount: parseFloat(amount) || 0,
      client,
      status,
      subject
    };

    if (file) {
      qData.filePath = filePath;
      qData.fileName = fileName;
    }

    if (id) {
      await db.collection('quotations').doc(id).update(qData);
    } else {
      qData.createdAt = new Date().toISOString();
      await db.collection('quotations').add(qData);
    }

    closeQuotationModal();
    loadQuotationData();
  } catch(e) {
    console.error("Gagal menyimpan quotation:", e);
    alert('Gagal menyimpan quotation ke cloud: ' + e.message);
  }
}

function editQuotation(id) {
  openQuotationModal(id);
}

async function deleteQuotation(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus quotation ini?')) return;
  try {
    await db.collection('quotations').doc(id).delete();
    loadQuotationData();
  } catch(e) {
    console.error("Gagal menghapus quotation:", e);
    alert("Gagal menghapus quotation: " + e.message);
  }
}


// ==========================================
// 5. INVOICING LOGIC
// ==========================================
async function loadInvoiceData() {
  const searchInput = document.getElementById('search-invoicing');
  const q = searchInput ? searchInput.value.toLowerCase() : '';

  try {
    const snap = await db.collection('invoices').get();
    const tbody = document.getElementById('table-invoicing-body');
    tbody.innerHTML = '';

    let list = [];
    snap.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });

    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (q) {
      list = list.filter(item => 
        (item.number && item.number.toLowerCase().includes(q)) ||
        (item.client && item.client.toLowerCase().includes(q)) ||
        (item.unitName && item.unitName.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Belum ada invoice terarsip.</td></tr>`;
      return;
    }

    list.forEach(item => {
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
  await loadClientsDropdown('i-client');

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('i-date').value = today;
  document.getElementById('i-due-date').value = today;

  document.getElementById('modal-i-title').innerText = editId ? 'Edit Invoice' : 'Tambah Invoice';

  if (editId) {
    try {
      const doc = await db.collection('invoices').doc(editId).get();
      if (doc.exists) {
        const current = doc.data();
        document.getElementById('i-number').value = current.number;
        document.getElementById('i-unit').value = current.unitId;
        document.getElementById('i-date').value = current.date;
        document.getElementById('i-due-date').value = current.dueDate;
        document.getElementById('i-amount').value = current.amount;
        document.getElementById('i-client').value = current.client;
        document.getElementById('i-status').value = current.status;
        if (current.fileName) {
          let previewBtnHtml = '';
          if (current.filePath) {
            previewBtnHtml = `<button type="button" class="btn btn-outline btn-small px-2 py-1 ms-2" style="display:inline-flex; align-items:center; gap:4px;" onclick="previewFile('${current.filePath}', '${current.number}')"><i data-lucide="eye" style="width:14px; height:14px;"></i> Preview</button>`;
          }
          document.getElementById('i-file-info').innerHTML = `File saat ini: <strong>${current.fileName}</strong>${previewBtnHtml} <br><small class="text-muted">(Unggah lagi untuk mengganti)</small>`;
        } else {
          document.getElementById('i-file-info').innerText = '';
        }
      }
    } catch(e) {}
  } else {
    document.getElementById('i-file-info').innerText = 'File akan disimpan di Cloud Storage (Cloudinary).';
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

  const number = document.getElementById('i-number').value;
  const unitId = document.getElementById('i-unit').value;
  const date = document.getElementById('i-date').value;
  const dueDate = document.getElementById('i-due-date').value;
  const amount = document.getElementById('i-amount').value;
  const client = document.getElementById('i-client').value;
  const status = document.getElementById('i-status').value;

  const unitObj = cachedUnits.find(u => u.id === unitId) || {};
  const fileInput = document.getElementById('i-file');
  const file = fileInput.files[0];

  try {
    let filePath = '';
    let fileName = '';

    if (file) {
      const uploadResult = await uploadToCloudinary(file, 'invoicing');
      filePath = uploadResult.url;
      fileName = file.name;
    }

    const iData = {
      number,
      unitId,
      unitName: unitObj.name || '',
      date,
      dueDate: dueDate || '',
      amount: parseFloat(amount) || 0,
      client,
      status
    };

    if (file) {
      iData.filePath = filePath;
      iData.fileName = fileName;
    }

    if (id) {
      await db.collection('invoices').doc(id).update(iData);
    } else {
      iData.createdAt = new Date().toISOString();
      await db.collection('invoices').add(iData);
    }

    closeInvoiceModal();
    loadInvoiceData();
  } catch(e) {
    console.error("Gagal menyimpan invoice:", e);
    alert('Gagal menyimpan invoice ke cloud: ' + e.message);
  }
}

function editInvoice(id) {
  openInvoiceModal(id);
}

async function deleteInvoice(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus invoice ini?')) return;
  try {
    await db.collection('invoices').doc(id).delete();
    loadInvoiceData();
  } catch(e) {
    console.error("Gagal menghapus invoice:", e);
    alert("Gagal menghapus invoice: " + e.message);
  }
}


// ==========================================
// 6. UNIT KERJA SETTINGS LOGIC
// ==========================================
async function fetchUnits() {
  try {
    const snap = await db.collection('units').get();
    cachedUnits = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
  const code = document.getElementById('unit-code').value.toUpperCase();

  try {
    if (id) {
      await db.collection('units').doc(id).update({ name, code });
    } else {
      await db.collection('units').add({ name, code });
    }
    resetUnitForm();
    loadUnitData();
    alert("Unit kerja berhasil disimpan!");
  } catch(err) {
    console.error("Gagal menyimpan unit:", err);
    alert("Gagal menyimpan unit: " + err.message + "\n\nPastikan database Firestore Anda diaktifkan dan Rules-nya memperbolehkan read/write (Test Mode).");
  }
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
    await db.collection('units').doc(id).delete();
    loadUnitData();
  } catch(e) {
    console.error("Gagal menghapus unit:", e);
    alert("Gagal menghapus unit: " + e.message);
  }
}

function resetUnitForm() {
  document.getElementById('unit-id').value = '';
  document.getElementById('unit-name').value = '';
  document.getElementById('unit-code').value = '';
  document.getElementById('unit-form-title').innerText = 'Tambah Unit Kerja';
  document.getElementById('btn-cancel-unit').classList.add('hidden');
}


// ==========================================
// 6b. CLIENTS SETTINGS LOGIC
// ==========================================
let cachedClients = [];

async function fetchClients() {
  try {
    const snap = await db.collection('clients').get();
    cachedClients = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return cachedClients;
  } catch(e) {
    return [];
  }
}

async function loadKlienData() {
  const filterVal = document.getElementById('filter-klien-category').value;
  const clients = await fetchClients();
  const tbody = document.getElementById('table-klien-body');
  tbody.innerHTML = '';

  const filteredClients = filterVal === 'all'
    ? clients
    : clients.filter(c => c.category === filterVal);

  if (filteredClients.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">Belum ada klien terdaftar untuk kategori ini.</td></tr>`;
    return;
  }

  filteredClients.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${c.name}</td>
      <td><span class="badge badge-status-draft">${c.code}</span></td>
      <td><span class="badge ${getClientCategoryBadgeClass(c.category)}">${c.category}</span></td>
      <td class="actions-column">
        <div class="action-buttons-group">
          <button class="btn-icon-only" onclick="editKlien('${c.id}', '${c.name.replace(/'/g, "\\'")}', '${c.code}', '${c.category}')" title="Edit Klien">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="btn-icon-only delete" onclick="deleteKlien('${c.id}')" title="Hapus Klien">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

function getClientCategoryBadgeClass(category) {
  if (category === 'Swasta') return 'badge-status-sent';
  if (category === 'BUMN') return 'badge-status-unpaid';
  if (category === 'Pemerintah') return 'badge-status-accepted';
  return 'badge-status-draft';
}

async function handleKlienSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('klien-id').value;
  const name = document.getElementById('klien-name').value;
  const code = document.getElementById('klien-code').value.toUpperCase();
  const category = document.getElementById('klien-category').value;

  try {
    if (id) {
      await db.collection('clients').doc(id).update({ name, code, category });
    } else {
      await db.collection('clients').add({ name, code, category });
    }
    resetKlienForm();
    loadKlienData();
    alert("Data klien berhasil disimpan!");
  } catch(err) {
    console.error("Gagal menyimpan klien:", err);
    alert("Gagal menyimpan klien: " + err.message);
  }
}

function editKlien(id, name, code, category) {
  document.getElementById('klien-id').value = id;
  document.getElementById('klien-name').value = name;
  document.getElementById('klien-code').value = code;
  document.getElementById('klien-category').value = category;

  document.getElementById('klien-form-title').innerText = 'Edit Data Klien';
  document.getElementById('btn-cancel-klien').classList.remove('hidden');
}

async function deleteKlien(id) {
  if (!confirm('Hapus klien ini? Nomor surat/dokumen lama tidak akan terganggu.')) return;
  try {
    await db.collection('clients').doc(id).delete();
    loadKlienData();
  } catch(e) {
    console.error("Gagal menghapus klien:", e);
    alert("Gagal menghapus klien: " + e.message);
  }
}

function resetKlienForm() {
  document.getElementById('klien-id').value = '';
  document.getElementById('klien-name').value = '';
  document.getElementById('klien-code').value = '';
  document.getElementById('klien-category').value = '';
  document.getElementById('klien-form-title').innerText = 'Tambah Klien';
  document.getElementById('btn-cancel-klien').classList.add('hidden');
}

async function loadClientsDropdown(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  
  const prevValue = select.value;
  
  select.innerHTML = `<option value="" disabled selected>Pilih Klien...</option>`;

  const clients = await fetchClients();
  clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.innerText = `${c.name} (${c.code})`;
    select.appendChild(opt);
  });
  
  if (prevValue) {
    select.value = prevValue;
  }
}

async function loadClientsDropdownForGenerator(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = `<option value="" disabled selected>Pilih Klien...</option>`;

  const clients = await fetchClients();
  clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.innerText = `${c.name} (${c.code})`;
    select.appendChild(opt);
  });
}

async function handleGenTypeChange() {
  const type = document.getElementById('gen-type').value;
  if (!type) return;

  try {
    const formatDoc = await db.collection('number_formats').doc(type).get();
    if (formatDoc.exists) {
      const formatPattern = formatDoc.data().format;
      const clientGroup = document.getElementById('gen-client-group');
      const clientSelect = document.getElementById('gen-client');

      if (formatPattern.includes('[KLIEN]')) {
        clientGroup.classList.remove('hidden');
        clientSelect.setAttribute('required', 'true');
        await loadClientsDropdownForGenerator('gen-client');
      } else {
        clientGroup.classList.add('hidden');
        clientSelect.removeAttribute('required');
      }
    }
  } catch (err) {
    console.error(err);
  }
}


// ==========================================
// 7. FORMAT NOMOR SETTINGS LOGIC
// ==========================================
async function loadFormatData() {
  try {
    const snap = await db.collection('number_formats').get();
    cachedFormats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
    await db.collection('number_formats').doc(id).update({ format: newFormat });
    alert('Format penomoran berhasil disimpan!');
    loadFormatData();
  } catch(e) {}
}


// ==========================================
// 8. PREVIEW FILE LOGIC
// ==========================================
function previewFile(filePath, documentName) {
  const modal = document.getElementById('modal-preview');
  document.getElementById('modal-preview-title').innerText = `Preview: ${documentName}`;
  
  // Set Download & Open in New Tab Links
  const downloadBtn = document.getElementById('btn-download-file');
  if (downloadBtn) downloadBtn.href = filePath;

  const openNewTabBtn = document.getElementById('btn-open-new-tab');
  if (openNewTabBtn) openNewTabBtn.href = filePath;

  const contentBox = document.getElementById('preview-content-box');
  contentBox.innerHTML = '';

  // Extract file extension from Cloudinary or Firebase URL
  const cleanPath = filePath.split('?')[0];
  const ext = cleanPath.split('.').pop().toLowerCase();
  
  if (ext === 'pdf') {
    contentBox.innerHTML = `<iframe src="${filePath}"></iframe>`;
  } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    contentBox.innerHTML = `<img src="${filePath}" alt="${documentName}">`;
  } else {
    // Check if URL contains markers of PDF or image
    if (filePath.includes('.pdf') || filePath.toLowerCase().includes('pdf')) {
      contentBox.innerHTML = `<iframe src="${filePath}"></iframe>`;
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|webp)/i)) {
      contentBox.innerHTML = `<img src="${filePath}" alt="${documentName}">`;
    } else {
      contentBox.innerHTML = `
        <div class="text-center p-4">
          <i data-lucide="file-warning" style="width:48px; height:48px; color:var(--primary-color);"></i>
          <p class="mt-2">Format file <strong>.${ext}</strong> tidak dapat di-preview secara langsung.</p>
          <p class="text-muted">Silakan gunakan tombol unduh atau buka di tab baru untuk melihat file.</p>
        </div>
      `;
      lucide.createIcons();
    }
  }

  modal.classList.add('active');
  lucide.createIcons();
}

function closePreviewModal() {
  document.getElementById('modal-preview').classList.remove('active');
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
    // 1. Ambil nomor yang digenerate dari Firebase
    const snapNumbers = await db.collection('generated_numbers').where('type', '==', type).get();
    
    // 2. Ambil dokumen terdaftar untuk memeriksa nomor terpakai
    let usedNumbers = new Set();

    if (type === 'masuk' || type === 'keluar') {
      const snapDocs = await db.collection('surat').where('type', '==', type).get();
      snapDocs.forEach(doc => usedNumbers.add(doc.data().number));
    } else if (type === 'quotation') {
      const snapDocs = await db.collection('quotations').get();
      snapDocs.forEach(doc => usedNumbers.add(doc.data().number));
    } else if (type === 'invoicing') {
      const snapDocs = await db.collection('invoices').get();
      snapDocs.forEach(doc => usedNumbers.add(doc.data().number));
    }

    // 3. Filter nomor generated yang belum digunakan
    const unusedNumbers = [];
    snapNumbers.forEach(doc => {
      const data = doc.data();
      if (!usedNumbers.has(data.number)) {
        unusedNumbers.push(data);
      }
    });

    // Urutkan nomor yang belum dipakai (descending)
    unusedNumbers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
    console.error(e);
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

// ==========================================
// 10. DIAGNOSTIC PANEL LOGIC
// ==========================================
function openDiagnosticModal() {
  const modal = document.getElementById('modal-diagnostic');
  modal.classList.add('active');
  runConnectionDiagnostics();
}

function closeDiagnosticModal() {
  document.getElementById('modal-diagnostic').classList.remove('active');
}

async function runConnectionDiagnostics() {
  const badgeSdk = document.getElementById('diag-firebase-sdk');
  const badgeFirestore = document.getElementById('diag-firestore');
  const badgeCloudinary = document.getElementById('diag-cloudinary');
  const errorBox = document.getElementById('diag-error-box');
  const errorMsg = document.getElementById('diag-error-message');
  const headerIndicator = document.getElementById('conn-indicator');
  const headerText = document.getElementById('conn-status-text');

  if (!badgeSdk || !badgeFirestore || !badgeCloudinary) return;

  // Reset UI
  badgeSdk.className = 'badge badge-status-draft';
  badgeSdk.innerText = 'Memeriksa...';
  badgeFirestore.className = 'badge badge-status-draft';
  badgeFirestore.innerText = 'Memeriksa...';
  badgeCloudinary.className = 'badge badge-status-draft';
  badgeCloudinary.innerText = 'Memeriksa...';
  errorBox.classList.add('hidden');
  errorMsg.innerText = '-';

  let sdkOk = false;
  let errors = [];

  // Helper Timeout
  const timeoutPromise = (ms, promise, errMsg) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(errMsg)), ms))
    ]);
  };

  // 1. Test Firebase SDK
  try {
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      badgeSdk.className = 'badge badge-status-accepted';
      badgeSdk.innerText = 'TERPASANG (CDN OK)';
      sdkOk = true;
    } else {
      badgeSdk.className = 'badge badge-status-rejected';
      badgeSdk.innerText = 'EROR / DIBLOKIR';
      errors.push("Firebase SDK tidak terdefinisi di browser. Kemungkinan diblokir oleh Adblocker atau browser tidak memiliki koneksi internet untuk mengunduh script dari gstatic.com.");
    }
  } catch(e) {
    badgeSdk.className = 'badge badge-status-rejected';
    badgeSdk.innerText = 'EROR';
    errors.push("Gagal mengecek SDK: " + e.message);
  }

  // Define test promises to run in parallel
  const firestoreTest = async () => {
    if (sdkOk && db) {
      try {
        const testRef = db.collection('diagnostic_test').doc('ping');
        
        // Wrap set and get in timeout
        await timeoutPromise(6000, testRef.set({ time: Date.now(), test: true }), "Timeout (6 detik) - Server database Firestore tidak merespon.");
        
        const doc = await timeoutPromise(6000, testRef.get(), "Timeout (6 detik) - Gagal membaca dokumen uji.");
        
        if (doc.exists && doc.data().test) {
          badgeFirestore.className = 'badge badge-status-accepted';
          badgeFirestore.innerText = 'TERHUBUNG (OK)';
          await testRef.delete().catch(() => {});
        } else {
          throw new Error("Data dokumen uji tidak valid.");
        }
      } catch(e) {
        badgeFirestore.className = 'badge badge-status-rejected';
        badgeFirestore.innerText = 'KONEKSI GAGAL';
        errors.push("Eror Firestore: " + e.message + "\n--> Solusi: Buka Firebase Console -> Firestore Database -> Rules. Ubah baris 'allow read, write: if false;' menjadi 'allow read, write: if true;' lalu klik Publish. Pastikan juga Anda sudah mengklik 'Create Database' di Firebase Console.");
      }
    } else {
      badgeFirestore.className = 'badge badge-status-rejected';
      badgeFirestore.innerText = 'BATAL (SDK GAGAL)';
    }
  };

  const cloudinaryTest = async () => {
    try {
      await timeoutPromise(6000, fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/ping`, { method: 'GET', mode: 'no-cors' }), "Timeout (6 detik) - Gagal menghubungi server Cloudinary.");
      badgeCloudinary.className = 'badge badge-status-accepted';
      badgeCloudinary.innerText = 'TERHUBUNG (OK)';
    } catch(e) {
      badgeCloudinary.className = 'badge badge-status-rejected';
      badgeCloudinary.innerText = 'KONEKSI GAGAL';
      errors.push("Eror Cloudinary: " + e.message + "\n--> Solusi: Periksa koneksi internet Anda atau pastikan nama cloud '" + cloudinaryConfig.cloudName + "' sudah benar.");
    }
  };

  // Run tests in parallel
  await Promise.all([firestoreTest(), cloudinaryTest()]);

  // Show error box if any error occurs
  if (errors.length > 0) {
    errorBox.classList.remove('hidden');
    errorMsg.innerHTML = errors.map(err => err.replace(/\n/g, '<br>')).join('<br><br>');
    
    // Update Header Indicator to red/failed
    headerIndicator.className = 'status-indicator';
    headerIndicator.style.backgroundColor = '#d32f2f';
    headerIndicator.style.boxShadow = '0 0 8px rgba(211, 47, 47, 0.4)';
    headerText.innerText = 'Koneksi Cloud Eror';
  } else {
    // Update Header Indicator to green/success
    headerIndicator.className = 'status-indicator online';
    headerIndicator.style.backgroundColor = '#2e7d32';
    headerIndicator.style.boxShadow = '0 0 8px rgba(46, 125, 50, 0.4)';
    headerText.innerText = 'Koneksi Cloud Aktif';
  }
}
