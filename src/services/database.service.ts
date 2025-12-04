import { config } from '../config.js';

// Simple database service using fetch to call backend API or direct DB connection
// For now, we'll use a simple approach with raw SQL queries via pg

interface Pool {
  query: (text: string, params: any[]) => Promise<any>;
  end: () => Promise<void>;
}

let pool: Pool | null = null;

async function getPool(): Promise<Pool> {
  if (!pool) {
    // Dynamic import of pg
    const pg = await import('pg');
    const { Pool: PgPool } = pg.default;

    pool = new PgPool({
      connectionString: config.database.url,
    });
  }
  return pool;
}

export class DatabaseService {
  async updateContractFile(contractId: string, fileName: string): Promise<void> {
    const pool = await getPool();

    await pool.query(
      'UPDATE "Contract" SET "pdfFileName" = $1, "updatedAt" = NOW() WHERE id = $2',
      [fileName, contractId]
    );

    console.log(`✓ Updated contract ${contractId} with file ${fileName}`);
  }

  async markContractAsFailed(contractId: string, error: string): Promise<void> {
    const pool = await getPool();

    // You might want to add a status field to track failed contracts
    await pool.query(
      'UPDATE "Contract" SET "updatedAt" = NOW() WHERE id = $1',
      [contractId]
    );

    console.error(`✗ Contract ${contractId} generation failed: ${error}`);
  }
}
