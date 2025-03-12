// Comprehensive script to ensure all clients have user IDs
const { execSync } = require('child_process');
const path = require('path');

console.log('Starting comprehensive client user ID update process...');

// Allow setting a custom user ID via environment variable
const defaultUserId = process.env.DEFAULT_USER_ID || 'dev@example.com';
console.log(`Using default user ID: ${defaultUserId}`);

try {
  // Step 1: Run the migration to add the user_id column if it doesn't exist
  console.log('\n=== STEP 1: Adding user_id column if needed ===');
  try {
    execSync(`node ${path.join(__dirname, 'add-user-id-column.js')}`, { 
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('Error adding user_id column:', error);
    console.log('Continuing with the process...');
  }
  
  // Step 2: Update existing clients with the default user ID
  console.log('\n=== STEP 2: Updating clients with default user ID ===');
  execSync(`DEFAULT_USER_ID=${defaultUserId} node ${path.join(__dirname, 'update-existing-clients.js')}`, { 
    stdio: 'inherit',
    env: {
      ...process.env,
      DEFAULT_USER_ID: defaultUserId
    }
  });
  
  // Step 3: Verify that all clients have a user_id
  console.log('\n=== STEP 3: Verifying client updates ===');
  execSync(`node ${path.join(__dirname, 'verify-client-updates.js')}`, { 
    stdio: 'inherit'
  });
  
  console.log('\n✅ Client user ID update process completed successfully!');
} catch (error) {
  console.error('\n❌ Client user ID update process failed:', error);
  process.exit(1);
} 