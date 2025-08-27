/**
 * Lightweight health and metrics HTTP endpoints for operational support
 * Provides /health, /metrics (Prometheus style), and /ready endpoints
 * Non-intrusive Express handler module
 */
import express from 'express';

const app = express();

// Simple in-memory counters for basic metrics
const metrics = {
  requests_total: 0,
  errors_total: 0,
  uptime_seconds: 0,
  start_time: Date.now(),
};

// Middleware to track requests
app.use((req, res, next) => {
  metrics.requests_total++;
  next();
});

// Health endpoint - basic liveness check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - metrics.start_time) / 1000),
  });
});

// Ready endpoint - readiness check
app.get('/ready', (req, res) => {
  // Simple readiness check - could be extended with dependency checks
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {
      server: 'ok',
    },
  });
});

// Metrics endpoint - Prometheus style basic counters
app.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.start_time) / 1000);
  
  const prometheusMetrics = [
    '# HELP http_requests_total Total number of HTTP requests',
    '# TYPE http_requests_total counter',
    `http_requests_total ${metrics.requests_total}`,
    '',
    '# HELP http_errors_total Total number of HTTP errors',
    '# TYPE http_errors_total counter',
    `http_errors_total ${metrics.errors_total}`,
    '',
    '# HELP process_uptime_seconds Process uptime in seconds',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${uptime}`,
    '',
    '# HELP process_start_time_seconds Process start time in unix timestamp',
    '# TYPE process_start_time_seconds gauge',
    `process_start_time_seconds ${Math.floor(metrics.start_time / 1000)}`,
    '',
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(prometheusMetrics);
});

// Error tracking middleware
app.use((error: any, req: any, res: any, next: any) => {
  metrics.errors_total++;
  res.status(500).json({ error: 'internal_error' });
});

// Export the app for use in other services or standalone
export default app;

// Function to increment error counter from external modules
export function incrementErrorCount() {
  metrics.errors_total++;
}

// Function to get current metrics
export function getMetrics() {
  return {
    ...metrics,
    uptime_seconds: Math.floor((Date.now() - metrics.start_time) / 1000),
  };
}

// Standalone server function
export function startMetricsServer(port: number = 3001) {
  const server = app.listen(port, () => {
    console.log(`Metrics server listening on port ${port}`);
    console.log(`Health: http://localhost:${port}/health`);
    console.log(`Ready: http://localhost:${port}/ready`);
    console.log(`Metrics: http://localhost:${port}/metrics`);
  });
  return server;
}

// Start standalone server if run directly
if (require.main === module) {
  const port = Number(process.env.METRICS_PORT || 3001);
  startMetricsServer(port);
}