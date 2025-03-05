const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Set the database path explicitly
const DB_PATH = path.resolve('./data/email_agent.db');

describe('Database Connection Tests', () => {
  let sqlite;
  
  beforeAll(() => {
    console.log('Testing database connection...');
    console.log('Database path:', DB_PATH);
    console.log('Database file exists:', fs.existsSync(DB_PATH));
  });
  
  afterAll(() => {
    if (sqlite) {
      sqlite.close();
      console.log('Database connection closed');
    }
  });
  
  test('database file exists', () => {
    expect(fs.existsSync(DB_PATH)).toBe(true);
  });
  
  test('can connect to database', () => {
    sqlite = new Database(DB_PATH);
    expect(sqlite).toBeDefined();
    console.log('Database connection created successfully');
  });
  
  test('database has required tables', () => {
    const tables = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
    const tableNames = tables.map(t => t.name);
    console.log('Tables in database:', tableNames);
    
    expect(tableNames).toContain('clients');
    expect(tableNames).toContain('messages');
  });
  
  test('can query clients table', () => {
    const clients = sqlite.prepare('SELECT * FROM clients').all();
    console.log('Clients table has', clients.length, 'records');
    
    if (clients.length > 0) {
      console.log('First client:', clients[0]);
    }
    
    expect(clients).toBeDefined();
  });
}); 