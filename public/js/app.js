/**
 * Keuangan Ghoits - Frontend Application Logic
 * Mengelola state, REST API calls, operasi CRUD, Chart.js, dan interaksi UI.
 */

// State Aplikasi
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
  categoryChart: null
};

// Helper: Format Rupiah (IDR)
function formatRupiah(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

// Helper: Format Tanggal Indonesia (contoh: 15 Okt 2026)
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

// Helper: Tampilkan Toast Notifikasi
function showToast(title, message, isSuccess = true) {
  const toast = document.getElementById('toast');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  toastTitle.textContent = title;
  toastMessage.textContent = message;

  if (isSuccess) {
    toastIcon.className = 'w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center';
    toastIcon.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
  } else {
    toastIcon.className = 'w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center';
    toastIcon.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4"></i>';
  }

  lucide.createIcons();
  toast.classList.add('toast-active');

  setTimeout(() => {
    toast.classList.remove('toast-active');
  }, 3500);
}

// ================= INISIALISASI & LOAD DATA ================= //

async function init() {
  // Set default tanggal transaksi modal ke hari ini
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('txDate').value = today;

  // Pasang preset awal bulan ini pada filter tanggal
  setPresetThisMonth();

  // Load referensi dan data transaksi
  await loadCategoriesAndWallets();
  await refreshAll();

  // Inisialisasi ikon Lucide
  lucide.createIcons();

  // Registrasi event listener
  setupEventListeners();
}

// Ambil Kategori dan Dompet dari Server
async function loadCategoriesAndWallets() {
  try {
    const [resCats, resWallets] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/wallets')
    ]);

    const dataCats = await resCats.json();
    const dataWallets = await resWallets.json();

    if (dataCats.success) state.categories = dataCats.data;
    if (dataWallets.success) state.wallets = dataWallets.data;

    populateFilterDropdowns();
    updateModalCategories();
    populateModalWallets();
  } catch (err) {
    console.error('Gagal memuat kategori & dompet:', err);
    showToast('Koneksi Gagal', 'Gagal memuat kategori dan dompet dari server', false);
  }
}

// Isi Dropdown Filter
function populateFilterDropdowns() {
  const catFilter = document.getElementById('filterCategory');
  const walletFilter = document.getElementById('filterWallet');

  catFilter.innerHTML = '<option value="all">Semua Kategori</option>';
  state.categories.forEach(c => {
    catFilter.innerHTML += `<option value="${c.name}">${c.type === 'income' ? '🟢' : '🔴'} ${c.name}</option>`;
  });

  walletFilter.innerHTML = '<option value="all">Semua Dompet / Akun</option>';
  state.wallets.forEach(w => {
    walletFilter.innerHTML += `<option value="${w.name}">💳 ${w.name}</option>`;
  });
}

// Isi Dropdown Kategori di Modal sesuai tipe (income / expense)
function updateModalCategories() {
  const currentType = document.getElementById('txType').value;
  const select = document.getElementById('txCategory');
  select.innerHTML = '';

  const filtered = state.categories.filter(c => c.type === currentType);
  filtered.forEach(c => {
    select.innerHTML += `<option value="${c.name}">${c.name}</option>`;
  });

  if (filtered.length === 0) {
    select.innerHTML = `<option value="Umum">Umum</option>`;
  }
}

// Isi Dropdown Dompet di Modal
function populateModalWallets() {
  const select = document.getElementById('txWallet');
  select.innerHTML = '';
  state.wallets.forEach(w => {
    select.innerHTML += `<option value="${w.name}">${w.name}</option>`;
  });
}

// Refresh Semua Data (Transaksi + Summary)
async function refreshAll() {
  await Promise.all([loadTransactions(), loadSummary()]);
}

// Ambil Ringkasan Finansial untuk Kartu Statistik & Grafik
async function loadSummary() {
  try {
    const query = buildQueryParams();
    const res = await fetch(`/api/summary?${query}`);
    const result = await res.json();

    if (result.success) {
      state.summary = result.data;
      renderSummaryCards(result.data);
      renderCharts(result.data);
    }
  } catch (err) {
    console.error('Gagal memuat ringkasan:', err);
  }
}

