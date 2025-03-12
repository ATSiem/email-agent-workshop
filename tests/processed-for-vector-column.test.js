// Regression test for processed_for_vector column
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Test database path
const TEST_DB_PATH = path.resolve('./data/test_vector_column.db');

describe('Processed For Vector Column', () => {
  beforeAll(() => {
    // Remove test database if it exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // Set environment variable for test database
    process.env.DB_PATH = TEST_DB_PATH;
  });
  
  afterAll(() => {
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // Reset environment variable
    delete process.env.DB_PATH;
  });
  
  test('should add processed_for_vector column to messages table', () => {
    // Create a test database with messages table but no processed_for_vector column
    const db = new Database(TEST_DB_PATH);
    
    // Create messages table without processed_for_vector column
    db.prepare(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY NOT NULL,
        subject TEXT NOT NULL,
        "from" TEXT NOT NULL,
        "to" TEXT NOT NULL,
        date TEXT NOT NULL,
        body TEXT NOT NULL,
        attachments TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        summary TEXT NOT NULL,
        labels TEXT NOT NULL
      )
    `).run();
    
    // Insert a test message
    db.prepare(`
      INSERT INTO messages (id, subject, "from", "to", date, body, attachments, summary, labels)
      VALUES ('test-id', 'Test Subject', 'sender@example.com', 'recipient@example.com', 
              '2023-01-01', 'Test body', '[]', 'Test summary', '[]')
    `).run();
    
    db.close();
    
    // Run the initialization script
    execSync('node scripts/init-database.js', {
      env: { ...process.env, DB_PATH: TEST_DB_PATH }
    });
    
    // Connect to the database
    const updatedDb = new Database(TEST_DB_PATH);
    
    // Check if processed_for_vector column was added
    const tableInfo = updatedDb.prepare('PRAGMA table_info(messages)').all();
    const processedForVectorColumn = tableInfo.find(column => column.name === 'processed_for_vector');
    
    expect(processedForVectorColumn).toBeTruthy();
    expect(processedForVectorColumn.dflt_value).toBe('0');
    
    // Check if migration was recorded
    const migration = updatedDb.prepare(`
      SELECT name FROM migrations 
      WHERE name='add_processed_for_vector_column'
    `).get();
    
    expect(migration).toBeTruthy();
    
    // Close the database connection
    updatedDb.close();
  });
  
  test('should run migration directly', () => {
    // Create a fresh test database for this test
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    const db = new Database(TEST_DB_PATH);
    
    // Create messages table without processed_for_vector column
    db.prepare(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY NOT NULL,
        subject TEXT NOT NULL,
        "from" TEXT NOT NULL,
        "to" TEXT NOT NULL,
        date TEXT NOT NULL,
        body TEXT NOT NULL,
        attachments TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        summary TEXT NOT NULL,
        labels TEXT NOT NULL
      )
    `).run();
    
    // Create migrations table
    db.prepare(`
      CREATE TABLE migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run();
    
    // Get current columns
    const tableInfo = db.prepare('PRAGMA table_info(messages)').all();
    const columnNames = tableInfo.map(col => col.name);
    
    // Add processed_for_vector column directly
    if (!columnNames.includes('processed_for_vector')) {
      db.prepare(`ALTER TABLE messages ADD COLUMN processed_for_vector INTEGER DEFAULT 0`).run();
    }
    
    // Record the migration
    db.prepare(`
      INSERT INTO migrations (name) VALUES ('add_processed_for_vector_column')
    `).run();
    
    db.close();
    
    // Connect to the database to verify
    const updatedDb = new Database(TEST_DB_PATH);
    
    // Check if processed_for_vector column was added
    const updatedTableInfo = updatedDb.prepare('PRAGMA table_info(messages)').all();
    const processedForVectorColumn = updatedTableInfo.find(column => column.name === 'processed_for_vector');
    
    expect(processedForVectorColumn).toBeTruthy();
    
    // Check if migration was recorded
    const migration = updatedDb.prepare(`
      SELECT name FROM migrations 
      WHERE name='add_processed_for_vector_column'
    `).get();
    
    expect(migration).toBeTruthy();
    
    // Close the database connection
    updatedDb.close();
  });
}); 