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

interface ContractParties {
  contractNumber: string;
  clientTelegramId: string | null;
  sellerTelegramId: string | null;
  toolName: string;
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

  async getContractParties(contractId: string): Promise<ContractParties | null> {
    const pool = await getPool();

    const result = await pool.query(
      `SELECT
        c.id,
        c."toolName",
        c."rentApplicationId",
        client."telegramId" as "clientTelegramId",
        seller."telegramId" as "sellerTelegramId"
      FROM "Contract" c
      JOIN "RentApplication" ra ON ra.id = c."rentApplicationId"
      JOIN "User" client ON client.id = ra."clientId"
      JOIN "User" seller ON seller.id = ra."sellerId"
      WHERE c.id = $1`,
      [contractId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      contractNumber: contractId.substring(0, 8).toUpperCase(),
      clientTelegramId: row.clientTelegramId,
      sellerTelegramId: row.sellerTelegramId,
      toolName: row.toolName,
    };
  }
}
