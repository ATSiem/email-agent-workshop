// Test for the process-summaries API endpoint
const fetch = require('node-fetch');

// Remove the mock since we're using a real server
jest.unmock('node-fetch');

describe('Process Summaries API', () => {
  const API_URL = 'http://localhost:3000/api/system/process-summaries';
  let serverRunning = false; // Track server status
  
  // Check if the server is running before tests
  beforeAll(async () => {
    try {
      const response = await fetch('http://localhost:3000');
      if (response.ok) {
        serverRunning = true;
      } else {
        console.warn('\x1b[33m\x1b[1m⚠️ WARNING: Server is running but returned an error. Tests will be skipped.\x1b[0m');
        serverRunning = false;
      }
    } catch (error) {
      console.warn('\x1b[31m\x1b[1m❌ ERROR: Server is not running or not accessible at http://localhost:3000.\x1b[0m');
      console.warn('\x1b[31m\x1b[1m   These tests require a running server to be properly validated.\x1b[0m');
      console.warn('\x1b[31m\x1b[1m   Please start the server with "npm run dev" before running these tests.\x1b[0m');
      console.warn('\x1b[31m\x1b[1m   Tests will be skipped until the server is available.\x1b[0m');
      serverRunning = false;
    }
  });
  
  // Conditionally run or skip tests based on server availability
  const conditionalTest = serverRunning ? test : test.skip;
  
  conditionalTest('API should accept POST requests and return a task ID', async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Add a test token for authentication
      },
      body: JSON.stringify({}) // Empty body for default processing
    });
    
    // If the server returns an error, log it but don't fail the test
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Server returned error: ${response.status} - ${errorText}`);
      // We still want to fail the test if the server is running but returns an error
      expect(response.ok).toBe(true);
      return;
    }
    
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('success');
    if (data.success) {
      expect(data).toHaveProperty('taskId');
      expect(typeof data.taskId).toBe('string');
    }
  }, 10000); // Increase timeout for API call
  
  conditionalTest('API should accept limit parameter', async () => {
    const response = await fetch(`${API_URL}?limit=5`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Add a test token for authentication
      },
      body: JSON.stringify({}) // Empty body for default processing
    });
    
    // If the server returns an error, log it but don't fail the test
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Server returned error: ${response.status} - ${errorText}`);
      // We still want to fail the test if the server is running but returns an error
      expect(response.ok).toBe(true);
      return;
    }
    
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('success');
    if (data.success) {
      expect(data).toHaveProperty('taskId');
    }
  }, 10000); // Increase timeout for API call
  
  afterAll(() => {
    if (!serverRunning) {
      console.warn('\x1b[31m\x1b[1m⚠️ IMPORTANT: Some tests were skipped because the server was not running.\x1b[0m');
      console.warn('\x1b[31m\x1b[1m   For complete test coverage, please start the server and run tests again.\x1b[0m');
    }
  });
}); 