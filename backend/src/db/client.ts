import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { config } from '../config/env.js';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
  isPGlite: boolean;
}

let activeClient: DbClient | null = null;

export async function getDbClient(): Promise<DbClient> {
  if (activeClient) {
    return activeClient;
  }

  if (config.databaseUrl) {
    console.log('[DB] Connecting to PostgreSQL via DATABASE_URL...');
    try {
      const pool = new Pool({ connectionString: config.databaseUrl });
      // Test connection
      await pool.query('SELECT 1');
      console.log('[DB] Connected to PostgreSQL successfully.');

      activeClient = {
        isPGlite: false,
        async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
          const res = await pool.query(text, params);
          return {
            rows: res.rows as T[],
            rowCount: res.rowCount ?? res.rows.length,
          };
        },
        async close() {
          await pool.end();
        },
      };
      return activeClient;
    } catch (err) {
      console.warn('[DB] Failed to connect to DATABASE_URL, falling back to embedded PGlite:', (err as Error).message);
    }
  }

  // Fallback to embedded PGlite (True Postgres 16 engine in Node.js)
  const pgDataDir = path.join(config.dataPath, 'postgres');
  if (!fs.existsSync(pgDataDir)) {
    fs.mkdirSync(pgDataDir, { recursive: true });
  }

  console.log(`[DB] Initializing embedded PostgreSQL (PGlite) at ${pgDataDir}...`);
  const pglite = new PGlite(pgDataDir);
  await pglite.waitReady;
  console.log('[DB] Embedded PostgreSQL ready.');

  activeClient = {
    isPGlite: true,
    async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
      const res = await pglite.query(text, params);
      return {
        rows: (res.rows || []) as T[],
        rowCount: res.affectedRows ?? (res.rows ? res.rows.length : 0),
      };
    },
    async close() {
      await pglite.close();
    },
  };

  return activeClient;
}

export async function initDb(): Promise<void> {
  const db = await getDbClient();
  const schemaPath = path.join(__dirname, 'schema.sql');
  let schemaSql = fs.readFileSync(schemaPath, 'utf8');

  if (db.isPGlite) {
    // PGlite has built-in gen_random_uuid(), pgcrypto extension statement can be skipped or tolerated
    schemaSql = schemaSql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, '-- extension skipped in pglite');
  }

  // Remove comments and split statements for safe execution
  const cleanSql = schemaSql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    try {
      await db.query(stmt);
    } catch (err: any) {
      // Ignore if index or table already exists
      if (!err.message?.includes('already exists')) {
        console.warn('[DB Schema Warning]:', err.message);
      }
    }
  }
  console.log('[DB] Schema initialized successfully.');
}
