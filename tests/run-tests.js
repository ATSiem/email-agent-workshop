#!/usr/bin/env node

/**
 * Simple test runner for the email agent tests
 * This script will run all tests in the tests directory
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const TEST_DIR = path.join(__dirname);
const TEST_FILE_PATTERN = /\.test\.js$/;
const JEST_BIN = path.join(__dirname, '..', 'node_modules', '.bin', 'jest');
const JEST_CONFIG = path.join(__dirname, 'jest.config.js');
const SERVER_URL = 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Print header
console.log(`\n${colors.bright}${colors.blue}=== Email Agent Test Runner ===${colors.reset}\n`);

// Check if Jest is installed
if (!fs.existsSync(JEST_BIN)) {
  console.error(`${colors.red}Error: Jest not found. Please install it with:${colors.reset}`);
  console.error(`  npm install --save-dev jest`);
  process.exit(1);
}

// Check if Jest config exists
if (!fs.existsSync(JEST_CONFIG)) {
  console.error(`${colors.red}Error: Jest configuration not found at ${JEST_CONFIG}${colors.reset}`);
  process.exit(1);
}

// Check if server is running
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(SERVER_URL, (res) => {
      resolve(true);
    }).on('error', (err) => {
      resolve(false);
    });
    
    // Set a timeout to avoid hanging
    req.setTimeout(2000, () => {
      req.abort();
      resolve(false);
    });
  });
}

// Get all test files
const testFiles = fs.readdirSync(TEST_DIR)
  .filter(file => TEST_FILE_PATTERN.test(file))
  .map(file => path.join(TEST_DIR, file));

if (testFiles.length === 0) {
  console.error(`${colors.yellow}No test files found in ${TEST_DIR}${colors.reset}`);
  process.exit(0);
}

console.log(`${colors.cyan}Found ${testFiles.length} test files:${colors.reset}`);
testFiles.forEach(file => {
  console.log(`  - ${path.basename(file)}`);
});
console.log('');

// Check server status before running tests
(async () => {
  const serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    console.warn(`${colors.yellow}${colors.bright}⚠️ WARNING: Local server is not running at ${SERVER_URL}${colors.reset}`);
    console.warn(`${colors.yellow}Some tests require a running server and will be skipped.${colors.reset}`);
    console.warn(`${colors.yellow}To run all tests with full coverage, start the server with:${colors.reset}`);
    console.warn(`${colors.bright}  npm run dev${colors.reset}\n`);
    
    // Ask for confirmation to continue
    if (process.stdout.isTTY) {
      console.warn(`${colors.yellow}Press Enter to continue with partial test coverage, or Ctrl+C to cancel${colors.reset}`);
      await new Promise(resolve => process.stdin.once('data', resolve));
    }
  } else {
    console.log(`${colors.green}✓ Local server is running at ${SERVER_URL}${colors.reset}\n`);
  }

  // Run tests with real-time output
  console.log(`${colors.bright}${colors.magenta}Running tests with config: ${JEST_CONFIG}${colors.reset}\n`);
  
  // Use spawn instead of execSync to get real-time output
  const jestProcess = spawn(JEST_BIN, ['--config', JEST_CONFIG, '--verbose'], {
    stdio: 'inherit', // Use inherit to preserve interactive features like progress bar
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SERVER_RUNNING: serverRunning ? 'true' : 'false'
    }
  });
  
  // Handle test completion
  jestProcess.on('close', (code) => {
    if (code === 0) {
      if (!serverRunning) {
        // If server wasn't running, we know process-summaries-api.test.js was skipped
        console.warn(`\n${colors.yellow}${colors.bright}⚠️ PARTIAL COVERAGE: Some tests were skipped because the server was not running.${colors.reset}`);
        console.warn(`${colors.yellow}For complete test coverage, please start the server and run tests again.${colors.reset}\n`);
      } else {
        console.log(`\n${colors.green}${colors.bright}All tests completed successfully with full coverage!${colors.reset}`);
      }
    } else {
      console.error(`\n${colors.red}${colors.bright}Tests failed with errors.${colors.reset}`);
    }
    
    process.exit(code);
  });
})(); 