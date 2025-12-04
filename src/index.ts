import { ContractWorker } from './worker.js';
import { config } from './config.js';
import { mkdir } from 'fs/promises';
import { join } from 'path';

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

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
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
