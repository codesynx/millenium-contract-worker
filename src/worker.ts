import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from './config.js';
import { ContractJobData, ContractJobResult } from './types.js';
import { TypstService } from './services/typst.service.js';
import { GCSService } from './services/gcs.service.js';
import { DatabaseService } from './services/database.service.js';

export class ContractWorker {
  private worker: Worker;
  private typstService: TypstService;
  private gcsService: GCSService;
  private databaseService: DatabaseService;
  private connection: Redis;

  constructor() {
    this.typstService = new TypstService();
    this.gcsService = new GCSService();
    this.databaseService = new DatabaseService();

    // Create Redis connection for BullMQ
    this.connection = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
    });

    // Create the worker
    this.worker = new Worker(
      config.worker.queueName,
      async (job: Job<ContractJobData>) => {
        return await this.processJob(job);
      },
      {
        connection: this.connection,
        concurrency: config.worker.concurrency,
        removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
        removeOnFail: { count: 5000 }, // Keep last 5000 failed jobs
      }
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`✓ Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`✗ Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    this.worker.on('ready', () => {
      console.log('🚀 Worker is ready and waiting for jobs');
    });
  }

  private async processJob(job: Job<ContractJobData>): Promise<ContractJobResult> {
    const data = job.data;

    console.log(`📄 Processing contract ${data.contractId} (Job ${job.id})`);

    try {
      // Update progress
      await job.updateProgress(10);

      // Step 1: Generate PDF with Typst
      console.log(`  → Generating PDF with Typst...`);
      const pdfBuffer = await this.typstService.generatePDF(data);
      await job.updateProgress(50);

      // Step 2: Upload to GCS
      const fileName = `contracts/contract-${data.contractId}-${Date.now()}.pdf`;
      console.log(`  → Uploading to GCS: ${fileName}...`);
      await this.gcsService.uploadPDF(fileName, pdfBuffer);
      await job.updateProgress(80);

      // Step 3: Update database
      console.log(`  → Updating database...`);
      await this.databaseService.updateContractFile(data.contractId, fileName);
      await job.updateProgress(100);

      // Step 4: Generate signed URL for immediate use
      const fileUrl = await this.gcsService.generateSignedUrl(fileName);

      console.log(`✓ Contract ${data.contractId} generated successfully`);

      return {
        success: true,
        contractId: data.contractId,
        fileUrl,
      };
    } catch (error) {
      console.error(`✗ Failed to process contract ${data.contractId}:`, error);

      // Mark contract as failed in database
      await this.databaseService.markContractAsFailed(
        data.contractId,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        success: false,
        contractId: data.contractId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async close() {
    console.log('Closing worker...');
    await this.worker.close();
    await this.connection.quit();
  }
}
