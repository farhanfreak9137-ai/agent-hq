import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { SCHEMA_SQL } from './schema.ts';

let dbInstance: Database.Database | null = null;

export interface DatabaseOptions {
  path?: string;
  inMemory?: boolean;
}

/**
 * Initializes and returns the SQLite database connection.
 * Applies schema and WAL mode automatically.
 */
export function getDatabase(options?: DatabaseOptions): Database.Database {
  if (dbInstance && !options?.inMemory && !options?.path) {
    return dbInstance;
  }

  let dbPath = ':memory:';
  if (!options?.inMemory) {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbPath = options?.path || path.join(dataDir, 'agenthq.db');
  }

  const db = new Database(dbPath);

  // Performance and integrity pragmas
  db.pragma('foreign_keys = ON');
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('synchronous = NORMAL');

  // Execute base schema
  db.exec(SCHEMA_SQL);

  if (!options?.inMemory && !options?.path) {
    dbInstance = db;
  }

  return db;
}

/**
 * Close active database connection.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore if already closed
    }
    dbInstance = null;
  }
}
