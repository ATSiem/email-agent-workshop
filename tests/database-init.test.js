// Database initialization regression test
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Test database path
const TEST_DB_PATH = path.resolve('./data/test_email_agent.db');

// Check if running on Render or if vector extensions are disabled
const isRender = process.env.RENDER === 'true';
const disableVectorTests = process.env.DISABLE_VECTOR_TESTS === 'true' || isRender;

describe('Database Initialization', () => {
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
  
  // Use conditional test function based on environment
  const testFn = disableVectorTests ? test.skip : test;
  
  testFn('should create database with correct schema', () => {
    // Run the initialization script
    execSync('node scripts/init-database.js', {
      env: { ...process.env, DB_PATH: TEST_DB_PATH }
    });
    
    // Verify database was created
    expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    
    // Connect to the database
    const db = new Database(TEST_DB_PATH);
    
    // Check if clients table exists
    const clientsTable = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='clients'
    `).get();
    
    expect(clientsTable).toBeTruthy();
    
    // Check if user_id column exists in clients table
    const tableInfo = db.prepare('PRAGMA table_info(clients)').all();
    const userIdColumn = tableInfo.find(column => column.name === 'user_id');
    
    expect(userIdColumn).toBeTruthy();
    
    // Check if migrations table exists
    const migrationsTable = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='migrations'
    `).get();
    
    expect(migrationsTable).toBeTruthy();
    
    // Check if add_user_id_column migration is recorded
    const migration = db.prepare(`
      SELECT name FROM migrations 
      WHERE name='add_user_id_column'
    `).get();
    
    expect(migration).toBeTruthy();
    
    // Close the database connection
    db.close();
  });
  
  testFn('should handle existing database with missing user_id column', () => {
    // Create a test database with clients table but no user_id column
    const db = new Database(TEST_DB_PATH);
    
    // Drop existing tables
    db.prepare('DROP TABLE IF EXISTS clients').run();
    db.prepare('DROP TABLE IF EXISTS migrations').run();
    
    // Create clients table without user_id column
    db.prepare(`
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run();
    
    db.close();
    
    // Run the initialization script
    execSync('node scripts/init-database.js', {
      env: { ...process.env, DB_PATH: TEST_DB_PATH }
    });
    
    // Connect to the database
    const updatedDb = new Database(TEST_DB_PATH);
    
    // Check if user_id column was added
    const tableInfo = updatedDb.prepare('PRAGMA table_info(clients)').all();
    const userIdColumn = tableInfo.find(column => column.name === 'user_id');
    
    expect(userIdColumn).toBeTruthy();
    
    // Close the database connection
    updatedDb.close();
  });
}); 