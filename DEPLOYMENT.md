# Deployment Guide - Contract Generation Worker

## 📋 Pre-Deployment Checklist

Before deploying the worker, complete these steps:

### 1. Database Migration

The worker requires a new column in the `Contract` table:

```bash
cd backend
bunx prisma migrate dev --name add_pdf_filename_to_contract
```

This adds the `pdfFileName` field to store the GCS filename reference.

### 2. Get Upstash Redis Traditional URL

You already have Upstash Redis REST API credentials. Now you need the **traditional Redis URL** for BullMQ:

1. Go to [Upstash Console](https://console.upstash.com/)
2. Select your Redis database: `upward-bream-26694`
3. Click **"Connect"** or **"Details"**
4. Look for **"Redis URL"** or **"TLS URL"** (NOT REST API URL)
5. It should look like: `rediss://default:PASSWORD@HOST:PORT`

Copy this URL - you'll need it for both backend and worker.

### 3. Update Backend Environment Variables

Add to `backend/.env`:

```bash
# Redis URL for BullMQ (traditional Redis connection)
REDIS_URL="rediss://default:YOUR_PASSWORD@upward-bream-26694.upstash.io:6379"
```

**Note**: Use `rediss://` (with double 's') for TLS-encrypted connections (recommended for Upstash).

### 4. Install Worker Dependencies

```bash
cd worker
bun install
```

### 5. Create Worker Environment File

Copy and fill out `worker/.env`:

```bash
cp .env.example .env
```

Fill in:
```bash
# Same Redis URL as backend
REDIS_URL="rediss://default:YOUR_PASSWORD@upward-bream-26694.upstash.io:6379"

# Database - same as backend
DATABASE_URL="postgresql://neondb_owner:npg_BnoGWOy15lET@ep-hidden-thunder-a9qr84uq-pooler.gwc.azure.neon.tech/neondb?sslmode=require&channel_binding=require"

# GCS - same credentials as backend
GCS_PRIVATE_BUCKET_NAME=millenium-private
GCS_PROJECT_ID=agile-outlook-463407-t4
GCS_CLIENT_EMAIL=millenium@agile-outlook-463407-t4.iam.gserviceaccount.com
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Worker settings
WORKER_CONCURRENCY=10
```

## 🧪 Local Testing

Test the entire flow locally before deploying:

### 1. Start the Worker

```bash
cd worker
bun run dev
```

You should see:
```
🏗️  Millenium Contract Generation Worker
=========================================
Queue: contract-generation
Concurrency: 10
GCS Bucket: millenium-private
=========================================

🚀 Worker is ready and waiting for jobs
```

### 2. Start the Backend

In a separate terminal:

```bash
cd backend
bun run dev
```

### 3. Test Contract Generation

1. Create a rental application via the API
2. Approve the rental application
3. Watch the worker logs - you should see:
   ```
   📄 Processing contract {id} (Job {jobId})
     → Generating PDF with Typst...
     → Uploading to GCS: contracts/contract-{id}-{timestamp}.pdf...
     → Updating database...
   ✓ Contract {id} generated successfully
   ```

### 4. Verify in Database

```sql
SELECT id, "pdfFileName", "createdAt"
FROM "Contract"
ORDER BY "createdAt" DESC
LIMIT 1;
```

Should show the `pdfFileName` populated.

## 🚀 DigitalOcean Deployment

### Option A: DigitalOcean App Platform (Recommended)

#### Step 1: Push Worker to GitHub

```bash
cd worker
git init
git add .
git commit -m "Initial worker setup"
git remote add origin https://github.com/YOUR_USERNAME/millenium-worker.git
git push -u origin main
```

#### Step 2: Create App in DigitalOcean

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click **"Create App"**
3. Select **"GitHub"** and authorize
4. Choose repository: `millenium-worker`
5. Select branch: `main`

#### Step 3: Configure App

**Component Type**: Worker (not Web Service)

**Build Command**:
```bash
npm run build
```

**Run Command**:
```bash
npm start
```

**Plan**: Basic (1 GB RAM, 1 vCPU) - $12/month

#### Step 4: Add Environment Variables

In App Settings → Environment Variables, add all from `worker/.env`:

| Variable | Value | Type |
|----------|-------|------|
| `REDIS_URL` | `rediss://default:...` | Plain Text |
| `DATABASE_URL` | `postgresql://...` | Encrypted |
| `GCS_PROJECT_ID` | `agile-outlook-463407-t4` | Plain Text |
| `GCS_CLIENT_EMAIL` | `millenium@...` | Plain Text |
| `GCS_PRIVATE_KEY` | `-----BEGIN...` | Encrypted |
| `GCS_PRIVATE_BUCKET_NAME` | `millenium-private` | Plain Text |
| `WORKER_CONCURRENCY` | `10` | Plain Text |

#### Step 5: Deploy

Click **"Create Resources"** and wait for deployment (~5 minutes).

### Option B: DigitalOcean Droplet

For more control or lower cost:

#### 1. Create Droplet

- **Image**: Docker (Marketplace)
- **Size**: Basic - 2 GB RAM ($18/month)
- **Region**: Closest to your database

#### 2. SSH into Droplet

```bash
ssh root@your-droplet-ip
```

#### 3. Install Docker

```bash
apt update
apt install -y docker.io docker-compose
```

#### 4. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/millenium-worker.git
cd millenium-worker
```

#### 5. Create .env File

```bash
nano .env
# Paste your environment variables
# Save: Ctrl+X, Y, Enter
```

#### 6. Build and Run

```bash
docker build -t millenium-worker .
docker run -d --name worker --env-file .env --restart always millenium-worker
```

#### 7. View Logs

```bash
docker logs -f worker
```

## 🔍 Monitoring

### Check Worker Status (App Platform)

Go to App → Runtime Logs to see live worker output.

### Check Worker Status (Droplet)

```bash
docker logs -f worker
```

### Monitor Queue

You can monitor the queue health:

```bash
# Install Redis CLI
npm install -g @upstash/cli

# Connect to Redis
redis-cli -u "rediss://default:PASSWORD@HOST:PORT"

# Check queue length
LLEN bull:contract-generation:wait
```

### Key Metrics to Watch

- **Job Throughput**: Contracts generated per minute
- **Failed Jobs**: Should be < 1% of total jobs
- **Queue Length**: Should stay < 100 during normal operation
- **Worker CPU/Memory**: Should stay below 80%

## 🛠️ Maintenance

### Update Worker Code

**App Platform**:
```bash
git push origin main
# Auto-deploys in ~2 minutes
```

**Droplet**:
```bash
git pull
docker build -t millenium-worker .
docker stop worker
docker rm worker
docker run -d --name worker --env-file .env --restart always millenium-worker
```

### Scale Workers

**App Platform**: App Settings → Change plan or add more workers

**Droplet**: Run multiple containers with different names:
```bash
docker run -d --name worker-1 --env-file .env --restart always millenium-worker
docker run -d --name worker-2 --env-file .env --restart always millenium-worker
```

### Clear Failed Jobs

If too many jobs are failing:

```bash
# Connect to Redis
redis-cli -u "YOUR_REDIS_URL"

# Clear failed jobs
DEL bull:contract-generation:failed
```

## 🐛 Troubleshooting

### Issue: Worker not connecting to Redis

**Check**: Redis URL format
- ✅ Correct: `rediss://default:password@host:6379`
- ❌ Wrong: `https://host.upstash.io` (REST URL)

**Fix**: Get traditional Redis URL from Upstash Console.

### Issue: Typst not found

**Check**: Dockerfile includes Typst installation
```dockerfile
RUN wget https://github.com/typst/typst/releases/download/v0.12.0/...
```

**Fix**: Rebuild Docker image.

### Issue: GCS upload permission denied

**Check**: Service account has `Storage Object Creator` role

**Fix**:
1. Go to [GCP IAM](https://console.cloud.google.com/iam-admin/iam)
2. Find `millenium@agile-outlook-463407-t4.iam.gserviceaccount.com`
3. Add role: **Storage Object Creator**

### Issue: Database connection failed

**Check**: Worker can reach Neon database from DigitalOcean

**Fix**: Neon allows connections from anywhere by default. If blocked:
1. Go to Neon console
2. Settings → IP Allow List
3. Add DigitalOcean IP range or use `0.0.0.0/0` (allow all)

## 📊 Expected Performance

- **Single Worker (10 concurrency)**: ~60 contracts/minute
- **Memory Usage**: ~200-300 MB per worker
- **CPU Usage**: ~30-50% per worker during peak
- **Average Job Time**: ~5-10 seconds per contract

## ✅ Post-Deployment Verification

1. ✅ Worker logs show "Worker is ready"
2. ✅ Create test rental application
3. ✅ Approve application
4. ✅ Worker processes job successfully
5. ✅ Contract PDF appears in GCS bucket
6. ✅ Database `pdfFileName` field populated
7. ✅ Backend can retrieve signed URL

## 🔗 Next Steps

After successful deployment:

1. **Add Telegram notifications** - Send contract PDFs to users via bot
2. **Add webhook** - Notify frontend when contract is ready
3. **Add dashboard** - BullMQ admin UI for queue monitoring
4. **Set up alerts** - Notify team if worker goes down

## 💰 Cost Estimate

- **DigitalOcean App Platform**: $12/month (Basic worker)
- **DigitalOcean Droplet**: $18/month (2 GB RAM)
- **Upstash Redis**: Free tier (sufficient for now)
- **Neon Database**: Existing
- **GCS Storage**: ~$0.02/GB/month (~$0.20/month for 10GB)

**Total**: ~$12-18/month

## Support

If you encounter issues during deployment, check:
1. Worker logs for error messages
2. Redis connection string format
3. GCS service account permissions
4. Database migrations applied
