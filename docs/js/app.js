/**
 * Keuangan Ghoits - GitHub Pages & GitHub API Edition
 * Data tersimpan langsung di repository GitHub: NAKANOMIKUCHAN/keuangan-ghoits/data/database.json
 */

const GITHUB_OWNER = 'NAKANOMIKUCHAN';
const GITHUB_REPO  = 'keuangan-ghoits';
const GITHUB_FILE  = 'data/database.json';
const GITHUB_API_CONTENTS = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + GITHUB_FILE;
const GITHUB_PAGES_URL = 'https://' + GITHUB_OWNER.toLowerCase() + '.github.io/' + GITHUB_REPO + '/';

const state = {
  transactions: [],
  categories: [],
  wallets: [],
  summary: null,
  filters: {
    type: 'all',
    category: 'all',
    wallet: 'all',
    startDate: '',
    endDate: '',
    search: ''
  },
  currentEditingId: null,
  pendingDeleteId: null,
  cashflowChart: null,
  categoryChart: null,
  dbSha: null,
  token: localStorage.getItem('gh_token_keuangan_ghoits') || '',
  isSaving: false
};

function formatRupiah(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function generateId() {
  return 'tx-' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(title, message, isSuccess = true) {
  const toast = document.getElementById('toast');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toast) return;
  toastTitle.textContent = title;
  toastMessage.textContent = message;

  if (isSuccess) {
    toastIcon.className = 'w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0';
    toastIcon.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
  } else {
    toastIcon.className = 'w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0';
    toastIcon.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4"></i>';
  }

  lucide.createIcons();
  toast.classList.add('toast-active');

  setTimeout(() => {
    toast.classList.remove('toast-active');
  }, 3500);
}

function showLoading(show, message = 'Memuat data dari GitHub...') {
  const loader = document.getElementById('loadingOverlay');
  const msgEl = document.getElementById('loadingMessage');
  if (msgEl) msgEl.textContent = message;
  if (loader) loader.classList.toggle('hidden', !show);
}

// ================= GITHUB API STORAGE ================= //

async function readDatabaseFromGitHub() {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (state.token) {
    headers['Authorization'] = 'token ' + state.token;
  }

  const url = GITHUB_API_CONTENTS + '?t=' + Date.now();
  const res = await fetch(url, { headers });

  if (!res.ok) {
    if (res.status === 404) {
      const fallbackRes = await fetch('../data/database.json?t=' + Date.now()).catch(() => null);
      if (fallbackRes && fallbackRes.ok) {
        return await fallbackRes.json();
      }
      throw new Error('File data/database.json belum ada di repo GitHub.');
    }
    const errObj = await res.json().catch(() => ({}));
    throw new Error(errObj.message || 'Gagal membaca repository (HTTP ' + res.status + ')');
  }

  const meta = await res.json();
  state.dbSha = meta.sha;

  const base64Content = meta.content.replace(/\s/g, '');
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decodedText = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(decodedText);
}

async function writeDatabaseToGitHub(newData) {
  if (!state.token) {
    openSetupModal();
    throw new Error('GitHub Personal Access Token diperlukan untuk menyimpan perubahan.');
  }

  if (!state.dbSha) {
    try {
      const checkRes = await fetch(GITHUB_API_CONTENTS + '?t=' + Date.now(), {
        headers: {
          'Authorization': 'token ' + state.token,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (checkRes.ok) {
        const checkMeta = await checkRes.json();
        state.dbSha = checkMeta.sha;
      }
    } catch (e) {
      console.warn('Gagal periksa SHA:', e);
    }
  }

  const jsonStr = JSON.stringify(newData, null, 2);
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const base64Content = btoa(binary);

  const payload = {
    message: '[Keuangan Ghoits] Update data ' + new Date().toLocaleString('id-ID'),
    content: base64Content
  };
  if (state.dbSha) {
    payload.sha = state.dbSha;
  }

  const res = await fetch(GITHUB_API_CONTENTS, {
    method: 'PUT',
    headers: {
      'Authorization': 'token ' + state.token,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errObj = await res.json().catch(() => ({}));
    if (res.status === 409) {
      throw new Error('Terjadi konflik versi di GitHub. Silakan refresh halaman dan ulangi.');
    }
    throw new Error(errObj.message || 'Gagal menyimpan ke GitHub (HTTP ' + res.status + ')');
  }

  const resData = await res.json();
  if (resData.content && resData.content.sha) {
    state.dbSha = resData.content.sha;
  }
  return true;
}

// ================= DATA & UI LOGIC ================= //

async function init() {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('txDate');
  if (dateInput) dateInput.value = today;

  setPresetThisMonth();
  setupEventListeners();
  lucide.createIcons();

  await loadAllData();

  if (!state.token) {
    setTimeout(() => {
      showToast('Mode Baca Aktif', 'Masukkan GitHub Token di menu Token untuk menambah atau mengedit transaksi', true);
    }, 1200);
  }
}

async function loadAllData() {
  showLoading(true, 'Memuat data keuangan dari GitHub...');
  try {
    const db = await readDatabaseFromGitHub();
    state.categories = db.categories || [];
    state.wallets = db.wallets || [];
    state.transactions = db.transactions || [];

    populateFilterDropdowns();
    updateModalCategories();
    populateModalWallets();
    applyFiltersAndRender();
  } catch (err) {
    console.error('Error loadAllData:', err);
    showToast('Gagal Memuat Data', err.message, false);
    if (!state.token) {
      openSetupModal();
    }
  } finally {
    showLoading(false);
  }
}

function populateFilterDropdowns() {
  const catFilter = document.getElementById('filterCategory');
  const walletFilter = document.getElementById('filterWallet');

  if (catFilter) {
    catFilter.innerHTML = '<option value="all">Semua Kategori</option>';
    state.categories.forEach(c => {
      catFilter.innerHTML += '<option value="' + escapeHtml(c.name) + '">' + (c.type === 'income' ? '🟢' : '🔴') + ' ' + escapeHtml(c.name) + '</option>';
    });
  }

  if (walletFilter) {
    walletFilter.innerHTML = '<option value="all">Semua Dompet / Akun</option>';
    state.wallets.forEach(w => {
      walletFilter.innerHTML += '<option value="' + escapeHtml(w.name) + '">💳 ' + escapeHtml(w.name) + '</option>';
    });
  }
}

function updateModalCategories() {
  const typeEl = document.getElementById('txType');
  const currentType = typeEl ? typeEl.value : 'expense';
  const select = document.getElementById('txCategory');
  if (!select) return;

  select.innerHTML = '';
  const filtered = state.categories.filter(c => c.type === currentType);
  filtered.forEach(c => {
    select.innerHTML += '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>';
  });

  if (filtered.length === 0) {
    select.innerHTML = '<option value="Umum">Umum</option>';
  }
}

function populateModalWallets() {
  const select = document.getElementById('txWallet');
  if (!select) return;
  select.innerHTML = '';
  state.wallets.forEach(w => {
    select.innerHTML += '<option value="' + escapeHtml(w.name) + '">' + escapeHtml(w.name) + '</option>';
  });
}

function applyFiltersAndRender() {
  let txs = [...state.transactions];

  if (state.filters.type !== 'all') txs = txs.filter(t => t.type === state.filters.type);
  if (state.filters.category !== 'all') txs = txs.filter(t => t.category === state.filters.category);
  if (state.filters.wallet !== 'all') txs = txs.filter(t => t.wallet === state.filters.wallet);
  if (state.filters.startDate) txs = txs.filter(t => t.date >= state.filters.startDate);
  if (state.filters.endDate) txs = txs.filter(t => t.date <= state.filters.endDate);
  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    txs = txs.filter(t =>
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q))
    );
  }

  txs.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  renderTable(txs);
  renderSummary(txs);
}

function computeSummary(txs) {
  const totalIncome = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const balance = totalIncome - totalExpense;

  const cashflowByMonth = {};
  txs.forEach(t => {
    const month = (t.date || '').slice(0, 7) || 'Lainnya';
    if (!cashflowByMonth[month]) cashflowByMonth[month] = { income: 0, expense: 0 };
    if (t.type === 'income') cashflowByMonth[month].income += (parseFloat(t.amount) || 0);
    else cashflowByMonth[month].expense += (parseFloat(t.amount) || 0);
  });

  const expenseByCategory = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'Lainnya';
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (parseFloat(t.amount) || 0);
  });

  return { totalIncome, totalExpense, balance, transactionCount: txs.length, cashflowByMonth, expenseByCategory };
}

function renderSummary(txs) {
  const s = computeSummary(txs);
  state.summary = s;

  const statBalance = document.getElementById('statBalance');
  const statIncome = document.getElementById('statIncome');
  const statExpense = document.getElementById('statExpense');
  const statCount = document.getElementById('statCount');
  const badge = document.getElementById('statBalanceBadge');

  if (statBalance) statBalance.textContent = formatRupiah(s.balance);
  if (statIncome) statIncome.textContent = formatRupiah(s.totalIncome);
  if (statExpense) statExpense.textContent = formatRupiah(s.totalExpense);
  if (statCount) statCount.textContent = s.transactionCount.toLocaleString('id-ID');

  if (badge) {
    if (s.balance > 0) {
      badge.className = 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60';
      badge.innerHTML = '<i data-lucide="trending-up" class="w-3.5 h-3.5"></i> Surplus (Positif)';
    } else if (s.balance < 0) {
      badge.className = 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60';
      badge.innerHTML = '<i data-lucide="trending-down" class="w-3.5 h-3.5"></i> Defisit (Negatif)';
    } else {
      badge.className = 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60';
      badge.innerHTML = '<i data-lucide="minus" class="w-3.5 h-3.5"></i> Saldo Seimbang';
    }
  }

  lucide.createIcons();
  renderCharts(s);
}

function renderTable(transactions) {
  const tbody = document.getElementById('transactionsTableBody');
  const mobileList = document.getElementById('transactionsMobileList');
  const emptyState = document.getElementById('emptyState');
  const counterText = document.getElementById('tableCounterText');

  if (counterText) counterText.textContent = 'Menampilkan ' + transactions.length + ' transaksi';

  if (transactions.length === 0) {
    if (tbody) tbody.innerHTML = '';
    if (mobileList) mobileList.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    lucide.createIcons();
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  if (tbody) {
    tbody.innerHTML = transactions.map(t => {
      const isIncome = t.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountColor = isIncome ? 'text-emerald-600' : 'text-rose-600';
      const badgeTypeClass = isIncome ? 'badge-income' : 'badge-expense';
      const typeLabel = isIncome ? 'Pemasukan' : 'Pengeluaran';

      return `
        <tr class="table-row-hover transition-colors border-b border-slate-100/80">
          <td class="py-3.5 px-6 whitespace-nowrap">
            <div class="font-bold text-slate-800">${formatDateIndo(t.date)}</div>
            <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(t.date)}</div>
          </td>
          <td class="py-3.5 px-4">
            <div class="font-semibold text-slate-900">${escapeHtml(t.description)}</div>
            ${t.notes ? '<div class="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs flex items-center gap-1"><i data-lucide="info" class="w-3 h-3 text-slate-400 inline shrink-0"></i> ' + escapeHtml(t.notes) + '</div>' : ''}
          </td>
          <td class="py-3.5 px-4 whitespace-nowrap">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${badgeTypeClass}">
              <span class="w-1.5 h-1.5 rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
              ${escapeHtml(t.category)}
            </span>
          </td>
          <td class="py-3.5 px-4 whitespace-nowrap">
            <span class="inline-flex items-center gap-1 text-slate-600 text-xs font-medium">
              <i data-lucide="credit-card" class="w-3.5 h-3.5 text-slate-400"></i>
              ${escapeHtml(t.wallet)}
            </span>
          </td>
          <td class="py-3.5 px-4 whitespace-nowrap text-right">
            <div class="font-extrabold text-sm sm:text-base ${amountColor}">${sign} ${formatRupiah(t.amount)}</div>
            <div class="text-[10px] uppercase font-bold tracking-wider ${isIncome ? 'text-emerald-500' : 'text-rose-500'}">${typeLabel}</div>
          </td>
          <td class="py-3.5 px-6 whitespace-nowrap text-center">
            <div class="inline-flex items-center gap-1.5">
              <button onclick="openEditModal('${t.id}')" class="p-1.5 sm:p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Edit">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button onclick="openDeleteModal('${t.id}')" class="p-1.5 sm:p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Hapus">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  if (mobileList) {
    mobileList.innerHTML = transactions.map(t => {
      const isIncome = t.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountColor = isIncome ? 'text-emerald-600' : 'text-rose-600';
      const badgeClass = isIncome ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-rose-50 text-rose-700 border-rose-200/60';
      const iconColor = isIncome ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600';
      const iconName = isIncome ? 'arrow-down-left' : 'arrow-up-right';

      return `
        <div class="p-3 sm:p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition active:bg-slate-100">
          <div class="flex items-center gap-2.5 min-w-0 pr-2">
            <div class="w-9 h-9 rounded-xl ${iconColor} flex items-center justify-center shrink-0">
              <i data-lucide="${iconName}" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs sm:text-sm text-slate-900 truncate">${escapeHtml(t.description)}</div>
              <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                <span>${formatDateIndo(t.date)}</span>
                <span>&bull;</span>
                <span class="inline-block px-1.5 py-0.5 rounded border ${badgeClass} font-semibold">${escapeHtml(t.category)}</span>
                <span>&bull;</span>
                <span class="text-slate-400 truncate">${escapeHtml(t.wallet)}</span>
              </div>
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="font-extrabold text-xs sm:text-sm ${amountColor}">${sign} ${formatRupiah(t.amount)}</div>
            <div class="flex items-center justify-end gap-1 mt-1">
              <button onclick="openEditModal('${t.id}')" class="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
              <button onclick="openDeleteModal('${t.id}')" class="p-1 text-slate-400 hover:text-rose-600 rounded-md transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  lucide.createIcons();
}

function renderCharts(summary) {
  renderCashflowChart(summary.cashflowByMonth || {});
  renderCategoryChart(summary.expenseByCategory || {});
}

function renderCashflowChart(cashflowData) {
  const canvas = document.getElementById('cashflowChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = Object.keys(cashflowData).sort();
  if (labels.length === 0) labels.push(new Date().toISOString().slice(0, 7));

  const incomeData = labels.map(l => cashflowData[l] ? cashflowData[l].income : 0);
  const expenseData = labels.map(l => cashflowData[l] ? cashflowData[l].expense : 0);

  const formattedLabels = labels.map(l => {
    const parts = l.split('-');
    if (parts.length === 2) {
      const d = new Date(parts[0], parts[1] - 1, 1);
      return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(d);
    }
    return l;
  });

  if (state.cashflowChart) state.cashflowChart.destroy();
  state.cashflowChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: formattedLabels,
      datasets: [
        { label: 'Pemasukan (IDR)', data: incomeData, backgroundColor: '#10b981', borderRadius: 8, borderSkipped: false },
        { label: 'Pengeluaran (IDR)', data: expenseData, backgroundColor: '#ef4444', borderRadius: 8, borderSkipped: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' } } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + formatRupiah(ctx.raw) } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => v >= 1000000 ? 'Rp ' + (v/1000000).toFixed(1) + ' jt' : v >= 1000 ? 'Rp ' + (v/1000).toFixed(0) + ' rb' : 'Rp ' + v },
          grid: { color: '#f1f5f9' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderCategoryChart(categoryData) {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = Object.keys(categoryData);
  const values = Object.values(categoryData);

  if (state.categoryChart) state.categoryChart.destroy();
  if (labels.length === 0) { ctx.clearRect(0, 0, 300, 300); return; }

  const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#64748b'];
  state.categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 2, borderColor: '#ffffff' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = values.reduce((a,b) => a+b, 0);
              return ctx.label + ': ' + formatRupiah(ctx.raw) + ' (' + (total > 0 ? ((ctx.raw/total)*100).toFixed(1) : 0) + '%)';
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

function openAddModal() {
  state.currentEditingId = null;
  document.getElementById('modalTitle').textContent = 'Catat Transaksi Baru';
  document.getElementById('modalSubtitle').textContent = 'Isi rincian informasi transaksi keuangan Anda';
  document.getElementById('btnSaveText').textContent = 'Simpan Transaksi';
  document.getElementById('txId').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('amountPreview').textContent = 'Rp 0';
  document.getElementById('txDescription').value = '';
  document.getElementById('txNotes').value = '';
  document.getElementById('txDate').value = new Date().toISOString().split('T')[0];

  setTypeToggle('expense');
  showModal(true);
}

function openEditModal(id) {
  const t = state.transactions.find(tx => tx.id === id);
  if (!t) { showToast('Error', 'Data tidak ditemukan', false); return; }

  state.currentEditingId = t.id;
  document.getElementById('modalTitle').textContent = 'Edit Data Transaksi';
  document.getElementById('modalSubtitle').textContent = 'Memperbarui ID: ' + t.id;
  document.getElementById('btnSaveText').textContent = 'Perbarui Transaksi';

  document.getElementById('txId').value = t.id;
  document.getElementById('txAmount').value = t.amount;
  document.getElementById('amountPreview').textContent = formatRupiah(t.amount);
  document.getElementById('txDescription').value = t.description;
  document.getElementById('txDate').value = t.date;
  document.getElementById('txNotes').value = t.notes || '';

  setTypeToggle(t.type);
  document.getElementById('txCategory').value = t.category;
  document.getElementById('txWallet').value = t.wallet;

  showModal(true);
}

function setTypeToggle(type) {
  document.getElementById('txType').value = type;
  const btnExpense = document.getElementById('btnTypeExpense');
  const btnIncome = document.getElementById('btnTypeIncome');

  if (type === 'income') {
    btnIncome.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition bg-white text-emerald-600 shadow-xs';
    btnExpense.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition text-slate-600 hover:text-rose-600';
  } else {
    btnExpense.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition bg-white text-rose-600 shadow-xs';
    btnIncome.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition text-slate-600 hover:text-emerald-600';
  }
  updateModalCategories();
}

function showModal(isOpen) {
  const modal = document.getElementById('modalTransaction');
  if (isOpen) {
    modal.classList.remove('hidden');
    document.getElementById('txAmount').focus();
  } else {
    modal.classList.add('hidden');
  }
}

async function handleTransactionSubmit(e) {
  e.preventDefault();
  if (state.isSaving) return;

  if (!state.token) {
    showToast('Token Diperlukan', 'Masukkan Personal Access Token GitHub terlebih dahulu.', false);
    openSetupModal();
    return;
  }

  const id = state.currentEditingId;
  const isEditing = Boolean(id);

  const payload = {
    type: document.getElementById('txType').value,
    amount: parseFloat(document.getElementById('txAmount').value),
    description: document.getElementById('txDescription').value.trim(),
    category: document.getElementById('txCategory').value,
    wallet: document.getElementById('txWallet').value,
    date: document.getElementById('txDate').value,
    notes: document.getElementById('txNotes').value.trim()
  };

  if (!payload.amount || payload.amount <= 0) {
    showToast('Validasi Gagal', 'Nominal harus lebih besar dari 0', false);
    return;
  }
  if (!payload.description) {
    showToast('Validasi Gagal', 'Keterangan transaksi wajib diisi', false);
    return;
  }

  state.isSaving = true;
  const btn = document.getElementById('btnSaveTransaction');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menyimpan ke GitHub...';
  lucide.createIcons();

  try {
    const db = await readDatabaseFromGitHub();

    if (isEditing) {
      const idx = db.transactions.findIndex(t => t.id === id);
      if (idx !== -1) {
        db.transactions[idx] = { ...db.transactions[idx], ...payload, updatedAt: new Date().toISOString() };
      }
    } else {
      const newTx = { id: generateId(), ...payload, createdAt: new Date().toISOString() };
      db.transactions.unshift(newTx);
    }

    db.meta = { ...(db.meta || {}), updatedAt: new Date().toISOString() };
    await writeDatabaseToGitHub(db);

    state.transactions = db.transactions;
    showModal(false);
    showToast(isEditing ? 'Transaksi Diperbarui' : 'Transaksi Dicatat', 'Data berhasil tersimpan di GitHub!');
    applyFiltersAndRender();
  } catch (err) {
    console.error('Error simpan transaksi:', err);
    showToast('Gagal Menyimpan', err.message, false);
  } finally {
    state.isSaving = false;
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span id="btnSaveText">Simpan Transaksi</span>';
    lucide.createIcons();
  }
}

function openDeleteModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  state.pendingDeleteId = id;
  document.getElementById('delPreviewDesc').textContent = tx.description;
  document.getElementById('delPreviewAmount').textContent = (tx.type === 'income' ? '+' : '-') + ' ' + formatRupiah(tx.amount);
  document.getElementById('delPreviewDate').textContent = formatDateIndo(tx.date);
  document.getElementById('delPreviewCategory').textContent = tx.category + ' (' + tx.wallet + ')';
  document.getElementById('modalDeleteConfirm').classList.remove('hidden');
}

function closeDeleteModal() {
  state.pendingDeleteId = null;
  document.getElementById('modalDeleteConfirm').classList.add('hidden');
}

async function confirmDelete() {
  const id = state.pendingDeleteId;
  if (!id) return;

  if (!state.token) {
    closeDeleteModal();
    openSetupModal();
    showToast('Token Diperlukan', 'Masukkan Personal Access Token GitHub untuk menghapus.', false);
    return;
  }

  const btn = document.getElementById('btnConfirmDelete');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menghapus...';
  lucide.createIcons();

  try {
    const db = await readDatabaseFromGitHub();
    db.transactions = db.transactions.filter(t => t.id !== id);
    db.meta = { ...(db.meta || {}), updatedAt: new Date().toISOString() };
    await writeDatabaseToGitHub(db);

    state.transactions = db.transactions;
    closeDeleteModal();
    showToast('Transaksi Terhapus', 'Data berhasil dihapus dari GitHub!');
    applyFiltersAndRender();
  } catch (err) {
    console.error('Error hapus:', err);
    showToast('Gagal Menghapus', err.message, false);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i> Hapus';
    lucide.createIcons();
  }
}

function setPresetToday() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filterStartDate').value = today;
  document.getElementById('filterEndDate').value = today;
  state.filters.startDate = today;
  state.filters.endDate = today;
  applyFiltersAndRender();
}

function setPresetThisMonth() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const elStart = document.getElementById('filterStartDate');
  const elEnd = document.getElementById('filterEndDate');
  if (elStart) elStart.value = firstDay;
  if (elEnd) elEnd.value = lastDay;
  state.filters.startDate = firstDay;
  state.filters.endDate = lastDay;
}

function setPresetAllTime() {
  const elStart = document.getElementById('filterStartDate');
  const elEnd = document.getElementById('filterEndDate');
  if (elStart) elStart.value = '';
  if (elEnd) elEnd.value = '';
  state.filters.startDate = '';
  state.filters.endDate = '';
  applyFiltersAndRender();
}

function resetAllFilters() {
  state.filters = { type: 'all', category: 'all', wallet: 'all', search: '', startDate: '', endDate: '' };
  document.getElementById('filterType').value = 'all';
  document.getElementById('filterCategory').value = 'all';
  document.getElementById('filterWallet').value = 'all';
  document.getElementById('searchInput').value = '';
  document.getElementById('filterStartDate').value = '';
  document.getElementById('filterEndDate').value = '';
  applyFiltersAndRender();
}

function triggerExportCsv() {
  const txs = state.transactions;
  if (txs.length === 0) {
    showToast('Tidak Ada Data', 'Tidak ada transaksi untuk diekspor', false);
    return;
  }
  const header = 'Tanggal,Tipe,Nominal,Keterangan,Kategori,Dompet,Catatan';
  const rows = txs.map(t => [
    t.date,
    t.type,
    t.amount,
    '"' + (t.description || '').replace(/"/g, '""') + '"',
    '"' + (t.category || '').replace(/"/g, '""') + '"',
    '"' + (t.wallet || '').replace(/"/g, '""') + '"',
    '"' + (t.notes || '').replace(/"/g, '""') + '"'
  ].join(','));

  const csv = [header, ...rows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'keuangan-ghoits-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Ekspor Berhasil', txs.length + ' transaksi berhasil diekspor');
}

function openSetupModal() {
  const modal = document.getElementById('modalSetup');
  const input = document.getElementById('setupToken');
  if (input) input.value = state.token || '';
  if (modal) modal.classList.remove('hidden');
}

function closeSetupModal() {
  const modal = document.getElementById('modalSetup');
  if (modal) modal.classList.add('hidden');
}

async function handleSetupSave() {
  const input = document.getElementById('setupToken');
  const val = input ? input.value.trim() : '';

  if (!val) {
    showToast('Token Kosong', 'Silakan masukkan token atau biarkan kosong untuk mode baca saja', false);
    return;
  }

  const btn = document.getElementById('btnSetupSave');
  btn.disabled = true;
  btn.textContent = 'Memverifikasi ke GitHub...';

  try {
    const res = await fetch('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO, {
      headers: {
        'Authorization': 'token ' + val,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      throw new Error('Token tidak memiliki izin akses ke repo ' + GITHUB_REPO);
    }

    state.token = val;
    localStorage.setItem('gh_token_keuangan_ghoits', val);
    closeSetupModal();
    showToast('Token Berhasil Disimpan', 'Sekarang kamu bisa menambah, mengedit, dan menghapus transaksi!');
    await loadAllData();
  } catch (err) {
    console.error('Setup error:', err);
    showToast('Verifikasi Gagal', err.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan & Hubungkan';
  }
}

function openQrModal() {
  const qrImg = document.getElementById('qrCodeImage');
  const urlLabel = document.getElementById('qrUrlLabel');
  const directOpen = document.getElementById('btnDirectOpen');

  if (qrImg) qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(GITHUB_PAGES_URL);
  if (urlLabel) urlLabel.textContent = GITHUB_PAGES_URL;
  if (directOpen) directOpen.href = GITHUB_PAGES_URL;

  document.getElementById('modalQrCode').classList.remove('hidden');
  lucide.createIcons();
}

function closeQrModal() {
  document.getElementById('modalQrCode').classList.add('hidden');
}

function setupEventListeners() {
  document.getElementById('btnOpenAddModal').addEventListener('click', openAddModal);
  const btnFab = document.getElementById('btnFabAdd');
  if (btnFab) btnFab.addEventListener('click', openAddModal);
  document.getElementById('btnEmptyAdd').addEventListener('click', openAddModal);
  document.getElementById('btnCloseModal').addEventListener('click', () => showModal(false));
  document.getElementById('btnCancelModal').addEventListener('click', () => showModal(false));

  document.getElementById('btnTypeExpense').addEventListener('click', () => setTypeToggle('expense'));
  document.getElementById('btnTypeIncome').addEventListener('click', () => setTypeToggle('income'));
  document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);

  document.getElementById('txAmount').addEventListener('input', e => {
    document.getElementById('amountPreview').textContent = formatRupiah(e.target.value);
  });

  document.getElementById('btnCancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('btnConfirmDelete').addEventListener('click', confirmDelete);

  document.getElementById('filterType').addEventListener('change', e => { state.filters.type = e.target.value; applyFiltersAndRender(); });
  document.getElementById('filterCategory').addEventListener('change', e => { state.filters.category = e.target.value; applyFiltersAndRender(); });
  document.getElementById('filterWallet').addEventListener('change', e => { state.filters.wallet = e.target.value; applyFiltersAndRender(); });
  document.getElementById('filterStartDate').addEventListener('change', e => { state.filters.startDate = e.target.value; applyFiltersAndRender(); });
  document.getElementById('filterEndDate').addEventListener('change', e => { state.filters.endDate = e.target.value; applyFiltersAndRender(); });

  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.filters.search = e.target.value; applyFiltersAndRender(); }, 300);
  });

  document.getElementById('btnPresetToday').addEventListener('click', setPresetToday);
  document.getElementById('btnPresetThisMonth').addEventListener('click', () => { setPresetThisMonth(); applyFiltersAndRender(); });
  document.getElementById('btnPresetAllTime').addEventListener('click', setPresetAllTime);
  document.getElementById('btnResetFilter').addEventListener('click', resetAllFilters);
  document.getElementById('btnRefresh').addEventListener('click', loadAllData);
  document.getElementById('btnPrint').addEventListener('click', () => window.print());
  document.getElementById('btnExportCsv').addEventListener('click', triggerExportCsv);

  const btnOpenQr = document.getElementById('btnOpenQrModal');
  const btnCloseQr = document.getElementById('btnCloseQrModal');
  if (btnOpenQr) btnOpenQr.addEventListener('click', openQrModal);
  if (btnCloseQr) btnCloseQr.addEventListener('click', closeQrModal);

  const btnCopyUrl = document.getElementById('btnCopyUrl');
  if (btnCopyUrl) {
    btnCopyUrl.addEventListener('click', () => {
      navigator.clipboard.writeText(GITHUB_PAGES_URL).then(() => {
        showToast('Link Disalin', 'Alamat web berhasil disalin ke clipboard');
      }).catch(() => {
        showToast('Gagal Salin', 'Silakan salin tautan secara manual', false);
      });
    });
  }

  const btnOpenSetup = document.getElementById('btnOpenSetup');
  if (btnOpenSetup) btnOpenSetup.addEventListener('click', openSetupModal);
  const btnCloseSetup = document.getElementById('btnCloseSetup');
  if (btnCloseSetup) btnCloseSetup.addEventListener('click', closeSetupModal);
  const btnSetupSave = document.getElementById('btnSetupSave');
  if (btnSetupSave) btnSetupSave.addEventListener('click', handleSetupSave);
  const btnSetupLogout = document.getElementById('btnSetupLogout');
  if (btnSetupLogout) {
    btnSetupLogout.addEventListener('click', () => {
      localStorage.removeItem('gh_token_keuangan_ghoits');
      state.token = '';
      const input = document.getElementById('setupToken');
      if (input) input.value = '';
      closeSetupModal();
      showToast('Token Dihapus', 'Sekarang dalam mode baca.');
    });
  }

  window.addEventListener('click', e => {
    if (e.target === document.getElementById('modalTransaction')) showModal(false);
    if (e.target === document.getElementById('modalDeleteConfirm')) closeDeleteModal();
    if (e.target === document.getElementById('modalQrCode')) closeQrModal();
    if (e.target === document.getElementById('modalSetup')) closeSetupModal();
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      showModal(false);
      closeDeleteModal();
      closeQrModal();
      closeSetupModal();
    }
  });
}

window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;

document.addEventListener('DOMContentLoaded', init);
