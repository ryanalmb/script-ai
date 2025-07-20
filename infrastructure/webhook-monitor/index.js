const express = require('express');
const axios = require('axios');
const client = require('prom-client');

const app = express();
const port = process.env.PORT || 3004;

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const webhookHealthGauge = new client.Gauge({
  name: 'webhook_health_status',
  help: 'Health status of webhook endpoints',
  labelNames: ['service', 'endpoint'],
  registers: [register]
});

const webhookResponseTime = new client.Histogram({
  name: 'webhook_response_time_seconds',
  help: 'Response time of webhook endpoints',
  labelNames: ['service', 'endpoint'],
  registers: [register]
});

// Health check endpoints
const endpoints = [
  {
    name: 'telegram-bot',
    url: process.env.TELEGRAM_BOT_URL || 'http://telegram-bot:3002',
    path: '/health'
  },
  {
    name: 'backend',
    url: process.env.BACKEND_URL || 'http://backend:3001',
    path: '/health'
  }
];

// Monitor webhook health
async function checkEndpointHealth(endpoint) {
  const start = Date.now();
  try {
    const response = await axios.get(`${endpoint.url}${endpoint.path}`, {
      timeout: 5000
    });
    
    const responseTime = (Date.now() - start) / 1000;
    
    webhookHealthGauge.set(
      { service: endpoint.name, endpoint: endpoint.path },
      response.status === 200 ? 1 : 0
    );
    
    webhookResponseTime.observe(
      { service: endpoint.name, endpoint: endpoint.path },
      responseTime
    );
    
    console.log(`✓ ${endpoint.name} health check passed (${responseTime}s)`);
    return true;
  } catch (error) {
    webhookHealthGauge.set(
      { service: endpoint.name, endpoint: endpoint.path },
      0
    );
    
    console.error(`✗ ${endpoint.name} health check failed:`, error.message);
    return false;
  }
}

// Monitor all endpoints
async function monitorEndpoints() {
  console.log('Running health checks...');
  for (const endpoint of endpoints) {
    await checkEndpointHealth(endpoint);
  }
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/status', async (req, res) => {
  const results = [];
  for (const endpoint of endpoints) {
    const isHealthy = await checkEndpointHealth(endpoint);
    results.push({
      service: endpoint.name,
      url: endpoint.url + endpoint.path,
      healthy: isHealthy,
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    overall: results.every(r => r.healthy),
    services: results
  });
});

// Start monitoring
setInterval(monitorEndpoints, 30000); // Check every 30 seconds

app.listen(port, () => {
  console.log(`Webhook monitor running on port ${port}`);
  monitorEndpoints(); // Initial check
});
