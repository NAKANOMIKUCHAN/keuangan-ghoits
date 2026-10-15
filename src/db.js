const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Pastikan direktori data tersedia
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inisialisasi data default realistis
const DEFAULT_CATEGORIES = [
  // Pemasukan
  { id: 'cat-in-1', name: 'Gaji Pokok', type: 'income', icon: 'wallet', color: '#10B981' },
  { id: 'cat-in-2', name: 'Freelance & Bisnis', type: 'income', icon: 'laptop', color: '#3B82F6' },
  { id: 'cat-in-3', name: 'Investasi & Dividen', type: 'income', icon: 'trending-up', color: '#8B5CF6' },
  { id: 'cat-in-4', name: 'Bonus & Hadiah', type: 'income', icon: 'gift', color: '#EC4899' },
  { id: 'cat-in-5', name: 'Pemasukan Lainnya', type: 'income', icon: 'plus-circle', color: '#6B7280' },

  // Pengeluaran
  { id: 'cat-ex-1', name: 'Makanan & Minuman', type: 'expense', icon: 'utensils', color: '#EF4444' },
  { id: 'cat-ex-2', name: 'Belanja Kebutuhan', type: 'expense', icon: 'shopping-cart', color: '#F97316' },
  { id: 'cat-ex-3', name: 'Transportasi & Bensin', type: 'expense', icon: 'car', color: '#F59E0B' },
  { id: 'cat-ex-4', name: 'Tagihan & Utilitas', type: 'expense', icon: 'file-text', color: '#6366F1' },
  { id: 'cat-ex-5', name: 'Hiburan & Hobi', type: 'expense', icon: 'film', color: '#14B8A6' },
  { id: 'cat-ex-6', name: 'Kesehatan & Medis', type: 'expense', icon: 'heart-pulse', color: '#E11D48' },
  { id: 'cat-ex-7', name: 'Pendidikan', type: 'expense', icon: 'book-open', color: '#0284C7' },
  { id: 'cat-ex-8', name: 'Pengeluaran Lainnya', type: 'expense', icon: 'minus-circle', color: '#4B5563' }
];

const DEFAULT_WALLETS = [
  { id: 'wal-1', name: 'Uang Tunai / Kas', type: 'cash', balance: 1335000, color: '#10B981' },
  { id: 'wal-2', name: 'Bank BCA', type: 'bank', balance: 0, color: '#2563EB' },
  { id: 'wal-3', name: 'Bank Mandiri', type: 'bank', balance: 0, color: '#0284C7' },
  { id: 'wal-4', name: 'E-Wallet (GoPay/Dana/OVO)', type: 'ewallet', balance: 0, color: '#8B5CF6' }
];

function getSampleTransactions() {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'tx-1001',
      date: today,
      type: 'income',
      amount: 1335000,
      category: 'Pemasukan Lainnya',
      wallet: 'Uang Tunai / Kas',
      description: 'Saldo Uang Saat Ini',
      notes: 'Saldo kas yang dimiliki'
    }
  ];
}

function readData() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      transactions: getSampleTransactions(),
      categories: DEFAULT_CATEGORIES,
      wallets: DEFAULT_WALLETS,
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    saveData(initialData);
    return initialData;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Gagal membaca database, menggunakan fallback data:', err);
    return {
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      wallets: DEFAULT_WALLETS,
      meta: { createdAt: new Date().toISOString() }
    };
  }
}

function saveData(data) {
  data.meta = data.meta || {};
  data.meta.updatedAt = new Date().toISOString();
  
  // Tulis atomic melalui file sementara untuk integritas data
  const tempPath = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, DB_FILE);
}

// ================= TRANSACTION CRUD ================= //

function getAllTransactions(filters = {}) {
  const data = readData();
  let list = [...data.transactions];

  // Filter tipe (income / expense)
  if (filters.type && filters.type !== 'all') {
    list = list.filter(t => t.type.toLowerCase() === filters.type.toLowerCase());
  }

  // Filter kategori
  if (filters.category && filters.category !== 'all') {
    list = list.filter(t => t.category.toLowerCase() === filters.category.toLowerCase());
  }

  // Filter dompet / akun
  if (filters.wallet && filters.wallet !== 'all') {
    list = list.filter(t => t.wallet.toLowerCase() === filters.wallet.toLowerCase());
  }

  // Filter tanggal mulai
  if (filters.startDate) {
    list = list.filter(t => t.date >= filters.startDate);
  }

  // Filter tanggal akhir
  if (filters.endDate) {
    list = list.filter(t => t.date <= filters.endDate);
  }

  // Filter pencarian teks (search)
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(t => 
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q)) ||
      (t.wallet && t.wallet.toLowerCase().includes(q))
    );
  }

  // Urutkan dari tanggal terbaru ke terlama
  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  return list;
}

