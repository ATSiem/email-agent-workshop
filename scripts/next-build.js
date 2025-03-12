#!/usr/bin/env node

/**
 * Custom Next.js build script with reduced output
 */

const { spawn } = require('child_process');
const path = require('path');

// Check if running in CI environment
const isCI = process.env.CI === 'true' || process.env.RENDER === 'true';

// Set environment variables to reduce output
process.env.NEXT_TELEMETRY_DISABLED = '1';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

console.log(`${colors.bright}${colors.blue}Starting Next.js build with reduced output...${colors.reset}`);

// Path to next binary
const nextBin = path.join(__dirname, '..', 'node_modules', '.bin', 'next');

// Custom filter for build output
const filterOutput = (data) => {
  const output = data.toString();
  
  // Skip progress messages and info messages
  if (output.includes('info  - ') && !output.includes('error') && !output.includes('warn')) {
    return;
  }
  
  // Skip duplicate warnings
  if (output.includes('warn  -') && 
      (output.includes('You have enabled experimental feature') || 
       output.includes('Fast Refresh had to perform a full reload'))) {
    return;
  }
  
  // Skip repetitive SQLite warnings
  if (output.includes('⚠️ SQLite create_function method not available') ||
      output.includes('⚠️ Vector search (AI search) functionality is disabled') ||
      output.includes('⚠️ To enable this feature, upgrade to Render paid tier') ||
      output.includes('⚠️ Add a persistent disk and set RENDER_DISK_MOUNTED')) {
    // We'll let these through once from our modified database code
    // but filter out duplicates during the build process
    return;
  }
  
  // Skip verbose output
  if (output.includes('Creating an optimized production build') ||
      output.includes('Compiled successfully') ||
      output.includes('Collecting page data') ||
      output.includes('Generating static pages') ||
      output.includes('Finalizing page optimization')) {
    return;
  }
  
  // Always show errors and warnings
  if (output.includes('error') || output.includes('warn')) {
    process.stdout.write(`${output}`);
    return;
  }
  
  // Show important build information
  if (output.includes('Route') || 
      output.includes('Size') || 
      output.includes('First Load') ||
      output.includes('○') || 
      output.includes('λ') ||
      output.includes('●')) {
    process.stdout.write(`${output}`);
    return;
  }
  
  // In non-CI environments, show more output
  if (!isCI) {
    process.stdout.write(`${output}`);
  }
};

// Run Next.js build
const buildProcess = spawn(nextBin, ['build'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

// Handle output
buildProcess.stdout.on('data', filterOutput);
buildProcess.stderr.on('data', (data) => {
  // Always show stderr
  process.stderr.write(data);
});

// Handle process exit
buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`${colors.red}Build failed with code ${code}${colors.reset}`);
    process.exit(code);
  } else {
    console.log(`${colors.green}${colors.bright}Build completed successfully!${colors.reset}`);
    process.exit(0);
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports.__test__ = {
    filterOutput
  };
} 