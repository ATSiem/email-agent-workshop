#!/usr/bin/env node

/**
 * Environment-specific test runner
 * This script runs tests for a specific environment (development, production)
 */

const { spawn } = require('child_process');
const path = require('path');

// Get environment from command line argument
const env = process.argv[2] || 'development';
const validEnvs = ['development', 'production'];

if (!validEnvs.includes(env)) {
  console.error(`Error: Invalid environment "${env}". Valid options are: ${validEnvs.join(', ')}`);
  process.exit(1);
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

console.log(`\n${colors.bright}${colors.blue}=== Running tests for ${env.toUpperCase()} environment ===${colors.reset}\n`);

// Path to Jest binary
const JEST_BIN = path.join(__dirname, '..', 'node_modules', '.bin', 'jest');
const JEST_CONFIG = path.join(__dirname, '..', 'tests', 'jest.config.js');

// Run tests with environment-specific configuration
const jestProcess = spawn(JEST_BIN, ['--config', JEST_CONFIG, '--verbose'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: env,
    TEST_ENV: env,
  }
});

// Handle test completion
jestProcess.on('close', (code) => {
  if (code === 0) {
    console.log(`\n${colors.green}${colors.bright}All ${env} tests completed successfully!${colors.reset}`);
  } else {
    console.error(`\n${colors.red}${colors.bright}${env} tests failed with errors.${colors.reset}`);
  }
  
  process.exit(code);
}); 