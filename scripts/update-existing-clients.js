// Script to update existing clients with a default user ID
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Configuration
const DB_PATH = path.resolve('./data/email_agent.db');
// Default user ID for existing clients - can be changed as needed
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || 'dev@example.com';

console.log('Running script to update existing clients with default user ID...');
console.log('Database path:', DB_PATH);
console.log('Default user ID:', DEFAULT_USER_ID);

// Check if database file exists
if (!fs.existsSync(DB_PATH)) {
  console.error(`Database file not found at ${DB_PATH}`);
  console.error('Please ensure the database file exists or update the DB_PATH variable.');
  process.exit(1);
}

try {
  // Create SQLite connection
  const db = new Database(DB_PATH);
  
  // Check if clients table exists
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='clients'").get();
    if (!tableExists) {
      console.error('Clients table does not exist in the database');
      db.close();
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking for clients table:', error);
    db.close();
    process.exit(1);
  }
  
  // Check if user_id column exists
  try {
    const tableInfo = db.prepare('PRAGMA table_info(clients)').all();
    const columnExists = tableInfo.some(column => column.name === 'user_id');
    
    if (!columnExists) {
      console.error('user_id column does not exist in clients table');
      console.log('Please run the add-user-id-column.js script first');
      db.close();
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking for user_id column:', error);
    db.close();
    process.exit(1);
  }
  
  // Find clients without a user_id
  const clientsWithoutUserId = db.prepare('SELECT id, name FROM clients WHERE user_id IS NULL').all();
  console.log(`Found ${clientsWithoutUserId.length} clients without a user ID`);
  
  if (clientsWithoutUserId.length > 0) {
    // Begin transaction for better performance and atomicity
    const transaction = db.transaction(() => {
      // Update clients with the default user ID
      const updateStmt = db.prepare('UPDATE clients SET user_id = ? WHERE user_id IS NULL');
      const result = updateStmt.run(DEFAULT_USER_ID);
      
      return result.changes;
    });
    
    // Execute the transaction
    const updatedCount = transaction();
    
    console.log(`Updated ${updatedCount} clients with default user ID: ${DEFAULT_USER_ID}`);
    
    // List the updated clients
    console.log('Updated clients:');
    clientsWithoutUserId.forEach(client => {
      console.log(`- ${client.name} (${client.id})`);
    });
    
    // Verify the update
    const remainingClients = db.prepare('SELECT COUNT(*) as count FROM clients WHERE user_id IS NULL').get();
    if (remainingClients.count > 0) {
      console.warn(`Warning: ${remainingClients.count} clients still have NULL user_id values`);
    } else {
      console.log('All clients now have a user_id value');
    }
  } else {
    console.log('No clients need updating');
  }
  
  // Close the database connection
  db.close();
  
  console.log('Script completed successfully!');
} catch (error) {
  console.error('Script failed:', error);
  process.exit(1);
} 