// Render Kartu Ringkasan Finansial
function renderSummaryCards(summary) {
  const statBalance = document.getElementById('statBalance');
  const statIncome = document.getElementById('statIncome');
  const statExpense = document.getElementById('statExpense');
  const statCount = document.getElementById('statCount');
  const statBalanceBadge = document.getElementById('statBalanceBadge');

  statBalance.textContent = formatRupiah(summary.balance);
  statIncome.textContent = formatRupiah(summary.totalIncome);
  statExpense.textContent = formatRupiah(summary.totalExpense);
  statCount.textContent = summary.transactionCount.toLocaleString('id-ID');

  // Badge Status Saldo
  if (summary.balance > 0) {
    statBalanceBadge.className = 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60';
    statBalanceBadge.innerHTML = '<i data-lucide="trending-up" class="w-3.5 h-3.5"></i> Surplus (Positif)';
  } else if (summary.balance < 0) {
    statBalanceBadge.className = 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60';
    statBalanceBadge.innerHTML = '<i data-lucide="trending-down" class="w-3.5 h-3.5"></i> Defisit (Negatif)';
  } else {
    statBalanceBadge.className = 'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60';
    statBalanceBadge.innerHTML = '<i data-lucide="minus" class="w-3.5 h-3.5"></i> Saldo Seimbang';
  }

  lucide.createIcons();
}

// Ambil Transaksi dari Server (Read)
async function loadTransactions() {
  try {
    const query = buildQueryParams();
    const res = await fetch(`/api/transactions?${query}`);
    const result = await res.json();

    if (result.success) {
      state.transactions = result.data;
      renderTable(result.data);
    }
  } catch (err) {
    console.error('Gagal memuat transaksi:', err);
    showToast('Gagal', 'Terjadi kesalahan saat memuat data transaksi', false);
  }
}

// Render Tabel & Card Transaksi (Desktop Table & Mobile Cards)
function renderTable(transactions) {
  const tbody = document.getElementById('transactionsTableBody');
  const mobileList = document.getElementById('transactionsMobileList');
  const emptyState = document.getElementById('emptyState');
  const counterText = document.getElementById('tableCounterText');

  counterText.textContent = `Menampilkan ${transactions.length} transaksi`;

  if (transactions.length === 0) {
    if (tbody) tbody.innerHTML = '';
    if (mobileList) mobileList.innerHTML = '';
    emptyState.classList.remove('hidden');
    lucide.createIcons();
    return;
  }

  emptyState.classList.add('hidden');

  // 1. Render Desktop Table Rows
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
            <div class="text-[10px] text-slate-400 font-mono">${t.date}</div>
          </td>
          <td class="py-3.5 px-4">
            <div class="font-semibold text-slate-900">${escapeHtml(t.description)}</div>
            ${t.notes ? `<div class="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs flex items-center gap-1"><i data-lucide="info" class="w-3 h-3 text-slate-400 inline shrink-0"></i> ${escapeHtml(t.notes)}</div>` : ''}
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
            <div class="font-extrabold text-sm sm:text-base ${amountColor}">
              ${sign} ${formatRupiah(t.amount)}
            </div>
            <div class="text-[10px] uppercase font-bold tracking-wider ${isIncome ? 'text-emerald-500' : 'text-rose-500'}">
              ${typeLabel}
            </div>
          </td>
          <td class="py-3.5 px-6 whitespace-nowrap text-center">
            <div class="inline-flex items-center gap-1.5">
              <button 
                onclick="openEditModal('${t.id}')" 
                class="p-1.5 sm:p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" 
                title="Edit Transaksi"
              >
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button 
                onclick="openDeleteModal('${t.id}')" 
                class="p-1.5 sm:p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" 
                title="Hapus Transaksi"
              >
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 2. Render Mobile Touch-Friendly Card List
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
            <div class="font-extrabold text-xs sm:text-sm ${amountColor}">
              ${sign} ${formatRupiah(t.amount)}
            </div>
            <div class="flex items-center justify-end gap-1 mt-1">
              <button onclick="openEditModal('${t.id}')" class="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition" title="Edit">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="openDeleteModal('${t.id}')" class="p-1 text-slate-400 hover:text-rose-600 rounded-md transition" title="Hapus">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  lucide.createIcons();
}

