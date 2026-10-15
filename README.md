# 💰 Keuangan Ghoits - Aplikasi Manajemen Keuangan Berbasis CRUD

Keuangan Ghoits adalah aplikasi web pencatatan dan pengelolaan keuangan pribadi modern dengan kemampuan **CRUD (Create, Read, Update, Delete)** yang lengkap, antarmuka responsif, visualisasi grafik arus kas interaktif, dan ekspor data laporan.

---

## ✨ Fitur Utama

### 1. Operasi CRUD Lengkap
- **Create (Catat Transaksi Baru)**:
  - Input transaksi pemasukan (*Income*) dan pengeluaran (*Expense*).
  - Validasi nominal otomatis dengan preview mata uang Rupiah.
  - Pilihan kategori dan sumber dana / dompet (Kas, BCA, Mandiri, E-Wallet).
  - Input tanggal fleksibel dan catatan tambahan opsional.
- **Read (Lihat & Filter Riwayat)**:
  - Tabel riwayat transaksi dengan badge warna (Hijau untuk Pemasukan, Merah untuk Pengeluaran).
  - Filter berdasarkan tipe transaksi (Semua, Pemasukan Saja, Pengeluaran Saja).
  - Filter berdasarkan kategori & dompet/sumber dana.
  - Filter rentang tanggal (*Date Range*) dengan preset: *Hari Ini*, *Bulan Ini*, dan *Semua Waktu*.
  - Pencarian real-time (*Live Search*) berdasarkan keterangan, catatan, atau kategori.
- **Update (Edit Data Transaksi)**:
  - Modal form untuk memperbarui data transaksi yang sudah dicatat.
  - Nilai form terisi otomatis dan tersinkronisasi kembali dengan saldo total.
- **Delete (Hapus Transaksi)**:
  - Modal dialog konfirmasi keamanan sebelum menghapus data permanen.

### 2. Dashboard & Visualisasi Finansial
- **Kartu Ringkasan Keuangan**:
  - Total Saldo Bersih (*Net Balance*) dengan indikator status otomatis (Surplus vs Defisit).
  - Total Pemasukan Akumulatif.
  - Total Pengeluaran Akumulatif.
  - Total Riwayat Transaksi Tersimpan.
- **Grafik Interaktif (Chart.js)**:
  - **Grafik Batang Arus Kas**: Perbandingan pemasukan vs pengeluaran per periode waktu.
  - **Grafik Donat Kategori**: Analisis persentase pengeluaran terbesar berdasarkan kategori.

### 3. Ekspor & Laporan
- **Ekspor CSV**: Mengunduh riwayat transaksi yang sedang difilter ke file CSV (kompatibel langsung dengan Microsoft Excel / Google Sheets).
- **Cetak Laporan**: Tampilan khusus ramah cetak (*Print-friendly layout*) untuk mencetak atau menyimpan laporan ke PDF.

---

## 🛠️ Stack Teknologi

- **Backend**: Node.js & Express.js (REST API terstruktur)
- **Database**: Penyimpanan file JSON atomik lokal (`data/database.json`) — bebas konfigurasi server eksternal dan aman dari masalah build tools C++
- **Frontend**: HTML5, Tailwind CSS, Lucide Icons, Chart.js, Vanilla JavaScript (Modern SPA)
- **Format Lokal**: Dukungan penuh format mata uang Rupiah (IDR) dan tanggal Indonesia

---

## 📁 Struktur Direktori

```text
project keuangan/
├── data/
│   └── database.json          # File database lokal (auto-created)
├── public/
│   ├── css/
│   │   └── style.css          # Styling custom & layout print
│   ├── js/
│   │   └── app.js             # Logika interaksi frontend & REST API
│   └── index.html             # Tampilan dashboard web utama
├── src/
│   └── db.js                  # Modul persistensi data & operasi CRUD
├── package.json               # Konfigurasi dependensi project
├── README.md                  # Dokumentasi proyek
└── server.js                  # Entry point server Express.js
```

---

## 🚀 Cara Menjalankan Proyek

1. Pastikan Anda berada di direktori project:
   ```bash
   cd "c:\Users\TOSHIBA\Downloads\project keuangan"
   ```

2. Jalankan server:
   ```bash
   npm start
   ```
   *Atau dengan mode development (auto-reload di Node.js modern):*
   ```bash
   npm run dev
   ```

3. Buka browser Anda dan akses:
   ```text
   http://localhost:3000
   ```

---

## 🔌 Dokumentasi REST API

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/transactions` | Mendapatkan daftar transaksi (mendukung query filter & search) |
| `GET` | `/api/transactions/:id` | Mendapatkan detail 1 transaksi berdasarkan ID |
| `POST` | `/api/transactions` | Membuat catatan transaksi baru |
| `PUT` | `/api/transactions/:id` | Memperbarui data transaksi |
| `DELETE` | `/api/transactions/:id` | Menghapus data transaksi |
| `GET` | `/api/summary` | Mendapatkan kalkulasi total saldo, pemasukan, pengeluaran & grafik |
| `GET` | `/api/categories` | Mendapatkan daftar kategori |
| `POST` | `/api/categories` | Menambah kategori baru |
| `GET` | `/api/wallets` | Mendapatkan daftar dompet/akun |
| `POST` | `/api/wallets` | Menambah dompet/akun baru |
| `GET` | `/api/export/csv` | Mengunduh data transaksi ke format file CSV |
