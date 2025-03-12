// Database initialization script
try {
  const fs = require('fs');
  const path = require('path');
  const Database = require('better-sqlite3');
  
  // Get database path from environment or use default
  const dbPath = process.env.SQLITE_DB_PATH || process.env.DB_PATH || './data/email_agent.db';
  
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created directory: ${dbDir}`);
  }
  
  console.log(`Initializing database at: ${dbPath}`);
  
  // Create database connection
  const db = new Database(dbPath);
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      "from" TEXT NOT NULL,
      "to" TEXT NOT NULL,
      date TEXT NOT NULL,
      body TEXT NOT NULL,
      attachments TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      summary TEXT NOT NULL,
      labels TEXT NOT NULL,
      cc TEXT DEFAULT '',
      bcc TEXT DEFAULT '',
      embedding TEXT,
      processed_for_vector INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domains TEXT NOT NULL,
      emails TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      user_id TEXT
    );
    
    CREATE TABLE IF NOT EXISTS report_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      format TEXT NOT NULL,
      client_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );
    
    CREATE TABLE IF NOT EXISTS report_feedback (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      client_id TEXT,
      rating INTEGER,
      feedback_text TEXT,
      actions_taken TEXT,
      start_date TEXT,
      end_date TEXT,
      vector_search_used INTEGER,
      search_query TEXT,
      email_count INTEGER,
      copied_to_clipboard INTEGER,
      generation_time_ms INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );
    
    -- Create migrations table if it doesn't exist
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  
  // Always record migrations for columns that are part of the initial schema
  // This ensures that migration records exist even for fresh database creations
  db.prepare(`
    INSERT OR IGNORE INTO migrations (name, applied_at) 
    VALUES ('add_user_id_column', unixepoch())
  `).run();
  
  db.prepare(`
    INSERT OR IGNORE INTO migrations (name, applied_at) 
    VALUES ('add_processed_for_vector_column', unixepoch())
  `).run();
  
  // Check if user_id column exists in clients table
  const clientsTableInfo = db.prepare('PRAGMA table_info(clients)').all();
  const hasUserIdColumn = clientsTableInfo.some(column => column.name === 'user_id');
  
  if (!hasUserIdColumn) {
    console.log('Adding user_id column to clients table');
    db.exec('ALTER TABLE clients ADD COLUMN user_id TEXT;');
  }
  
  // Check if processed_for_vector column exists in messages table
  const messagesTableInfo = db.prepare('PRAGMA table_info(messages)').all();
  const hasProcessedForVectorColumn = messagesTableInfo.some(column => column.name === 'processed_for_vector');
  
  if (!hasProcessedForVectorColumn) {
    console.log('Adding processed_for_vector column to messages table');
    db.exec('ALTER TABLE messages ADD COLUMN processed_for_vector INTEGER DEFAULT 0;');
  }
  
  console.log('Database initialization completed successfully');
  
  // Close the database connection
  db.close();
} catch (error) {
  console.error('Database initialization error:', error.message);
  
  if (error.code === 'MODULE_NOT_FOUND' && error.requireStack && error.requireStack[0].includes('better-sqlite3')) {
    // More concise error message
    console.error('⚠️ better-sqlite3 module not available (expected on Render free tier)');
    
    // Create an empty database file to prevent further errors
    const fs = require('fs');
    const dbPath = process.env.SQLITE_DB_PATH || process.env.DB_PATH || './data/email_agent.db';
    const dbDir = require('path').dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Create an empty file if it doesn't exist
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, '');
      console.log(`Created empty database file at ${dbPath}`);
    }
  }
  
  // Exit with success to allow the application to start
  process.exit(0);
} 