// Escape HTML untuk mencegah XSS
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ================= CHART RENDERING ================= //

function renderCharts(summary) {
  renderCashflowChart(summary.cashflowByMonth || {});
  renderCategoryChart(summary.expenseByCategory || {});
}

// Grafik Arus Kas Bar Chart
function renderCashflowChart(cashflowData) {
  const ctx = document.getElementById('cashflowChart').getContext('2d');
  const labels = Object.keys(cashflowData).sort();

  if (labels.length === 0) {
    labels.push(new Date().toISOString().slice(0, 7));
  }

  const incomeData = labels.map(l => cashflowData[l] ? cashflowData[l].income : 0);
  const expenseData = labels.map(l => cashflowData[l] ? cashflowData[l].expense : 0);

  // Format label bulan ke teks Indonesia (misal: "Okt 2026")
  const formattedLabels = labels.map(l => {
    const parts = l.split('-');
    if (parts.length === 2) {
      const d = new Date(parts[0], parts[1] - 1, 1);
      return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(d);
    }
    return l;
  });

  if (state.cashflowChart) {
    state.cashflowChart.destroy();
  }

  state.cashflowChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: formattedLabels,
      datasets: [
        {
          label: 'Pemasukan (IDR)',
          data: incomeData,
          backgroundColor: '#10b981',
          borderRadius: 8,
          borderSkipped: false
        },
        {
          label: 'Pengeluaran (IDR)',
          data: expenseData,
          backgroundColor: '#ef4444',
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${formatRupiah(context.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              if (value >= 1000000) return 'Rp ' + (value / 1000000).toFixed(1) + ' jt';
              if (value >= 1000) return 'Rp ' + (value / 1000).toFixed(0) + ' rb';
              return 'Rp ' + value;
            }
          },
          grid: { color: '#f1f5f9' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// Grafik Donut Kategori Pengeluaran
function renderCategoryChart(categoryData) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const labels = Object.keys(categoryData);
  const values = Object.values(categoryData);

  if (state.categoryChart) {
    state.categoryChart.destroy();
  }

  if (labels.length === 0) {
    ctx.clearRect(0, 0, 300, 300);
    return;
  }

  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'
  ];

  state.categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.raw;
              const total = values.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return `${context.label}: ${formatRupiah(val)} (${percentage}%)`;
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

// ================= MODAL OPERASI (CREATE & UPDATE) ================= //

// Buka Modal Tambah Transaksi
function openAddModal() {
  state.currentEditingId = null;
  document.getElementById('modalTitle').textContent = 'Catat Transaksi Baru';
  document.getElementById('modalSubtitle').textContent = 'Isi rincian informasi transaksi keuangan Anda';
  document.getElementById('btnSaveText').textContent = 'Simpan Transaksi';
  document.getElementById('txId').value = '';

  // Reset form
  document.getElementById('txAmount').value = '';
  document.getElementById('amountPreview').textContent = 'Rp 0';
  document.getElementById('txDescription').value = '';
  document.getElementById('txNotes').value = '';
  document.getElementById('txDate').value = new Date().toISOString().split('T')[0];

  // Set default type ke expense
  setTypeToggle('expense');

  showModal(true);
}

// Buka Modal Edit Transaksi
async function openEditModal(id) {
  try {
    const res = await fetch(`/api/transactions/${id}`);
    const result = await res.json();

    if (!result.success || !result.data) {
      showToast('Error', 'Data transaksi tidak ditemukan', false);
      return;
    }

    const t = result.data;
    state.currentEditingId = t.id;

    document.getElementById('modalTitle').textContent = 'Edit Data Transaksi';
    document.getElementById('modalSubtitle').textContent = `Memperbarui ID: ${t.id}`;
    document.getElementById('btnSaveText').textContent = 'Perbarui Transaksi';

    document.getElementById('txId').value = t.id;
    document.getElementById('txAmount').value = t.amount;
    document.getElementById('amountPreview').textContent = formatRupiah(t.amount);
    document.getElementById('txDescription').value = t.description;
    document.getElementById('txDate').value = t.date;
    document.getElementById('txNotes').value = t.notes || '';

    // Set tipe & sinkronkan kategori
    setTypeToggle(t.type);

    document.getElementById('txCategory').value = t.category;
    document.getElementById('txWallet').value = t.wallet;

    showModal(true);
  } catch (err) {
    console.error('Gagal mengambil data edit:', err);
    showToast('Error', 'Gagal memuat detail transaksi', false);
  }
}

// Toggle Segmented Button Tipe Transaksi
function setTypeToggle(type) {
  const hiddenType = document.getElementById('txType');
  const btnExpense = document.getElementById('btnTypeExpense');
  const btnIncome = document.getElementById('btnTypeIncome');

  hiddenType.value = type;

  if (type === 'income') {
    btnIncome.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition bg-white text-emerald-600 shadow-xs';
    btnExpense.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition text-slate-600 hover:text-rose-600';
  } else {
    btnExpense.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition bg-white text-rose-600 shadow-xs';
    btnIncome.className = 'flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition text-slate-600 hover:text-emerald-600';
  }

  updateModalCategories();
}

// Tampilkan / Tutup Modal
function showModal(isOpen) {
  const modal = document.getElementById('modalTransaction');
  if (isOpen) {
    modal.classList.remove('hidden');
    document.getElementById('txAmount').focus();
  } else {
    modal.classList.add('hidden');
  }
}

// Handle Submit Form Transaksi (CREATE / UPDATE)
async function handleTransactionSubmit(e) {
  e.preventDefault();

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

  const url = isEditing ? `/api/transactions/${id}` : '/api/transactions';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!result.success) {
      showToast('Gagal Menyimpan', result.message || 'Terjadi kesalahan', false);
      return;
    }

    showModal(false);
    showToast(
      isEditing ? 'Transaksi Diperbarui' : 'Transaksi Dicatat',
      result.message || 'Data berhasil disimpan ke sistem'
    );
    await refreshAll();
  } catch (err) {
    console.error('Error saat menyimpan transaksi:', err);
    showToast('Error Server', 'Tidak dapat menghubungi server', false);
  }
}

// ================= MODAL OPERASI (DELETE) ================= //

function openDeleteModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  state.pendingDeleteId = id;
  document.getElementById('delPreviewDesc').textContent = tx.description;
  document.getElementById('delPreviewAmount').textContent = `${tx.type === 'income' ? '+' : '-'} ${formatRupiah(tx.amount)}`;
  document.getElementById('delPreviewDate').textContent = formatDateIndo(tx.date);
  document.getElementById('delPreviewCategory').textContent = `${tx.category} (${tx.wallet})`;

  const modalDel = document.getElementById('modalDeleteConfirm');
  modalDel.classList.remove('hidden');
}

