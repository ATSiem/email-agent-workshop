// Script to verify that all clients have a user_id value
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Configuration
const DB_PATH = path.resolve('./data/email_agent.db');

console.log('Running script to verify client user IDs...');
console.log('Database path:', DB_PATH);

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
  
  // Count total clients
  const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get();
  console.log(`Total clients in database: ${totalClients.count}`);
  
  // Count clients with user_id
  const clientsWithUserId = db.prepare('SELECT COUNT(*) as count FROM clients WHERE user_id IS NOT NULL').get();
  console.log(`Clients with user_id: ${clientsWithUserId.count}`);
  
  // Count clients without user_id
  const clientsWithoutUserId = db.prepare('SELECT COUNT(*) as count FROM clients WHERE user_id IS NULL').get();
  console.log(`Clients without user_id: ${clientsWithoutUserId.count}`);
  
  // Get distribution of user_ids
  const userIdDistribution = db.prepare('SELECT user_id, COUNT(*) as count FROM clients WHERE user_id IS NOT NULL GROUP BY user_id ORDER BY count DESC').all();
  
  if (userIdDistribution.length > 0) {
    console.log('\nUser ID distribution:');
    userIdDistribution.forEach(row => {
      console.log(`- ${row.user_id}: ${row.count} clients`);
    });
  }
  
  // Check if all clients have a user_id
  if (clientsWithoutUserId.count === 0) {
    console.log('\n✅ All clients have a user_id value');
  } else {
    console.warn(`\n⚠️ Warning: ${clientsWithoutUserId.count} clients still have NULL user_id values`);
    
    // List clients without user_id
    const clientsWithoutUserIdDetails = db.prepare('SELECT id, name FROM clients WHERE user_id IS NULL').all();
    console.log('\nClients without user_id:');
    clientsWithoutUserIdDetails.forEach(client => {
      console.log(`- ${client.name} (${client.id})`);
    });
  }
  
  // Close the database connection
  db.close();
  
  console.log('\nVerification completed successfully!');
} catch (error) {
  console.error('Verification failed:', error);
  process.exit(1);
} 