// Jest setup file

// Add global test utilities
global.fail = (message) => {
  throw new Error(message);
};

// Mock Next.js modules
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((body, init) => ({
      body,
      ...init
    })),
    next: jest.fn().mockImplementation(() => ({
      status: 200
    })),
    redirect: jest.fn().mockImplementation((url) => ({
      url
    }))
  }
}));

// Mock environment variables
process.env = {
  ...process.env,
  NODE_ENV: 'test',
  // Set RENDER=true if we're running on Render (detected by checking for Render-specific env vars)
  RENDER: process.env.RENDER_SERVICE_ID ? 'true' : process.env.RENDER || 'false'
};

// Silence console logs during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

if (process.env.SILENT_LOGS) {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// Restore console after tests
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
}); 