function closeDeleteModal() {
  state.pendingDeleteId = null;
  document.getElementById('modalDeleteConfirm').classList.add('hidden');
}

async function confirmDelete() {
  const id = state.pendingDeleteId;
  if (!id) return;

  try {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();

    if (result.success) {
      closeDeleteModal();
      showToast('Transaksi Terhapus', 'Data transaksi berhasil dihapus dari sistem');
      await refreshAll();
    } else {
      showToast('Gagal Menghapus', result.message || 'Gagal menghapus', false);
    }
  } catch (err) {
    console.error('Error menghapus transaksi:', err);
    showToast('Error Server', 'Terjadi kesalahan saat menghapus transaksi', false);
  }
}

// ================= FILTER & QUERY BUILDER ================= //

function buildQueryParams() {
  const params = new URLSearchParams();

  if (state.filters.type && state.filters.type !== 'all') {
    params.append('type', state.filters.type);
  }
  if (state.filters.category && state.filters.category !== 'all') {
    params.append('category', state.filters.category);
  }
  if (state.filters.wallet && state.filters.wallet !== 'all') {
    params.append('wallet', state.filters.wallet);
  }
  if (state.filters.startDate) {
    params.append('startDate', state.filters.startDate);
  }
  if (state.filters.endDate) {
    params.append('endDate', state.filters.endDate);
  }
  if (state.filters.search) {
    params.append('search', state.filters.search);
  }

  return params.toString();
}