function getTransactionById(id) {
  const data = readData();
  return data.transactions.find(t => t.id === id) || null;
}

function createTransaction(txData) {
  const data = readData();

  const newTx = {
    id: 'tx-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()),
    date: txData.date || new Date().toISOString().split('T')[0],
    type: txData.type === 'expense' ? 'expense' : 'income',
    amount: Math.abs(parseFloat(txData.amount) || 0),
    category: txData.category || 'Lainnya',
    wallet: txData.wallet || 'Uang Tunai / Kas',
    description: txData.description ? txData.description.trim() : 'Transaksi Tanpa Keterangan',
    notes: txData.notes ? txData.notes.trim() : '',
    createdAt: new Date().toISOString()
  };

  data.transactions.unshift(newTx);
  saveData(data);
  return newTx;
}

function updateTransaction(id, updateData) {
  const data = readData();
  const index = data.transactions.findIndex(t => t.id === id);

  if (index === -1) {
    return null;
  }

  const existing = data.transactions[index];
  const updatedTx = {
    ...existing,
    date: updateData.date || existing.date,
    type: updateData.type ? (updateData.type === 'expense' ? 'expense' : 'income') : existing.type,
    amount: updateData.amount !== undefined ? Math.abs(parseFloat(updateData.amount) || 0) : existing.amount,
    category: updateData.category || existing.category,
    wallet: updateData.wallet || existing.wallet,
    description: updateData.description !== undefined ? updateData.description.trim() : existing.description,
    notes: updateData.notes !== undefined ? updateData.notes.trim() : existing.notes,
    updatedAt: new Date().toISOString()
  };

  data.transactions[index] = updatedTx;
  saveData(data);
  return updatedTx;
}

function deleteTransaction(id) {
  const data = readData();
  const index = data.transactions.findIndex(t => t.id === id);

  if (index === -1) {
    return false;
  }

  const deleted = data.transactions.splice(index, 1)[0];
  saveData(data);
  return deleted;
}

// ================= FINANCIAL SUMMARY & STATS ================= //

function getSummary(filters = {}) {
  const transactions = getAllTransactions(filters);
  
  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory = {};
  const incomeByCategory = {};
  const cashflowByMonth = {};

  transactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += amt;
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + amt;
    } else {
      totalExpense += amt;
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + amt;
    }

    // Hitung per bulan (format: YYYY-MM)
    if (t.date) {
      const monthKey = t.date.slice(0, 7);
      if (!cashflowByMonth[monthKey]) {
        cashflowByMonth[monthKey] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        cashflowByMonth[monthKey].income += amt;
      } else {
        cashflowByMonth[monthKey].expense += amt;
      }
    }
  });

  const balance = totalIncome - totalExpense;

  return {
    totalIncome,
    totalExpense,
    balance,
    transactionCount: transactions.length,
    expenseByCategory,
    incomeByCategory,
    cashflowByMonth,
    recentTransactions: transactions.slice(0, 7)
  };
}

// ================= CATEGORIES & WALLETS ================= //

function getCategories() {
  const data = readData();
  return data.categories || [];
}

function addCategory(catData) {
  const data = readData();
  const newCat = {
    id: 'cat-' + Date.now(),
    name: catData.name.trim(),
    type: catData.type === 'expense' ? 'expense' : 'income',
    icon: catData.icon || 'tag',
    color: catData.color || '#6B7280'
  };
  data.categories.push(newCat);
  saveData(data);
  return newCat;
}

function getWallets() {
  const data = readData();
  return data.wallets || [];
}

function addWallet(walletData) {
  const data = readData();
  const newWallet = {
    id: 'wal-' + Date.now(),
    name: walletData.name.trim(),
    type: walletData.type || 'bank',
    balance: parseFloat(walletData.balance) || 0,
    color: walletData.color || '#2563EB'
  };
  data.wallets.push(newWallet);
  saveData(data);
  return newWallet;
}

// ================= EXPORT TO CSV ================= //

function exportToCsv(filters = {}) {
  const transactions = getAllTransactions(filters);
  const headers = ['ID Transaksi', 'Tanggal', 'Tipe', 'Kategori', 'Dompet / Akun', 'Deskripsi', 'Catatan', 'Jumlah (IDR)'];
  
  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = transactions.map(t => [
    escapeCsv(t.id),
    escapeCsv(t.date),
    escapeCsv(t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
    escapeCsv(t.category),
    escapeCsv(t.wallet),
    escapeCsv(t.description),
    escapeCsv(t.notes || '-'),
    escapeCsv(t.amount)
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
}

module.exports = {
  readData,
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
  getCategories,
  addCategory,
  getWallets,
  addWallet,
  exportToCsv
};
