// Database initialization script
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Set the database path - use environment variable if provided
const DB_PATH = process.env.DB_PATH || path.resolve('./data/email_agent.db');
const DATA_DIR = path.dirname(DB_PATH);

console.log('Initializing database...');
console.log('Database path:', DB_PATH);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  console.log(`Creating data directory: ${DATA_DIR}`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

try {
  // Create SQLite connection
  const db = new Database(DB_PATH);
  
  // Check if clients table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='clients'
  `).get();
  
  if (!tableExists) {
    console.log('Creating clients table...');
    
    // Create clients table with user_id column
    db.prepare(`
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        user_id TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run();
    
    console.log('Clients table created successfully');
  } else {
    console.log('Clients table already exists');
    
    // Check if user_id column exists
    const tableInfo = db.prepare('PRAGMA table_info(clients)').all();
    const columnExists = tableInfo.some(column => column.name === 'user_id');
    
    if (!columnExists) {
      console.log('Adding user_id column to clients table...');
      db.prepare('ALTER TABLE clients ADD COLUMN user_id TEXT').run();
      console.log('Successfully added user_id column to clients table');
    } else {
      console.log('user_id column already exists in clients table');
    }
  }
  
  // Create migrations table if it doesn't exist
  db.prepare(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();
  
  // Record this migration
  const migrationExists = db.prepare(`
    SELECT name FROM migrations WHERE name = 'add_user_id_column'
  `).get();
  
  if (!migrationExists) {
    db.prepare(`
      INSERT INTO migrations (name, applied_at) 
      VALUES ('add_user_id_column', unixepoch())
    `).run();
    console.log('Migration recorded in migrations table');
  }
  
  // Close the database connection
  db.close();
  
  console.log('Database initialization completed successfully!');
} catch (error) {
  console.error('Database initialization failed:', error);
  process.exit(1);
} 