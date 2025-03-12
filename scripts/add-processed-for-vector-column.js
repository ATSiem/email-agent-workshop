// Direct SQLite migration script to add processed_for_vector column to messages table
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Set the database path
const DB_PATH = process.env.DB_PATH || path.resolve('./data/email_agent.db');

console.log('Running migration to add processed_for_vector column to messages table...');
console.log('Database path:', DB_PATH);

// Check if database file exists
if (!fs.existsSync(DB_PATH)) {
  console.error(`Database file not found at ${DB_PATH}`);
  process.exit(1);
}

try {
  // Create SQLite connection
  const db = new Database(DB_PATH);
  
  // Check if the column already exists
  const tableInfo = db.prepare('PRAGMA table_info(messages)').all();
  const columnExists = tableInfo.some(column => column.name === 'processed_for_vector');
  
  if (!columnExists) {
    // Add the processed_for_vector column with default value 0
    db.prepare('ALTER TABLE messages ADD COLUMN processed_for_vector INTEGER DEFAULT 0').run();
    console.log('Successfully added processed_for_vector column to messages table');
    
    // Create migrations table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run();
    
    // Record this migration
    db.prepare(`
      INSERT INTO migrations (name, applied_at) 
      VALUES ('add_processed_for_vector_column', unixepoch())
    `).run();
    
    console.log('Migration recorded in migrations table');
  } else {
    console.log('processed_for_vector column already exists in messages table');
  }
  
  // Close the database connection
  db.close();
  
  console.log('Migration completed successfully!');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} 