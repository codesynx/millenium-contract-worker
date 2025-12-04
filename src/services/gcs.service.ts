import { Storage } from '@google-cloud/storage';
import { config } from '../config.js';

export class GCSService {
  private storage: Storage;
  private bucket: any;

  constructor() {
    this.storage = new Storage({
      projectId: config.gcs.projectId,
      credentials: {
        client_email: config.gcs.clientEmail,
        private_key: config.gcs.privateKey,
      },
    });

    this.bucket = this.storage.bucket(config.gcs.privateBucketName);
  }

  async uploadPDF(fileName: string, fileBuffer: Buffer): Promise<string> {
    const file = this.bucket.file(fileName);

    await file.save(fileBuffer, {
      metadata: {
        contentType: 'application/pdf',
      },
    });

    console.log(`✓ Uploaded ${fileName} to GCS`);
    return fileName;
  }

  async generateSignedUrl(fileName: string): Promise<string> {
    const [url] = await this.bucket.file(fileName).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    return url;
  }
}
