import { ContractWorker } from './worker.js';
import { config } from './config.js';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import http from 'http';

console.log('🏗️  Millenium Contract Generation Worker');
console.log('=========================================');
console.log(`Queue: ${config.worker.queueName}`);
console.log(`Concurrency: ${config.worker.concurrency}`);
console.log(`GCS Bucket: ${config.gcs.privateBucketName}`);
console.log('=========================================\n');

// Create temp directory for Typst compilation
const tempDir = join(process.cwd(), 'temp');
await mkdir(tempDir, { recursive: true });

// Start the worker
const worker = new ContractWorker();

// Health check server for Digital Ocean
const healthCheckPort = parseInt(process.env.PORT || '8080');
const healthServer = http.createServer(async (req, res) => {
  if (req.url === '/health' || req.url === '/') {
    try {
      const isHealthy = worker.isHealthy();
      const stats = await worker.getStats();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        healthy: isHealthy,
        worker: {
          queue: config.worker.queueName,
          concurrency: config.worker.concurrency,
          ...stats,
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'error',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

healthServer.listen(healthCheckPort, () => {
  console.log(`✓ Health check server listening on port ${healthCheckPort}`);
  console.log(`  Health endpoint: http://localhost:${healthCheckPort}/health\n`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  // Close health check server
  healthServer.close(() => {
    console.log('✓ Health check server closed');
  });

  // Close worker
  await worker.close();

  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Keep the process running
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
