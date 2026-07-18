const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5002;
const fs = require('fs');
const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)){
    fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'expert.db');

app.use(bodyParser.json());

// Initialize SQLite Database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening expert database:', err.message);
  } else {
    console.log('Connected to expert database.');
    db.run(`CREATE TABLE IF NOT EXISTS experts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      skills TEXT NOT NULL,
      aadhaar TEXT UNIQUE NOT NULL,
      verified INTEGER DEFAULT 0,
      status TEXT DEFAULT 'available',
      rating REAL DEFAULT 5.0,
      hourly_rate REAL NOT NULL,
      city TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (createErr) => {
      if (!createErr) {
        // Seed default experts if table is empty
        db.get("SELECT COUNT(*) as count FROM experts", [], (countErr, row) => {
          if (row && row.count === 0) {
            const seedQuery = `INSERT INTO experts (name, phone, skills, aadhaar, verified, status, rating, hourly_rate, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            db.run(seedQuery, ['Priya Sharma', '9876543210', 'kitchen cleaning,dishwashing', '123456789012', 1, 'available', 4.9, 150, 'Mumbai']);
            db.run(seedQuery, ['Anjali Patil', '9876543211', 'laundry,fan/window cleaning', '123456789013', 1, 'available', 4.8, 120, 'Mumbai']);
            db.run(seedQuery, ['Kavita Rao', '9876543212', 'bathroom cleaning,kitchen cleaning', '123456789014', 1, 'available', 4.7, 180, 'Bangalore']);
            console.log('Database seeded with default experts.');
          }
        });
      }
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'expert-service' });
});

// Create Expert
app.post('/v1/experts', (req, res) => {
  const { name, phone, skills, aadhaar, verified, status, rating, hourly_rate, city } = req.body;

  if (!name || !phone || !skills || !aadhaar || hourly_rate === undefined || !city) {
    return res.status(400).json({ error: 'Fields (name, phone, skills, aadhaar, hourly_rate, city) are required.' });
  }

  const query = `INSERT INTO experts (name, phone, skills, aadhaar, verified, status, rating, hourly_rate, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(query, [name, phone, skills, aadhaar, verified || 0, status || 'available', rating || 5.0, hourly_rate, city], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Expert with this Aadhaar number already exists.' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({
      id: this.lastID,
      name,
      phone,
      skills,
      aadhaar,
      verified: verified || 0,
      status: status || 'available',
      rating: rating || 5.0,
      hourly_rate,
      city
    });
  });
});

// Get/Filter Experts (e.g. by city, skill, status)
app.get('/v1/experts', (req, res) => {
  const { city, skill, status } = req.query;
  let query = `SELECT * FROM experts WHERE 1=1`;
  const params = [];

  if (city) {
    query += ` AND city = ?`;
    params.push(city);
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Client-side filtering for skills if query parameter is provided
    if (skill) {
      const lowerSkill = skill.toLowerCase();
      const filtered = rows.filter(r => r.skills.toLowerCase().includes(lowerSkill));
      return res.json(filtered);
    }
    res.json(rows);
  });
});

// Get Expert by ID
app.get('/v1/experts/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.get(`SELECT * FROM experts WHERE id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: `Expert with ID ${id} not found.` });
    }
    res.json(row);
  });
});

// Update Expert Status
app.put('/v1/experts/:id/status', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  db.run(`UPDATE experts SET status = ? WHERE id = ?`, [status, id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: `Expert with ID ${id} not found.` });
    }
    res.json({ message: `Expert status updated successfully.`, id, status });
  });
});

app.listen(PORT, () => {
  console.log(`Expert Service running on port ${PORT}`);
});