function setPresetToday() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filterStartDate').value = today;
  document.getElementById('filterEndDate').value = today;
  state.filters.startDate = today;
  state.filters.endDate = today;
  refreshAll();
}

function setPresetThisMonth() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  document.getElementById('filterStartDate').value = firstDay;
  document.getElementById('filterEndDate').value = lastDay;
  state.filters.startDate = firstDay;
  state.filters.endDate = lastDay;
}

function setPresetAllTime() {
  document.getElementById('filterStartDate').value = '';
  document.getElementById('filterEndDate').value = '';
  state.filters.startDate = '';
  state.filters.endDate = '';
  refreshAll();
}

function resetAllFilters() {
  state.filters.type = 'all';
  state.filters.category = 'all';
  state.filters.wallet = 'all';
  state.filters.search = '';

  document.getElementById('filterType').value = 'all';
  document.getElementById('filterCategory').value = 'all';
  document.getElementById('filterWallet').value = 'all';
  document.getElementById('searchInput').value = '';

  setPresetAllTime();
}

// Ekspor ke CSV
function triggerExportCsv() {
  const query = buildQueryParams();
  window.location.href = `/api/export/csv?${query}`;
}

// ================= EVENT LISTENERS ================= //

function setupEventListeners() {
  // Modal Open & Close
  document.getElementById('btnOpenAddModal').addEventListener('click', openAddModal);
  const btnFabAdd = document.getElementById('btnFabAdd');
  if (btnFabAdd) btnFabAdd.addEventListener('click', openAddModal);
  document.getElementById('btnEmptyAdd').addEventListener('click', openAddModal);
  document.getElementById('btnCloseModal').addEventListener('click', () => showModal(false));
  document.getElementById('btnCancelModal').addEventListener('click', () => showModal(false));

  // Tipe Transaksi Toggle
  document.getElementById('btnTypeExpense').addEventListener('click', () => setTypeToggle('expense'));
  document.getElementById('btnTypeIncome').addEventListener('click', () => setTypeToggle('income'));

  // Form Submit
  document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);

  // Live Amount Preview
  document.getElementById('txAmount').addEventListener('input', (e) => {
    document.getElementById('amountPreview').textContent = formatRupiah(e.target.value);
  });

  // Modal Delete Events
  document.getElementById('btnCancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('btnConfirmDelete').addEventListener('click', confirmDelete);

  // Filter Events
  document.getElementById('filterType').addEventListener('change', (e) => {
    state.filters.type = e.target.value;
    refreshAll();
  });

  document.getElementById('filterCategory').addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    refreshAll();
  });

  document.getElementById('filterWallet').addEventListener('change', (e) => {
    state.filters.wallet = e.target.value;
    refreshAll();
  });

  document.getElementById('filterStartDate').addEventListener('change', (e) => {
    state.filters.startDate = e.target.value;
    refreshAll();
  });

  document.getElementById('filterEndDate').addEventListener('change', (e) => {
    state.filters.endDate = e.target.value;
    refreshAll();
  });

  // Search Debounce (300ms)
  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.search = e.target.value;
      refreshAll();
    }, 300);
  });

  // Preset Buttons
  document.getElementById('btnPresetToday').addEventListener('click', setPresetToday);
  document.getElementById('btnPresetThisMonth').addEventListener('click', () => {
    setPresetThisMonth();
    refreshAll();
  });
  document.getElementById('btnPresetAllTime').addEventListener('click', setPresetAllTime);
  document.getElementById('btnResetFilter').addEventListener('click', resetAllFilters);
  document.getElementById('btnRefresh').addEventListener('click', refreshAll);

  // Print & Export
  document.getElementById('btnPrint').addEventListener('click', () => window.print());
  document.getElementById('btnExportCsv').addEventListener('click', triggerExportCsv);

  // QR Code & Remote Access Modal
  const btnOpenQr = document.getElementById('btnOpenQrModal');
  const btnCloseQr = document.getElementById('btnCloseQrModal');
  const tabRemote = document.getElementById('tabRemoteUrl');
  const tabLocal = document.getElementById('tabLocalUrl');
  const btnCopyUrl = document.getElementById('btnCopyUrl');
  const btnCopyPass = document.getElementById('btnCopyPassword');

  if (btnOpenQr) btnOpenQr.addEventListener('click', openQrModal);
  if (btnCloseQr) btnCloseQr.addEventListener('click', closeQrModal);

  if (tabRemote) {
    tabRemote.addEventListener('click', () => {
      activeQrMode = 'remote';
      updateQrModalView();
    });
  }

  if (tabLocal) {
    tabLocal.addEventListener('click', () => {
      activeQrMode = 'local';
      updateQrModalView();
    });
  }

  if (btnCopyUrl) {
    btnCopyUrl.addEventListener('click', () => {
      const url = activeQrMode === 'remote' ? REMOTE_URL : LOCAL_URL;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link Disalin', 'Alamat web berhasil disalin ke clipboard');
      }).catch(() => {
        showToast('Gagal Salin', 'Silakan salin alamat secara manual', false);
      });
    });
  }

  if (btnCopyPass) {
    btnCopyPass.addEventListener('click', () => {
      navigator.clipboard.writeText(TUNNEL_PASS).then(() => {
        showToast('Password Disalin', 'Password tunnel IP berhasil disalin');
      });
    });
  }

  // Close modals on click outside
  window.addEventListener('click', (e) => {
    const modalTx = document.getElementById('modalTransaction');
    const modalDel = document.getElementById('modalDeleteConfirm');
    const modalQr = document.getElementById('modalQrCode');
    if (e.target === modalTx) showModal(false);
    if (e.target === modalDel) closeDeleteModal();
    if (e.target === modalQr) closeQrModal();
  });

  // Close modals on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      showModal(false);
      closeDeleteModal();
      closeQrModal();
    }
  });
}

