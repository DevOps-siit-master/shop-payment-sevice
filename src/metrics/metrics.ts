import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export const httpResponseSizeBytes = new Counter({
  name: 'http_response_size_bytes_total',
  help: 'Total bytes sent in HTTP responses',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const uniqueVisitorsTotal = new Counter({
  name: 'unique_visitors_total',
  help: 'Distinct visitors (client IP + browser) seen in the last 24 hours',
  registers: [registry],
});