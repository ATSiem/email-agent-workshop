module.exports = {
  // Transform TypeScript files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // Specify test environment
  testEnvironment: 'node',
  
  // Specify file extensions to look for
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Module name mapper for path aliases
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/../src/$1',
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/setup.js'],
  
  // Ignore node_modules
  transformIgnorePatterns: [
    '/node_modules/',
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    '../src/**/*.{js,jsx,ts,tsx}',
    '!../src/**/*.d.ts',
  ],
  
  // Test match patterns
  testMatch: [
    '<rootDir>/**/*.test.{js,jsx,ts,tsx}',
  ],
  
  // Additional settings from package.json
  verbose: true,
  testTimeout: 30000,
  
  // Root directory
  rootDir: '.',
}; 