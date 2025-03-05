#!/usr/bin/env node

/**
 * Simple test runner for the email agent tests
 * This script will run all tests in the tests directory
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_DIR = path.join(__dirname);
const TEST_FILE_PATTERN = /\.test\.js$/;
const JEST_BIN = path.join(__dirname, '..', 'node_modules', '.bin', 'jest');

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

// Run tests
let exitCode = 0;
try {
  console.log(`${colors.bright}${colors.magenta}Running tests...${colors.reset}\n`);
  
  // Run Jest with all test files
  execSync(`${JEST_BIN} --verbose`, { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });
  
  console.log(`\n${colors.green}${colors.bright}All tests completed successfully!${colors.reset}`);
} catch (error) {
  console.error(`\n${colors.red}${colors.bright}Tests failed with errors.${colors.reset}`);
  exitCode = error.status || 1;
}

process.exit(exitCode); 