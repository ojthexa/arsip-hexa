const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Inisialisasi Jalur Penyimpanan Lokal D:\HEXA\ID Hexa\Dokumen\Surat
const BASE_STORAGE = 'D:\\HEXA\\ID Hexa\\Dokumen\\Surat';
const SUBFOLDERS = {
  masuk: path.join(BASE_STORAGE, 'Masuk'),
  keluar: path.join(BASE_STORAGE, 'Keluar'),
  quotation: path.join(BASE_STORAGE, 'Quotation'),
  invoicing: path.join(BASE_STORAGE, 'Invoicing')
};

const DB_PATH = path.join(BASE_STORAGE, 'db.json');

// Membuat folder jika belum ada
function initDirectories() {
  try {
    if (!fs.existsSync(BASE_STORAGE)) {
      fs.mkdirSync(BASE_STORAGE, { recursive: true });
    }
    Object.values(SUBFOLDERS).forEach(folder => {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }
    });

    // Inisialisasi Database JSON jika belum ada
    if (!fs.existsSync(DB_PATH)) {
      const initialDb = {
        surat: [],
        quotations: [],
        invoices: [],
        units: [
          { id: 'u1', name: 'Bagian Umum', code: 'UM' },
          { id: 'u2', name: 'Kepegawaian', code: 'KEP' },
          { id: 'u3', name: 'Keuangan', code: 'KEU' },
          { id: 'u4', name: 'Perencanaan', code: 'REN' }
        ],
        number_formats: [
          { id: 'masuk', name: 'Surat Masuk', format: 'SM/[NOMOR]/[UNIT]/[BULAN-ROMAWI]/[TAHUN]' },
          { id: 'keluar', name: 'Surat Keluar', format: 'SK/[NOMOR]/[UNIT]/[BULAN-ROMAWI]/[TAHUN]' },
          { id: 'quotation', name: 'Quotation', format: 'QT/[NOMOR]/[UNIT]/[BULAN]/[TAHUN]' },
          { id: 'invoicing', name: 'Invoicing', format: 'INV/[NOMOR]/[UNIT]/[BULAN]/[TAHUN]' }
        ],
        generated_numbers: []
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf8');
      console.log('Database JSON berhasil diinisialisasi.');
    }
  } catch (err) {
    console.error('Gagal menginisialisasi direktori lokal:', err.message);
  }
}

initDirectories();

// Helper Membaca / Menulis DB
function readDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Gagal membaca database:', err.message);
  }
  return { surat: [], quotations: [], invoices: [], units: [], number_formats: [], generated_numbers: [] };
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Gagal menulis database:', err.message);
    return false;
  }
}

