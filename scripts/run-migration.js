// Simple script to run the migration
const { execSync } = require('child_process');

console.log('Running migration to add user_id to clients table...');

try {
  // Use ts-node to run the TypeScript migration file
  execSync('npx ts-node src/lib/db/migrations/add_user_id_to_clients.ts', { 
    stdio: 'inherit' 
  });
  
  console.log('Migration completed successfully!');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} 