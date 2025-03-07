// Script to initialize the database through the API endpoint
// This can be used to initialize the database in the Vercel environment

const fetch = require('node-fetch');

// Get the API URL from command line or use default
const apiUrl = process.argv[2] || 'https://client-reports.vercel.app/api/system/init-db';
// Get the secret key from command line or use default
const secretKey = process.argv[3] || 'client-reports-init-key';

async function initializeDatabase() {
  console.log(`Initializing database at ${apiUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Database initialized successfully:', data);
    } else {
      console.error('Failed to initialize database:', data);
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initializeDatabase(); 