// 2. Konfigurasi Upload File dengan Multer
const storageConfig = multer.diskStorage({
  destination: function (req, file, cb) {
    const type = req.body.category || req.query.category || 'masuk';
    const dest = SUBFOLDERS[type.toLowerCase()] || SUBFOLDERS.masuk;
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${sanitizedOriginalName}`);
  }
});

const upload = multer({ storage: storageConfig });

// Menyajikan file statis dari folder Surat di drive D: agar bisa di-preview di frontend
app.use('/files', express.static(BASE_STORAGE));

// Menyajikan frontend statis
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 3. API ENDPOINTS
// ==========================================

// --- UNIT KERJA API ---
app.get('/api/units', (req, res) => {
  const db = readDb();
  res.json(db.units || []);
});

app.post('/api/units', (req, res) => {
  const db = readDb();
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Nama dan Kode Unit wajib diisi.' });
  
  const newUnit = { id: uuidv4(), name, code: code.toUpperCase() };
  db.units.push(newUnit);
  writeDb(db);
  res.status(201).json(newUnit);
});

app.put('/api/units/:id', (req, res) => {
  const db = readDb();
  const { name, code } = req.body;
  const unitIndex = db.units.findIndex(u => u.id === req.params.id);
  if (unitIndex === -1) return res.status(404).json({ error: 'Unit tidak ditemukan.' });

  db.units[unitIndex] = { ...db.units[unitIndex], name, code: code.toUpperCase() };
  writeDb(db);
  res.json(db.units[unitIndex]);
});

app.delete('/api/units/:id', (req, res) => {
  const db = readDb();
  db.units = db.units.filter(u => u.id !== req.params.id);
  writeDb(db);
  res.json({ message: 'Unit berhasil dihapus.' });
});


// --- FORMAT NOMOR API ---
app.get('/api/number-formats', (req, res) => {
  const db = readDb();
  res.json(db.number_formats || []);
});

app.put('/api/number-formats/:id', (req, res) => {
  const db = readDb();
  const { format } = req.body;
  const idx = db.number_formats.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Format tidak ditemukan.' });

  db.number_formats[idx].format = format;
  writeDb(db);
  res.json(db.number_formats[idx]);
});


// --- GENERATOR NOMOR API ---
app.get('/api/generated-numbers', (req, res) => {
  const db = readDb();
  res.json(db.generated_numbers || []);
});

app.post('/api/generate-number', (req, res) => {
  const db = readDb();
  const { type, unitId } = req.body; // type: masuk, keluar, quotation, invoicing
  
  if (!type || !unitId) {
    return res.status(400).json({ error: 'Kategori dokumen dan Unit Kerja wajib dipilih.' });
  }

  const formatObj = db.number_formats.find(f => f.id === type);
  const unitObj = db.units.find(u => u.id === unitId);

  if (!formatObj || !unitObj) {
    return res.status(400).json({ error: 'Format penomoran atau Unit Kerja tidak valid.' });
  }

  const formatPattern = formatObj.format;
  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const currentMonthRoman = romanMonths[currentMonthNum - 1];

  // Hitung nomor urut berikutnya berdasarkan jenis dokumen dan tahun berjalan
  const countInYear = db.generated_numbers.filter(item => item.type === type && item.year === currentYear).length;
  const nextNum = countInYear + 1;
  const paddedNum = String(nextNum).padStart(3, '0');

  // Ganti token dalam pola format
  let generated = formatPattern
    .replace('[NOMOR]', paddedNum)
    .replace('[UNIT]', unitObj.code)
    .replace('[BULAN]', String(currentMonthNum).padStart(2, '0'))
    .replace('[BULAN-ROMAWI]', currentMonthRoman)
    .replace('[TAHUN]', String(currentYear));

  const newNumRecord = {
    id: uuidv4(),
    number: generated,
    type,
    unitName: unitObj.name,
    unitCode: unitObj.code,
    year: currentYear,
    createdAt: new Date().toISOString()
  };

  db.generated_numbers.unshift(newNumRecord);
  writeDb(db);
  res.status(201).json(newNumRecord);
});


// --- SURAT API (MASUK / KELUAR) ---
app.get('/api/surat', (req, res) => {
  const db = readDb();
  const { type, search } = req.query; // type: masuk atau keluar
  
  let list = db.surat || [];
  
  if (type) {
    list = list.filter(s => s.type === type.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(s => 
      (s.number && s.number.toLowerCase().includes(q)) ||
      (s.senderOrReceiver && s.senderOrReceiver.toLowerCase().includes(q)) ||
      (s.subject && s.subject.toLowerCase().includes(q)) ||
      (s.unitName && s.unitName.toLowerCase().includes(q))
    );
  }

  res.json(list);
});

app.post('/api/surat', upload.single('document'), (req, res) => {
  const db = readDb();
  const { type, number, date, receivedOrSentDate, senderOrReceiver, subject, unitId } = req.body;

  if (!type || !number || !date || !senderOrReceiver || !subject) {
    return res.status(400).json({ error: 'Mohon isi semua field wajib.' });
  }

  const unitObj = db.units.find(u => u.id === unitId) || {};

  const newSurat = {
    id: uuidv4(),
    type: type.toLowerCase(), // masuk / keluar
    number,
    date,
    receivedOrSentDate: receivedOrSentDate || date,
    senderOrReceiver,
    subject,
    unitId,
    unitName: unitObj.name || '',
    fileName: req.file ? req.file.filename : '',
    filePath: req.file ? `/files/${type === 'masuk' ? 'Masuk' : 'Keluar'}/${req.file.filename}` : '',
    createdAt: new Date().toISOString()
  };

  db.surat.unshift(newSurat);
  writeDb(db);
  res.status(201).json(newSurat);
});

app.put('/api/surat/:id', upload.single('document'), (req, res) => {
  const db = readDb();
  const index = db.surat.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Surat tidak ditemukan.' });

  const current = db.surat[index];
  const { number, date, receivedOrSentDate, senderOrReceiver, subject, unitId } = req.body;
  const unitObj = db.units.find(u => u.id === unitId) || {};

  db.surat[index] = {
    ...current,
    number: number || current.number,
    date: date || current.date,
    receivedOrSentDate: receivedOrSentDate || current.receivedOrSentDate,
    senderOrReceiver: senderOrReceiver || current.senderOrReceiver,
    subject: subject || current.subject,
    unitId: unitId || current.unitId,
    unitName: unitObj.name || current.unitName,
    fileName: req.file ? req.file.filename : current.fileName,
    filePath: req.file ? `/files/${current.type === 'masuk' ? 'Masuk' : 'Keluar'}/${req.file.filename}` : current.filePath,
  };

  writeDb(db);
  res.json(db.surat[index]);
});

app.delete('/api/surat/:id', (req, res) => {
  const db = readDb();
  const suratObj = db.surat.find(s => s.id === req.params.id);
  
  if (suratObj && suratObj.fileName) {
    const filePathOnDisk = path.join(SUBFOLDERS[suratObj.type], suratObj.fileName);
    try {
      if (fs.existsSync(filePathOnDisk)) {
        fs.unlinkSync(filePathOnDisk);
      }
    } catch (e) {
      console.error('Gagal menghapus file dari disk:', e.message);
    }
  }

  db.surat = db.surat.filter(s => s.id !== req.params.id);
  writeDb(db);
  res.json({ message: 'Surat berhasil dihapus.' });
});


// --- QUOTATIONS API ---
app.get('/api/quotations', (req, res) => {
  const db = readDb();
  const { search } = req.query;
  let list = db.quotations || [];

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(item => 
      (item.number && item.number.toLowerCase().includes(q)) ||
      (item.client && item.client.toLowerCase().includes(q)) ||
      (item.subject && item.subject.toLowerCase().includes(q)) ||
      (item.unitName && item.unitName.toLowerCase().includes(q))
    );
  }
  res.json(list);
});

app.post('/api/quotations', upload.single('document'), (req, res) => {
  const db = readDb();
  const { number, date, client, subject, amount, status, unitId } = req.body;

  if (!number || !date || !client || !subject) {
    return res.status(400).json({ error: 'Mohon isi semua field wajib.' });
  }

  const unitObj = db.units.find(u => u.id === unitId) || {};

  const newQuotation = {
    id: uuidv4(),
    number,
    date,
    client,
    subject,
    amount: parseFloat(amount) || 0,
    status: status || 'Draft',
    unitId,
    unitName: unitObj.name || '',
    fileName: req.file ? req.file.filename : '',
    filePath: req.file ? `/files/Quotation/${req.file.filename}` : '',
    createdAt: new Date().toISOString()
  };

  db.quotations.unshift(newQuotation);
  writeDb(db);
  res.status(201).json(newQuotation);
});

app.put('/api/quotations/:id', upload.single('document'), (req, res) => {
  const db = readDb();
  const idx = db.quotations.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Quotation tidak ditemukan.' });

  const current = db.quotations[idx];
  const { number, date, client, subject, amount, status, unitId } = req.body;
  const unitObj = db.units.find(u => u.id === unitId) || {};

  db.quotations[idx] = {
    ...current,
    number: number || current.number,
    date: date || current.date,
    client: client || current.client,
    subject: subject || current.subject,
    amount: amount !== undefined ? parseFloat(amount) : current.amount,
    status: status || current.status,
    unitId: unitId || current.unitId,
    unitName: unitObj.name || current.unitName,
    fileName: req.file ? req.file.filename : current.fileName,
    filePath: req.file ? `/files/Quotation/${req.file.filename}` : current.filePath,
  };

  writeDb(db);
  res.json(db.quotations[idx]);
});

app.delete('/api/quotations/:id', (req, res) => {
  const db = readDb();
  const item = db.quotations.find(q => q.id === req.params.id);
  if (item && item.fileName) {
    const fileDisk = path.join(SUBFOLDERS.quotation, item.fileName);
    try {
      if (fs.existsSync(fileDisk)) fs.unlinkSync(fileDisk);
    } catch(e) {}
  }
  db.quotations = db.quotations.filter(q => q.id !== req.params.id);
  writeDb(db);
  res.json({ message: 'Quotation berhasil dihapus.' });
});


// --- INVOICES API ---
app.get('/api/invoices', (req, res) => {
  const db = readDb();
  const { search } = req.query;
  let list = db.invoices || [];

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(item => 
      (item.number && item.number.toLowerCase().includes(q)) ||
      (item.client && item.client.toLowerCase().includes(q)) ||
      (item.unitName && item.unitName.toLowerCase().includes(q))
    );
  }
  res.json(list);
});

app.post('/api/invoices', upload.single('document'), (req, res) => {
  const db = readDb();
  const { number, date, dueDate, client, amount, status, unitId } = req.body;

  if (!number || !date || !client) {
    return res.status(400).json({ error: 'Mohon isi semua field wajib.' });
  }

  const unitObj = db.units.find(u => u.id === unitId) || {};

  const newInvoice = {
    id: uuidv4(),
    number,
    date,
    dueDate: dueDate || '',
    client,
    amount: parseFloat(amount) || 0,
    status: status || 'Unpaid',
    unitId,
    unitName: unitObj.name || '',
    fileName: req.file ? req.file.filename : '',
    filePath: req.file ? `/files/Invoicing/${req.file.filename}` : '',
    createdAt: new Date().toISOString()
  };

  db.invoices.unshift(newInvoice);
  writeDb(db);
  res.status(201).json(newInvoice);
});

app.put('/api/invoices/:id', upload.single('document'), (req, res) => {
  const db = readDb();
  const idx = db.invoices.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Invoice tidak ditemukan.' });

  const current = db.invoices[idx];
  const { number, date, dueDate, client, amount, status, unitId } = req.body;
  const unitObj = db.units.find(u => u.id === unitId) || {};

  db.invoices[idx] = {
    ...current,
    number: number || current.number,
    date: date || current.date,
    dueDate: dueDate !== undefined ? dueDate : current.dueDate,
    client: client || current.client,
    amount: amount !== undefined ? parseFloat(amount) : current.amount,
    status: status || current.status,
    unitId: unitId || current.unitId,
    unitName: unitObj.name || current.unitName,
    fileName: req.file ? req.file.filename : current.fileName,
    filePath: req.file ? `/files/Invoicing/${req.file.filename}` : current.filePath,
  };

  writeDb(db);
  res.json(db.invoices[idx]);
});

app.delete('/api/invoices/:id', (req, res) => {
  const db = readDb();
  const item = db.invoices.find(i => i.id === req.params.id);
  if (item && item.fileName) {
    const fileDisk = path.join(SUBFOLDERS.invoicing, item.fileName);
    try {
      if (fs.existsSync(fileDisk)) fs.unlinkSync(fileDisk);
    } catch(e) {}
  }
  db.invoices = db.invoices.filter(i => i.id !== req.params.id);
  writeDb(db);
  res.json({ message: 'Invoice berhasil dihapus.' });
});


// --- STATISTIK DASHBOARD API ---
app.get('/api/stats', (req, res) => {
  const db = readDb();
  
  const totalMasuk = (db.surat || []).filter(s => s.type === 'masuk').length;
  const totalKeluar = (db.surat || []).filter(s => s.type === 'keluar').length;
  const totalQuotation = (db.quotations || []).length;
  const totalInvoice = (db.invoices || []).length;
  
  const totalDokumen = totalMasuk + totalKeluar + totalQuotation + totalInvoice;
  const totalNomorDigunakan = (db.generated_numbers || []).length;

  // Gabungkan aktivitas terbaru dari semua kategori (maksimal 10)
  const activities = [];

  // Surat
  (db.surat || []).forEach(s => {
    activities.push({
      id: s.id,
      title: s.subject || 'Surat Tanpa Perihal',
      category: s.type === 'masuk' ? 'Surat Masuk' : 'Surat Keluar',
      meta: s.senderOrReceiver,
      time: s.createdAt,
      type: 'surat'
    });
  });

  // Quotation
  (db.quotations || []).forEach(q => {
    activities.push({
      id: q.id,
      title: q.subject || 'Penawaran',
      category: 'Quotation',
      meta: q.client,
      time: q.createdAt,
      type: 'quotation'
    });
  });

  // Invoice
  (db.invoices || []).forEach(i => {
    activities.push({
      id: i.id,
      title: `Invoice #${i.number}`,
      category: 'Invoicing',
      meta: i.client,
      time: i.createdAt,
      type: 'invoice'
    });
  });

  // Nomor generated
  (db.generated_numbers || []).forEach(g => {
    activities.push({
      id: g.id,
      title: g.number,
      category: 'Generator Nomor',
      meta: g.unitName,
      time: g.createdAt,
      type: 'number'
    });
  });

  // Sort by time descending
  activities.sort((a, b) => new Date(b.time) - new Date(a.time));
  const recentActivities = activities.slice(0, 7);

  // Hitung dokumen per unit
  const unitStats = {};
  // Inisialisasi unit
  db.units.forEach(u => {
    unitStats[u.name] = 0;
  });

  // Iterasi dokumen
  (db.surat || []).forEach(s => {
    if (s.unitName && unitStats[s.unitName] !== undefined) unitStats[s.unitName]++;
  });
  (db.quotations || []).forEach(q => {
    if (q.unitName && unitStats[q.unitName] !== undefined) unitStats[q.unitName]++;
  });
  (db.invoices || []).forEach(i => {
    if (i.unitName && unitStats[i.unitName] !== undefined) unitStats[i.unitName]++;
  });

  const unitStatsArray = Object.keys(unitStats).map(key => ({
    name: key,
    count: unitStats[key]
  })).sort((a, b) => b.count - a.count);

  res.json({
    totalMasuk,
    totalKeluar,
    totalQuotation,
    totalInvoice,
    totalDokumen,
    totalNomorDigunakan,
    recentActivities,
    unitStats: unitStatsArray
  });
});

app.listen(PORT, () => {
  console.log(`Server kearsipan berjalan di http://localhost:${PORT}`);
});
