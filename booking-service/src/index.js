const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5003;
const fs = require('fs');
const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)){
    fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'booking.db');

const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:5001';
const EXPERT_SERVICE_URL = process.env.EXPERT_SERVICE_URL || 'http://localhost:5002';

app.use(bodyParser.json());

// Initialize SQLite Database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening booking database:', err.message);
  } else {
    console.log('Connected to booking database.');
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      expert_id INTEGER NOT NULL,
      service_type TEXT NOT NULL,
      duration_hours INTEGER NOT NULL,
      total_cost REAL NOT NULL,
      status TEXT DEFAULT 'assigned',
      booking_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'booking-service' });
});

// Create Booking (Orchestration & Sync Inter-Service Communication)
app.post('/v1/bookings', async (req, res) => {
  const { customer_id, expert_id, service_type, duration_hours, booking_date } = req.body;

  if (!customer_id || !expert_id || !service_type || !duration_hours || !booking_date) {
    return res.status(400).json({ error: 'Fields (customer_id, expert_id, service_type, duration_hours, booking_date) are required.' });
  }

  try {
    // 1. Verify customer exists via Customer Service
    console.log(`Verifying customer ID ${customer_id} at ${CUSTOMER_SERVICE_URL}/v1/customers/${customer_id}`);
    let customerResponse;
    try {
      customerResponse = await axios.get(`${CUSTOMER_SERVICE_URL}/v1/customers/${customer_id}`);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(404).json({ error: `Verification failed: Customer with ID ${customer_id} not found.` });
      }
      return res.status(502).json({ error: `Failed to contact Customer Service: ${err.message}` });
    }

    // 2. Verify expert availability via Expert Service
    console.log(`Verifying expert ID ${expert_id} at ${EXPERT_SERVICE_URL}/v1/experts/${expert_id}`);
    let expertResponse;
    try {
      expertResponse = await axios.get(`${EXPERT_SERVICE_URL}/v1/experts/${expert_id}`);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(404).json({ error: `Verification failed: Expert with ID ${expert_id} not found.` });
      }
      return res.status(502).json({ error: `Failed to contact Expert Service: ${err.message}` });
    }

    const expert = expertResponse.data;
    if (expert.status !== 'available') {
      return res.status(400).json({ error: `Verification failed: Expert is currently ${expert.status}.` });
    }

    // Optional skill verification
    if (!expert.skills.toLowerCase().includes(service_type.toLowerCase())) {
      console.warn(`Warning: Expert does not explicitly list skill: ${service_type}`);
    }

    // Calculate total cost
    const total_cost = duration_hours * expert.hourly_rate;

    // 3. Mark Expert as 'busy' in Expert Service
    try {
      await axios.put(`${EXPERT_SERVICE_URL}/v1/experts/${expert_id}/status`, { status: 'busy' });
    } catch (err) {
      return res.status(502).json({ error: `Failed to update Expert status: ${err.message}` });
    }

    // 4. Create the booking entry
    const query = `INSERT INTO bookings (customer_id, expert_id, service_type, duration_hours, total_cost, status, booking_date) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [customer_id, expert_id, service_type, duration_hours, total_cost, 'assigned', booking_date], function (err) {
      if (err) {
        // Rollback expert status if booking fails
        axios.put(`${EXPERT_SERVICE_URL}/v1/experts/${expert_id}/status`, { status: 'available' }).catch(console.error);
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({
        id: this.lastID,
        customer_id,
        expert_id,
        service_type,
        duration_hours,
        total_cost,
        status: 'assigned',
        booking_date
      });
    });

  } catch (globalErr) {
    res.status(500).json({ error: globalErr.message });
  }
});

// Get all bookings
app.get('/v1/bookings', (req, res) => {
  db.all(`SELECT * FROM bookings`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get booking by ID
app.get('/v1/bookings/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.get(`SELECT * FROM bookings WHERE id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: `Booking with ID ${id} not found.` });
    }
    res.json(row);
  });
});

// Update booking status (e.g. Complete booking -> releases the expert)
app.put('/v1/bookings/:id/status', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  // Get current booking first to check if we are transitioning to 'completed' or 'cancelled'
  db.get(`SELECT * FROM bookings WHERE id = ?`, [id], (err, booking) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!booking) {
      return res.status(404).json({ error: `Booking with ID ${id} not found.` });
    }

    db.run(`UPDATE bookings SET status = ? WHERE id = ?`, [status, id], async function (updateErr) {
      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }

      // If booking is completed or cancelled, make the expert available again
      if (status === 'completed' || status === 'cancelled') {
        try {
          await axios.put(`${EXPERT_SERVICE_URL}/v1/experts/${booking.expert_id}/status`, { status: 'available' });
        } catch (statusErr) {
          console.error(`Failed to release Expert ID ${booking.expert_id} status: ${statusErr.message}`);
        }
      }

      res.json({ message: `Booking status updated to ${status}.`, id, status });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Booking Service running on port ${PORT}`);
});
