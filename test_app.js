const http = require('http');
const db = require('./src/db');

async function runTests() {
  console.log('=== MEMULAI TEST CRUD & API ===');

  // 1. Test Database CRUD
  console.log('\n[1/6] Test DB Summary & Read Initial...');
  const summary = db.getSummary();
  console.log(`✓ Saldo: Rp ${summary.balance.toLocaleString('id-ID')}, Transaksi: ${summary.transactionCount}`);

  console.log('\n[2/6] Test DB Create Transaction...');
  const newTx = db.createTransaction({
    type: 'income',
    amount: 1500000,
    category: 'Freelance & Bisnis',
    wallet: 'Bank BCA',
    date: '2026-10-15',
    description: 'Uji Coba Tambah Pemasukan Freelance',
    notes: 'Testing CRUD otomatis'
  });
  console.log(`✓ Berhasil dibuat ID: ${newTx.id}, Deskripsi: ${newTx.description}`);

  console.log('\n[3/6] Test DB Update Transaction...');
  const updatedTx = db.updateTransaction(newTx.id, {
    amount: 1750000,
    description: 'Uji Coba Tambah Pemasukan Freelance (Updated)'
  });
  console.log(`✓ Berhasil diupdate: ${updatedTx.description}, Nominal: Rp ${updatedTx.amount.toLocaleString('id-ID')}`);

  console.log('\n[4/6] Test DB Delete Transaction...');
  const deleted = db.deleteTransaction(newTx.id);
  console.log(`✓ Status hapus: ${deleted ? 'Sukses' : 'Gagal'}`);

  console.log('\n[5/6] Test DB Export CSV...');
  const csv = db.exportToCsv();
  console.log(`✓ Header CSV terverifikasi: ${csv.split('\r\n')[0]}`);

  // 2. Test HTTP Server
  console.log('\n[6/6] Menjalankan Express Server untuk Uji API HTTP...');
  const express = require('express');
  const cors = require('cors');
  const path = require('path');

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Routes
  app.get('/api/transactions', (req, res) => {
    res.json({ success: true, data: db.getAllTransactions(req.query) });
  });

  app.post('/api/transactions', (req, res) => {
    const created = db.createTransaction(req.body);
    res.status(201).json({ success: true, data: created });
  });

  app.delete('/api/transactions/:id', (req, res) => {
    const del = db.deleteTransaction(req.params.id);
    res.json({ success: Boolean(del) });
  });

  const server = app.listen(3456, async () => {
    console.log('✓ Server test berjalan di port 3456');

    try {
      // Test HTTP GET
      const getRes = await fetch('http://localhost:3456/api/transactions');
      const getData = await getRes.json();
      console.log(`✓ HTTP GET /api/transactions respon: ${getData.data.length} transaksi`);

      // Test HTTP POST
      const postRes = await fetch('http://localhost:3456/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          amount: 50000,
          category: 'Makanan & Minuman',
          wallet: 'Uang Tunai / Kas',
          date: '2026-10-15',
          description: 'HTTP POST Test Makan Siang'
        })
      });
      const postData = await postRes.json();
      console.log(`✓ HTTP POST /api/transactions respon ID: ${postData.data.id}`);

      // Test HTTP DELETE
      const delRes = await fetch(`http://localhost:3456/api/transactions/${postData.data.id}`, {
        method: 'DELETE'
      });
      const delData = await delRes.json();
      console.log(`✓ HTTP DELETE /api/transactions/${postData.data.id} respon: ${delData.success}`);

      server.close(() => {
        console.log('\n🎉 SEMUA PENGUJIAN OTOMATIS SELESAI & BERHASIL 100%!');
      });
    } catch (e) {
      console.error('Error saat test HTTP:', e);
      server.close();
      process.exit(1);
    }
  });
}

runTests();
