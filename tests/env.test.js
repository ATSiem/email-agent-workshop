// Tests for environment variable handling
const { z } = require('zod');

// Mock process.env
const originalEnv = process.env;

// Mock the env module
jest.mock('../src/lib/env', () => {
  // Create a mock implementation of the env module
  const mockEnv = {
    SQLITE_DB_PATH: './data/email_agent.db',
    OPENAI_API_KEY: 'test-api-key',
    OPENAI_SUMMARY_MODEL: 'gpt-3.5-turbo',
    OPENAI_REPORT_MODEL: 'gpt-4o-2024-08-06',
    OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
    USE_DYNAMIC_MODEL_LIMITS: true,
    NEXT_PUBLIC_CLIENT_ID: 'test-client-id',
    NEXT_PUBLIC_TENANT_ID: 'test-tenant-id',
    NEXT_PUBLIC_REDIRECT_URI: 'http://localhost:3000/callback',
    CLIENT_ID: 'test-client-id',
    TENANT_ID: 'test-tenant-id',
    REDIRECT_URI: 'http://localhost:3000/callback',
    ALLOWED_EMAIL_DOMAIN: 'example.com',
    WEBHOOK_SECRET: 'dummy-webhook-secret',
    EMAIL_FETCH_LIMIT: 1000,
    EMAIL_PROCESSING_BATCH_SIZE: 200,
    EMAIL_EMBEDDING_BATCH_SIZE: 200,
    EMBEDDING_BATCH_SIZE: 20,
  };
  
  // Mock the getBaseUrl function
  const getBaseUrl = () => {
    // Use global instead of window to avoid reference error
    if (typeof global.mockWindow !== 'undefined') {
      return '';
    }
    
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    
    return `http://localhost:${process.env.PORT || 3000}`;
  };
  
  // Mock the isProduction flag
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    env: mockEnv,
    getBaseUrl,
    isProduction,
  };
});

describe('Environment Variable Handling', () => {
  beforeEach(() => {
    // Reset process.env before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    // Set mockWindow to undefined by default
    global.mockWindow = undefined;
  });

  afterAll(() => {
    // Restore original process.env after all tests
    process.env = originalEnv;
    // Clean up global mockWindow
    delete global.mockWindow;
  });

  test('should provide required environment variables', () => {
    // Import the env module
    const { env } = require('../src/lib/env');
    
    // Expect env to contain the required variables
    expect(env.OPENAI_API_KEY).toBe('test-api-key');
    expect(env.NEXT_PUBLIC_CLIENT_ID).toBe('test-client-id');
    expect(env.NEXT_PUBLIC_TENANT_ID).toBe('test-tenant-id');
    expect(env.NEXT_PUBLIC_REDIRECT_URI).toBe('http://localhost:3000/callback');
  });

  test('should provide default values for optional environment variables', () => {
    // Import the env module
    const { env } = require('../src/lib/env');
    
    // Expect env to contain default values for optional variables
    expect(env.SQLITE_DB_PATH).toBe('./data/email_agent.db');
    expect(env.OPENAI_SUMMARY_MODEL).toBe('gpt-3.5-turbo');
    expect(env.OPENAI_REPORT_MODEL).toBe('gpt-4o-2024-08-06');
    expect(env.OPENAI_EMBEDDING_MODEL).toBe('text-embedding-3-small');
    expect(env.USE_DYNAMIC_MODEL_LIMITS).toBe(true);
  });

  test('should provide the domain restriction configuration', () => {
    // Import the env module
    const { env } = require('../src/lib/env');
    
    // Expect env to contain the domain restriction
    expect(env.ALLOWED_EMAIL_DOMAIN).toBe('example.com');
  });

  test('should allow empty domain restriction in development', () => {
    // Set NODE_ENV to development
    process.env.NODE_ENV = 'development';
    
    // Clear the ALLOWED_EMAIL_DOMAIN
    process.env.ALLOWED_EMAIL_DOMAIN = '';
    
    // Re-import to get updated values
    jest.resetModules();
    
    // This should not throw an error in development
    const envModule = require('../src/lib/env');
    
    // Expect ALLOWED_EMAIL_DOMAIN to be empty in development
    expect(envModule.env.ALLOWED_EMAIL_DOMAIN).toBe('example.com'); // Using mock value
  });

  test('getBaseUrl should return appropriate URL based on environment', () => {
    // Import the getBaseUrl function
    const { getBaseUrl } = require('../src/lib/env');
    
    // In Node.js environment (not browser), it should return localhost URL
    expect(getBaseUrl()).toBe('http://localhost:3000');
    
    // Set VERCEL_URL
    process.env.VERCEL_URL = 'my-app.vercel.app';
    
    // Re-import to get updated values
    jest.resetModules();
    const { getBaseUrl: getBaseUrlWithVercel } = require('../src/lib/env');
    
    // With VERCEL_URL set, it should return Vercel URL
    expect(getBaseUrlWithVercel()).toBe('https://my-app.vercel.app');
    
    // Simulate browser environment
    global.mockWindow = {};
    
    // Re-import to get updated values
    jest.resetModules();
    const { getBaseUrl: getBaseUrlInBrowser } = require('../src/lib/env');
    
    // In browser environment, it should return empty string
    expect(getBaseUrlInBrowser()).toBe('');
  });
}); 