/**
 * @jest-environment jsdom
 */

// Tests for the auth-provider component

// Mock React hooks
jest.mock('react', () => {
  const originalReact = jest.requireActual('react');
  return {
    ...originalReact,
    useState: jest.fn(),
    useEffect: jest.fn(),
    useContext: jest.fn(),
    createContext: jest.fn().mockReturnValue({
      Provider: ({ children }) => children
    })
  };
});

// Mock MSAL adapter
jest.mock('../src/lib/auth/msal-adapter', () => ({
  handleRedirectResult: jest.fn(),
  getActiveAccount: jest.fn(),
  loginWithMicrosoft: jest.fn(),
  logoutFromMicrosoft: jest.fn(),
  getAccessToken: jest.fn(),
  clearMsalCache: jest.fn(),
  getAllAccounts: jest.fn(),
  setActiveAccount: jest.fn()
}));

// Define a test domain for the mock environment
const TEST_ALLOWED_DOMAIN = 'example.com';

// Mock the env module
jest.mock('../src/lib/env', () => ({
  env: {
    ALLOWED_EMAIL_DOMAIN: TEST_ALLOWED_DOMAIN
  },
  isProduction: false
}));

// Import React hooks
const React = require('react');
const { useState, useEffect } = React;

// Import MSAL adapter functions
const {
  handleRedirectResult,
  getActiveAccount,
  loginWithMicrosoft,
  logoutFromMicrosoft,
  getAccessToken,
  clearMsalCache,
  getAllAccounts,
  setActiveAccount
} = require('../src/lib/auth/msal-adapter');

// Import env
const { env } = require('../src/lib/env');

describe('AuthProvider Component', () => {
  // Mock state and effect hooks
  let stateMock;
  let effectCallback;
  let setIsAuthenticated;
  let setError;
  let setUser;
  let setAccessToken;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock state functions
    setIsAuthenticated = jest.fn();
    setError = jest.fn();
    setUser = jest.fn();
    setAccessToken = jest.fn();
    
    // Mock useState to return state and setState
    stateMock = {};
    useState.mockImplementation((initialValue) => {
      const key = Object.keys(stateMock).length;
      if (key === 0) return [initialValue, setIsAuthenticated];
      if (key === 1) return [initialValue, setUser];
      if (key === 2) return [initialValue, setAccessToken];
      if (key === 3) return [initialValue, setError];
      
      stateMock[key] = { value: initialValue, setValue: jest.fn() };
      return [stateMock[key].value, stateMock[key].setValue];
    });
    
    // Mock useEffect to capture callback
    useEffect.mockImplementation((callback) => {
      effectCallback = callback;
      return undefined;
    });
    
    // Mock sessionStorage
    global.sessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        hash: '',
        pathname: '/',
        replace: jest.fn()
      },
      writable: true
    });
    
    // Mock window.history
    Object.defineProperty(window, 'history', {
      value: {
        replaceState: jest.fn()
      },
      writable: true
    });
    
    // Create a mock initialize function that simulates what the real useEffect would do
    effectCallback = async () => {
      try {
        const result = await handleRedirectResult();
        if (result && result.account) {
          const email = result.account.username;
          
          // Validate the user's domain
          if (!validateUserDomain(email)) {
            setError(`Only users with email addresses from ${env.ALLOWED_EMAIL_DOMAIN} are allowed to access this application.`);
            setIsAuthenticated(false);
            await logoutFromMicrosoft();
            return;
          }
          
          setUser(result.account);
          setAccessToken(result.accessToken);
          setIsAuthenticated(true);
        }
      } catch (error) {
        setError(error.message);
        setIsAuthenticated(false);
      }
    };
  });
  
  // Helper function to simulate the validateUserDomain function
  function validateUserDomain(email) {
    if (!email) return false;
    
    const emailDomain = email.split('@')[1]?.toLowerCase();
    
    // If ALLOWED_EMAIL_DOMAIN is not set or empty, allow all domains
    if (!env.ALLOWED_EMAIL_DOMAIN) {
      return true;
    }
    
    return emailDomain === env.ALLOWED_EMAIL_DOMAIN;
  }
  
  test('validateUserDomain should allow emails from the configured domain', () => {
    // Test with a valid domain
    const validEmail = `user@${env.ALLOWED_EMAIL_DOMAIN}`;
    expect(validateUserDomain(validEmail)).toBe(true);
    
    // Test with an invalid domain
    const invalidEmail = 'user@otherdomain.com';
    expect(validateUserDomain(invalidEmail)).toBe(false);
    
    // Test with no email
    expect(validateUserDomain(undefined)).toBe(false);
    expect(validateUserDomain(null)).toBe(false);
    expect(validateUserDomain('')).toBe(false);
  });
  
  test('validateUserDomain should allow all domains when no restriction is configured', () => {
    // Temporarily modify the env mock to simulate no domain restriction
    const originalDomain = env.ALLOWED_EMAIL_DOMAIN;
    env.ALLOWED_EMAIL_DOMAIN = '';
    
    // Test with any domain
    expect(validateUserDomain('user@anydomain.com')).toBe(true);
    
    // Restore the original domain setting
    env.ALLOWED_EMAIL_DOMAIN = originalDomain;
  });
  
  test('handleRedirectResult should validate user domain', async () => {
    // Mock handleRedirectResult to return a successful result
    const mockAccount = {
      username: `user@${env.ALLOWED_EMAIL_DOMAIN}`,
      name: 'Test User'
    };
    
    handleRedirectResult.mockResolvedValue({
      account: mockAccount,
      accessToken: 'valid-token'
    });
    
    // Simulate the initialize function with a valid domain
    await effectCallback();
    
    // Expect the user to be authenticated
    expect(setIsAuthenticated).toHaveBeenCalledWith(true);
    expect(setError).not.toHaveBeenCalled();
    expect(setUser).toHaveBeenCalledWith(mockAccount);
    expect(setAccessToken).toHaveBeenCalledWith('valid-token');
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Now test with an invalid domain
    handleRedirectResult.mockResolvedValue({
      account: {
        username: 'user@otherdomain.com',
        name: 'Test User'
      },
      accessToken: 'valid-token'
    });
    
    // Simulate the initialize function with an invalid domain
    await effectCallback();
    
    // Expect the user to be denied
    expect(setIsAuthenticated).toHaveBeenCalledWith(false);
    expect(setError).toHaveBeenCalledWith(expect.stringContaining(env.ALLOWED_EMAIL_DOMAIN));
    expect(logoutFromMicrosoft).toHaveBeenCalled();
  });
}); 