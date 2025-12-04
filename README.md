# Millenium Contract Generation Worker

Typst-based PDF contract generation worker for the Millenium marketplace. This worker processes contract generation jobs from a Redis queue (BullMQ) and generates professional rental contracts using Typst.

## Features

- **Typst-based PDF Generation** - Uses Typst for high-quality, professionally formatted contracts with Cyrillic support
- **Queue System** - BullMQ + Redis for reliable job processing with automatic retries
- **Scalable** - Can handle 100+ concurrent contract generations
- **Google Cloud Storage** - Uploads generated PDFs to private GCS bucket with signed URLs
- **Graceful Degradation** - Backend falls back to synchronous generation if worker is unavailable

## Architecture

```
Backend (API) → Redis Queue (BullMQ) → Worker → Typst Compiler → PDF → GCS → Database
```

1. **Backend** enqueues contract generation jobs when rental applications are approved
2. **Redis Queue** manages job distribution with retry logic
3. **Worker** picks up jobs and processes them (configurable concurrency)
4. **Typst** compiles `.typ` templates into PDFs
5. **GCS** stores PDFs in private bucket
6. **Database** updated with PDF filename reference

## Prerequisites

- **Node.js 20+** or Bun
- **Typst** (installed in Docker image)
- **Redis** (Upstash Redis URL for BullMQ)
- **PostgreSQL** (for updating contract records)
- **Google Cloud Storage** (private bucket for contracts)

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Upstash Redis - Traditional Redis URL (not REST)
REDIS_URL=redis://default:your_password@your-redis-host:6379

# Google Cloud Storage - Private bucket
GCS_PRIVATE_BUCKET_NAME=millenium-private
GCS_PROJECT_ID=your_project_id
GCS_CLIENT_EMAIL=your_service_account_email
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Database (for updating contract records)
DATABASE_URL=postgresql://user:password@host:5432/database

# Worker Configuration
WORKER_CONCURRENCY=10  # Number of jobs to process simultaneously
```

### Important: Redis URL Format

The worker requires a **traditional Redis URL** (not Upstash REST API URL):
- ✅ Correct: `redis://default:password@host:port`
- ❌ Wrong: `https://your-redis.upstash.io` (REST URL)

Get your traditional Redis URL from Upstash dashboard → Database → Redis Connect.

## Development

### Install Dependencies

```bash
bun install
# or
npm install
```

### Run in Development Mode

```bash
bun run dev
# or
npm run dev
```

This uses `tsx watch` for hot reloading during development.

### Type Checking

```bash
bun run typecheck
# or
npm run typecheck
```

## Production Build

```bash
bun run build
# or
npm run build
```

Then start the worker:

```bash
bun start
# or
npm start
```

## Docker Deployment (DigitalOcean)

### Build Docker Image

```bash
docker build -t millenium-worker .
```

### Test Locally

```bash
docker run --env-file .env millenium-worker
```

### Deploy to DigitalOcean

#### Option 1: Docker Hub

```bash
# Tag and push
docker tag millenium-worker your-dockerhub-username/millenium-worker:latest
docker push your-dockerhub-username/millenium-worker:latest
```

Then deploy via DigitalOcean App Platform or Droplet.

#### Option 2: DigitalOcean Container Registry

```bash
# Authenticate
doctl registry login

# Tag and push
docker tag millenium-worker registry.digitalocean.com/your-registry/millenium-worker:latest
docker push registry.digitalocean.com/your-registry/millenium-worker:latest
```

#### Option 3: DigitalOcean App Platform (Recommended)

1. Push code to GitHub/GitLab
2. Create new App in DigitalOcean App Platform
3. Select "Worker" as component type
4. Set build command: `npm run build`
5. Set run command: `npm start`
6. Add environment variables from `.env`
7. Deploy

### Environment Variables in DigitalOcean

Add all variables from `.env.example` in App Settings → Environment Variables.

**Important**: Set `GCS_PRIVATE_KEY` as a secret (encrypted) variable.

