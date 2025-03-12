// Jest configuration for build environments
const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  // Reduce verbosity for build environments
  verbose: false,
  silent: false,
  reporters: [
    ['default', { summaryThreshold: 1 }]
  ],
  // Only show failing tests
  bail: 0,
  // Reduce test output
  displayName: {
    name: 'BUILD',
    color: 'yellow',
  },
  // Reduce timeout to fail faster
  testTimeout: 15000,
}; 