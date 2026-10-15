const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Inisialisasi database data awal
db.readData();

// ================= API ROUTES: TRANSAKSI (CRUD) ================= //

// [READ] Dapatkan semua transaksi dengan filter opsional
app.get('/api/transactions', (req, res) => {
  try {
    const { type, category, wallet, startDate, endDate, search } = req.query;
    const transactions = db.getAllTransactions({
      type,
      category,
      wallet,
      startDate,
      endDate,
      search
    });
    res.json({ success: true, count: transactions.length, data: transactions });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data transaksi' });
  }
});

// [READ] Dapatkan satu transaksi berdasarkan ID
app.get('/api/transactions/:id', (req, res) => {
  try {
    const transaction = db.getTransactionById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }
    res.json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil detail transaksi' });
  }
});

// [CREATE] Tambah transaksi baru
app.post('/api/transactions', (req, res) => {
  try {
    const { type, amount, category, wallet, date, description, notes } = req.body;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Nominal/jumlah harus berupa angka positif yang valid'
      });
    }

    if (!type || (type !== 'income' && type !== 'expense')) {
      return res.status(400).json({
        success: false,
        message: 'Tipe transaksi harus "income" (pemasukan) atau "expense" (pengeluaran)'
      });
    }

    if (!description || description.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Keterangan/deskripsi transaksi wajib diisi'
      });
    }

    const newTx = db.createTransaction({
      type,
      amount: parseFloat(amount),
      category,
      wallet,
      date,
      description,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Transaksi berhasil disimpan',
      data: newTx
    });
  } catch (err) {
    console.error('Error creating transaction:', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan transaksi' });
  }
});

// [UPDATE] Perbarui transaksi yang ada
app.put('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, category, wallet, date, description, notes } = req.body;

    if (amount !== undefined && (isNaN(amount) || parseFloat(amount) <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Nominal transaksi harus berupa angka positif'
      });
    }

    if (type !== undefined && type !== 'income' && type !== 'expense') {
      return res.status(400).json({
        success: false,
        message: 'Tipe transaksi harus "income" atau "expense"'
      });
    }

    const updated = db.updateTransaction(id, {
      type,
      amount: amount !== undefined ? parseFloat(amount) : undefined,
      category,
      wallet,
      date,
      description,
      notes
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    res.json({
      success: true,
      message: 'Transaksi berhasil diperbarui',
      data: updated
    });
  } catch (err) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui transaksi' });
  }
});

// [DELETE] Hapus transaksi
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteTransaction(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    res.json({
      success: true,
      message: 'Transaksi berhasil dihapus',
      data: deleted
    });
  } catch (err) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus transaksi' });
  }
});

// ================= API: RINGKASAN & STATISTIK ================= //

app.get('/api/summary', (req, res) => {
  try {
    const { startDate, endDate, category, wallet } = req.query;
    const summary = db.getSummary({ startDate, endDate, category, wallet });
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Error getting summary:', err);
    res.status(500).json({ success: false, message: 'Gagal menghitung ringkasan keuangan' });
  }
});

// ================= API: KATEGORI & DOMPET ================= //

app.get('/api/categories', (req, res) => {
  try {
    const categories = db.getCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat kategori' });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
    }
    const newCategory = db.addCategory({ name, type, icon, color });
    res.status(201).json({ success: true, data: newCategory });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menambah kategori' });
  }
});

app.get('/api/wallets', (req, res) => {
  try {
    const wallets = db.getWallets();
    res.json({ success: true, data: wallets });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat daftar dompet' });
  }
});

app.post('/api/wallets', (req, res) => {
  try {
    const { name, type, balance, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama dompet/akun wajib diisi' });
    }
    const newWallet = db.addWallet({ name, type, balance, color });
    res.status(201).json({ success: true, data: newWallet });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menambah dompet' });
  }
});

// ================= API: EKSPOR CSV ================= //

app.get('/api/export/csv', (req, res) => {
  try {
    const { type, category, wallet, startDate, endDate, search } = req.query;
    const csvContent = db.exportToCsv({ type, category, wallet, startDate, endDate, search });

    const filename = `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send('\uFEFF' + csvContent); // BOM untuk kompatibilitas Excel
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).json({ success: false, message: 'Gagal mengekspor data ke CSV' });
  }
});

// Fallback untuk route SPA frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`=====================================================`);
  console.log(`🚀 Aplikasi Keuangan Ghoits Aktif!`);
  console.log(`👉 Akses Dashboard: http://localhost:${PORT}`);
  console.log(`📦 REST API CRUD:    http://localhost:${PORT}/api/transactions`);
  console.log(`=====================================================`);
});
