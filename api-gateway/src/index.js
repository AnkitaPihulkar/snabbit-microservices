const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8000;

const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:5001';
const EXPERT_SERVICE_URL = process.env.EXPERT_SERVICE_URL || 'http://localhost:5002';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:5003';

// Logger middleware
app.use((req, res, next) => {
  console.log(`[API-GATEWAY] ${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Health check for Gateway
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'api-gateway' });
});

// API Composition Endpoint (GET /api/v1/bookings/:id/detail)
app.get('/api/v1/bookings/:id/detail', async (req, res) => {
  const id = req.params.id;
  console.log(`[API-GATEWAY] Executing API composition for booking ID: ${id}`);
  
  try {
    // 1. Fetch Booking Details
    let booking;
    try {
      const response = await axios.get(`${BOOKING_SERVICE_URL}/v1/bookings/${id}`);
      booking = response.data;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(404).json({ error: `Booking with ID ${id} not found.` });
      }
      return res.status(502).json({ error: `Failed to contact Booking Service: ${err.message}` });
    }

    // 2. Fetch Customer Details in parallel
    const customerPromise = axios.get(`${CUSTOMER_SERVICE_URL}/v1/customers/${booking.customer_id}`)
      .then(res => res.data)
      .catch(err => {
        console.error(`Error fetching customer ID ${booking.customer_id}: ${err.message}`);
        return { error: 'Customer details temporarily unavailable' };
      });

    // 3. Fetch Expert Details in parallel
    const expertPromise = axios.get(`${EXPERT_SERVICE_URL}/v1/experts/${booking.expert_id}`)
      .then(res => res.data)
      .catch(err => {
        console.error(`Error fetching expert ID ${booking.expert_id}: ${err.message}`);
        return { error: 'Expert details temporarily unavailable' };
      });

    const [customer, expert] = await Promise.all([customerPromise, expertPromise]);

    // 4. Compose final payload
    res.json({
      booking_id: booking.id,
      service_type: booking.service_type,
      duration_hours: booking.duration_hours,
      total_cost: booking.total_cost,
      status: booking.status,
      booking_date: booking.booking_date,
      created_at: booking.created_at,
      customer: customer,
      expert: expert
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy routes for Customers
app.use(createProxyMiddleware({
  target: CUSTOMER_SERVICE_URL,
  changeOrigin: true,
  pathFilter: '/api/v1/customers',
  pathRewrite: {
    '^/api/v1/customers': '/v1/customers'
  }
}));

// Proxy routes for Experts
app.use(createProxyMiddleware({
  target: EXPERT_SERVICE_URL,
  changeOrigin: true,
  pathFilter: '/api/v1/experts',
  pathRewrite: {
    '^/api/v1/experts': '/v1/experts'
  }
}));

// Proxy routes for Bookings
app.use(createProxyMiddleware({
  target: BOOKING_SERVICE_URL,
  changeOrigin: true,
  pathFilter: '/api/v1/bookings',
  pathRewrite: {
    '^/api/v1/bookings': '/v1/bookings'
  }
}));

// Fallback route
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found on Gateway. Check URL path and version prefix.' });
});

app.listen(PORT, () => {
  console.log(`API Gateway / BFF layer running on port ${PORT}`);
});
