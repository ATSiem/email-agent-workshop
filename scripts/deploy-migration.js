/**
 * Deployment Migration Script
 * 
 * This script is designed to be run after deployment to Render.
 * It performs the following tasks:
 * 1. Creates a backup of the database
 * 2. Runs the client user ID migration
 * 3. Verifies the migration
 * 4. Logs the results
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const DB_PATH = path.join(process.cwd(), 'data', 'email_agent.db');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups', getDateString());

// Main function
async function main() {
  console.log('Starting deployment migration process...');
  
  try {
    // Create backup directory
    createBackupDir();
    
    // Backup database
    backupDatabase();
    
    // Run migration
    runMigration();
    
    // Verify migration
    verifyMigration();
    
    console.log('✅ Deployment migration completed successfully!');
  } catch (error) {
    console.error('❌ Deployment migration failed:', error.message);
    process.exit(1);
  }
}

// Helper functions
function getDateString() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function createBackupDir() {
  console.log(`Creating backup directory: ${BACKUP_DIR}`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function backupDatabase() {
  console.log('Creating database backup...');
  const backupPath = path.join(BACKUP_DIR, 'email_agent_pre_migration.db');
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`Database backed up to: ${backupPath}`);
}

function runMigration() {
  console.log('Running client user ID migration...');
  try {
    const output = execSync('node scripts/ensure-client-user-ids.js', { encoding: 'utf8' });
    console.log(output);
  } catch (error) {
    console.error('Migration failed:', error.stdout);
    throw new Error('Migration script failed');
  }
}

function verifyMigration() {
  console.log('Verifying migration...');
  try {
    const output = execSync('node scripts/verify-client-updates.js', { encoding: 'utf8' });
    console.log(output);
  } catch (error) {
    console.error('Verification failed:', error.stdout);
    throw new Error('Verification script failed');
  }
}

// Run the script
main().catch(console.error); 