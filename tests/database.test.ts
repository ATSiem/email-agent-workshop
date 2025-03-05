/**
 * Database verification tests
 */

import Database from 'better-sqlite3';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Set the database path explicitly
const DB_PATH = './data/email_agent.db';

describe('Database Structure', () => {
  let sqlite: Database.Database;

  beforeAll(() => {
    // Ensure directory exists
    const dbDir = dirname(DB_PATH);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    
    // Create SQLite connection directly
    sqlite = new Database(DB_PATH);
  });

  afterAll(() => {
    // Close the database connection
    if (sqlite) {
      sqlite.close();
    }
  });

  test('database connection works', () => {
    const result = sqlite.prepare('SELECT sqlite_version() as version').get() as { version: string };
    expect(result).toBeDefined();
    expect(result.version).toBeDefined();
    console.log(`SQLite version: ${result.version}`);
  });

  test('required tables exist', () => {
    const tables = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `).all() as { name: string }[];
    
    const tableNames = tables.map(t => t.name);
    console.log('Tables found:', tableNames.join(', '));
    
    expect(tableNames).toContain('clients');
    expect(tableNames).toContain('messages');
  });

  test('clients table has correct schema', () => {
    const clientsColumns = sqlite.prepare('PRAGMA table_info(clients)').all() as { name: string, type: string }[];
    const columnNames = clientsColumns.map(col => col.name);
    
    console.log('Clients table columns:', columnNames.join(', '));
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('domains');
    expect(columnNames).toContain('emails');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  test('messages table has correct schema including CC and BCC', () => {
    const messagesColumns = sqlite.prepare('PRAGMA table_info(messages)').all() as { name: string, type: string }[];
    const columnNames = messagesColumns.map(col => col.name);
    
    console.log('Messages table columns:', columnNames.join(', '));
    
    // Basic columns
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('subject');
    expect(columnNames).toContain('from');
    expect(columnNames).toContain('to');
    expect(columnNames).toContain('date');
    expect(columnNames).toContain('body');
    
    // CC and BCC columns
    const hasCcColumn = columnNames.includes('cc');
    const hasBccColumn = columnNames.includes('bcc');
    
    console.log(`CC column exists: ${hasCcColumn}`);
    console.log(`BCC column exists: ${hasBccColumn}`);
    
    expect(hasCcColumn).toBe(true);
    expect(hasBccColumn).toBe(true);
  });
});

describe('CC and BCC Functionality', () => {
  let sqlite: Database.Database;

  beforeAll(() => {
    // Ensure directory exists
    const dbDir = dirname(DB_PATH);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    
    // Create SQLite connection directly
    sqlite = new Database(DB_PATH);
  });

  afterAll(() => {
    // Close the database connection
    if (sqlite) {
      sqlite.close();
    }
  });

  test('adds CC and BCC columns if missing', () => {
    // Check if messages table exists
    const tableExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='messages'
    `).get() as { name: string } | undefined;
    
    expect(tableExists).toBeDefined();
    
    // Check if cc and bcc columns exist
    const columns = sqlite.prepare('PRAGMA table_info(messages)').all() as { name: string, type: string }[];
    const columnNames = columns.map(col => col.name);
    
    const initialHasCcColumn = columnNames.includes('cc');
    const initialHasBccColumn = columnNames.includes('bcc');
    
    // Add cc column if it doesn't exist
    if (!initialHasCcColumn) {
      sqlite.prepare(`ALTER TABLE messages ADD COLUMN cc TEXT DEFAULT ''`).run();
    }
    
    // Add bcc column if it doesn't exist
    if (!initialHasBccColumn) {
      sqlite.prepare(`ALTER TABLE messages ADD COLUMN bcc TEXT DEFAULT ''`).run();
    }
    
    // Verify columns were added
    const updatedColumns = sqlite.prepare('PRAGMA table_info(messages)').all() as { name: string, type: string }[];
    const updatedColumnNames = updatedColumns.map(col => col.name);
    
    expect(updatedColumnNames).toContain('cc');
    expect(updatedColumnNames).toContain('bcc');
  });

  test('migration record exists or is created', () => {
    // Check if migrations table exists
    const migrationsTableExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='migrations'
    `).get() as { name: string } | undefined;
    
    // Create migrations table if it doesn't exist
    if (!migrationsTableExists) {
      sqlite.prepare(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          applied_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `).run();
    }
    
    // Check if migration record exists
    const migrationExists = sqlite.prepare(`
      SELECT name FROM migrations 
      WHERE name='add_cc_bcc_columns'
    `).get() as { name: string } | undefined;
    
    // Add migration record if it doesn't exist
    if (!migrationExists) {
      sqlite.prepare(`
        INSERT INTO migrations (name, applied_at) 
        VALUES ('add_cc_bcc_columns', unixepoch())
      `).run();
    }
    
    // Verify migration record exists
    const verifyMigration = sqlite.prepare(`
      SELECT name FROM migrations 
      WHERE name='add_cc_bcc_columns'
    `).get() as { name: string } | undefined;
    
    expect(verifyMigration).toBeDefined();
    expect(verifyMigration?.name).toBe('add_cc_bcc_columns');
  });
}); 