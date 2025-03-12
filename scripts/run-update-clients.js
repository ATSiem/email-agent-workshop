// Script to run the update-existing-clients.js script
const { execSync } = require('child_process');
const path = require('path');

console.log('Running script to update existing clients with user IDs...');

// Allow setting a custom user ID via environment variable
const defaultUserId = process.env.DEFAULT_USER_ID || 'dev@example.com';
console.log(`Using default user ID: ${defaultUserId}`);

try {
  // Run the update script with the environment variable set
  execSync(`DEFAULT_USER_ID=${defaultUserId} node ${path.join(__dirname, 'update-existing-clients.js')}`, { 
    stdio: 'inherit',
    env: {
      ...process.env,
      DEFAULT_USER_ID: defaultUserId
    }
  });
  
  console.log('Client update completed successfully!');
} catch (error) {
  console.error('Client update failed:', error);
  process.exit(1);
} 