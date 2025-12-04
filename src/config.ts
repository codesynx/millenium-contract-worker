import dotenv from 'dotenv';

dotenv.config();

export const config = {
  redis: {
    url: process.env.REDIS_URL!,
  },
  gcs: {
    privateBucketName: process.env.GCS_PRIVATE_BUCKET_NAME || 'millenium-private',
    projectId: process.env.GCS_PROJECT_ID!,
    clientEmail: process.env.GCS_CLIENT_EMAIL!,
    privateKey: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10'),
    queueName: 'contract-generation',
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'REDIS_URL',
  'GCS_PROJECT_ID',
  'GCS_CLIENT_EMAIL',
  'GCS_PRIVATE_KEY',
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