## Monitoring

The worker logs all activities to stdout:

- `🚀 Worker is ready and waiting for jobs` - Worker started successfully
- `📄 Processing contract {id}` - Job started
- `✓ Contract {id} generated successfully` - Job completed
- `✗ Job {id} failed` - Job failed (will retry automatically)

### Job States

- **Pending** - Job in queue, waiting to be processed
- **Active** - Job currently being processed
- **Completed** - Job finished successfully
- **Failed** - Job failed after all retries (kept for debugging)

## Queue Configuration

Configured in [src/config.ts](src/config.ts):

- **Concurrency**: `WORKER_CONCURRENCY` (default: 10)
- **Retries**: 3 attempts with exponential backoff (5s, 10s, 20s)
- **Job Retention**: Last 1000 completed, last 5000 failed

## Typst Template

Contract template: [templates/rental-contract.typ](templates/rental-contract.typ)

Template placeholders:
- `{{contractNumber}}` - Contract ID
- `{{city}}`, `{{date}}` - Location and date
- `{{sellerName}}`, `{{sellerPhone}}`, `{{sellerKaspiPhone}}`
- `{{clientName}}`, `{{clientPhone}}`
- `{{productName}}`, `{{quantity}}`, `{{rentalPrice}}`
- `{{startDate}}`, `{{endDate}}`, `{{totalAmount}}`

## Scaling

### Horizontal Scaling

Run multiple worker instances for higher throughput:

```bash
# DigitalOcean App Platform: Set scaling to 2-5 instances
# Or run multiple Docker containers
docker run --env-file .env millenium-worker &
docker run --env-file .env millenium-worker &
```

Each instance will compete for jobs from the same queue.

### Vertical Scaling

Increase `WORKER_CONCURRENCY` for more jobs per instance:

```bash
WORKER_CONCURRENCY=20  # Process 20 jobs simultaneously
```

**Recommendation**: Start with 10, monitor CPU/memory, adjust as needed.

## Troubleshooting

### Worker not picking up jobs

1. Check Redis connection: `REDIS_URL` must be traditional Redis URL
2. Verify queue name matches backend: `contract-generation`
3. Check logs for connection errors

### Typst compilation fails

1. Verify Typst is installed: `typst --version`
2. Check template syntax: `typst compile templates/rental-contract.typ test.pdf`
3. Ensure Cyrillic fonts are available (Liberation Serif in Docker image)

### GCS upload fails

1. Verify service account has write permissions to `GCS_PRIVATE_BUCKET_NAME`
2. Check `GCS_PRIVATE_KEY` format (must include `\n` for line breaks)
3. Ensure bucket exists and is set to private

### Database update fails

1. Verify `DATABASE_URL` is correct and accessible from worker
2. Check `Contract` table has `pdfFileName` column (run migrations)
3. Ensure worker has network access to database

## Backend Integration

The backend automatically enqueues jobs when rental applications are approved:

```typescript
// backend/src/rent/rent.service.ts
await contractQueueService.enqueueContractGeneration({
  contractId: contract.id,
  contractNumber: 'ABC123',
  // ... other contract data
});
```

If the queue is unavailable (no `REDIS_URL` set), backend falls back to synchronous PDF generation.

## File Structure

```
worker/
├── src/
│   ├── index.ts                    # Entry point
│   ├── worker.ts                   # Worker logic
│   ├── config.ts                   # Configuration
│   ├── types.ts                    # TypeScript types
│   └── services/
│       ├── typst.service.ts        # Typst compilation
│       ├── gcs.service.ts          # GCS upload
│       └── database.service.ts     # Database updates
├── templates/
│   └── rental-contract.typ         # Typst contract template
├── temp/                           # Temporary files during compilation
├── Dockerfile                      # Docker configuration
├── package.json
├── tsconfig.json
└── README.md
```

## License

Part of the Millenium marketplace project.

## Support

For issues or questions, contact the Millenium development team.