// ================= MODAL QR CODE & REMOTE ACCESS ================= //
const REMOTE_URL = 'https://tall-mod-barbara-cooperation.trycloudflare.com';
const LOCAL_URL = 'http://192.168.1.17:3000';
let activeQrMode = 'remote';

function updateQrModalView() {
  const isRemote = activeQrMode === 'remote';
  const url = isRemote ? REMOTE_URL : LOCAL_URL;
  const qrImg = document.getElementById('qrCodeImage');
  const urlLabel = document.getElementById('qrUrlLabel');
  const passwordBox = document.getElementById('remotePasswordBox');
  const directOpen = document.getElementById('btnDirectOpen');
  const tabRemote = document.getElementById('tabRemoteUrl');
  const tabLocal = document.getElementById('tabLocalUrl');

  if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
  if (urlLabel) urlLabel.textContent = url;
  if (directOpen) directOpen.href = url;

  if (isRemote) {
    if (passwordBox) passwordBox.classList.remove('hidden');
    if (tabRemote) tabRemote.className = 'py-2 rounded-lg bg-white text-indigo-600 shadow-xs transition flex items-center justify-center gap-1.5 font-bold';
    if (tabLocal) tabLocal.className = 'py-2 rounded-lg text-slate-600 hover:text-indigo-600 transition flex items-center justify-center gap-1.5 font-bold';
  } else {
    if (passwordBox) passwordBox.classList.add('hidden');
    if (tabLocal) tabLocal.className = 'py-2 rounded-lg bg-white text-indigo-600 shadow-xs transition flex items-center justify-center gap-1.5 font-bold';
    if (tabRemote) tabRemote.className = 'py-2 rounded-lg text-slate-600 hover:text-indigo-600 transition flex items-center justify-center gap-1.5 font-bold';
  }
}

function openQrModal() {
  activeQrMode = 'remote';
  updateQrModalView();
  const modal = document.getElementById('modalQrCode');
  if (modal) modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeQrModal() {
  const modal = document.getElementById('modalQrCode');
  if (modal) modal.classList.add('hidden');
}

// Expose functions globally for inline HTML onclick handlers
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;

// Jalankan inisialisasi saat DOM siap
document.addEventListener('DOMContentLoaded', init);
