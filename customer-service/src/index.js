const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;
const fs = require('fs');
const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)){
    fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'customer.db');

app.use(bodyParser.json());

// Initialize SQLite Database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening customer database:', err.message);
  } else {
    console.log('Connected to customer database.');
    db.run(`CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'customer-service' });
});

// Create Customer (v1 API)
app.post('/v1/customers', (req, res) => {
  const { name, email, phone, address } = req.body;

  if (!name || !email || !phone || !address) {
    return res.status(400).json({ error: 'All fields (name, email, phone, address) are required.' });
  }

  const query = `INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)`;
  db.run(query, [name, email, phone, address], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Customer with this email already exists.' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({
      id: this.lastID,
      name,
      email,
      phone,
      address
    });
  });
});

// Get all Customers (v1 API)
app.get('/v1/customers', (req, res) => {
  db.all(`SELECT * FROM customers`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get Customer by ID (v1 API)
app.get('/v1/customers/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.get(`SELECT * FROM customers WHERE id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: `Customer with ID ${id} not found.` });
    }
    res.json(row);
  });
});

app.listen(PORT, () => {
  console.log(`Customer Service running on port ${PORT}`);
});
