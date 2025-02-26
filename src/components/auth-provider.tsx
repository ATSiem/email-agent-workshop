'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PublicClientApplication, AuthenticationResult, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginScopes, setUserAccessToken, getUserAccessToken } from '~/lib/auth/microsoft';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  login: () => void;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: () => {},
  logout: () => {},
  error: null
});

export const useAuth = () => useContext(AuthContext);

// Store MSAL instance at component level to ensure it's initialized once
// Create a singleton instance of MSAL
let msalInstance: PublicClientApplication | null = null;
if (typeof window !== 'undefined') {
  try {
    msalInstance = new PublicClientApplication(msalConfig);
    console.log('MSAL instance created');
  } catch (err) {
    console.error('Failed to create MSAL instance:', err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [msalInitialized, setMsalInitialized] = useState(false);
  
  // Check if we have a token stored already
  useEffect(() => {
    const token = getUserAccessToken();
    if (token) {
      console.log('Found existing token on load');
      setIsAuthenticated(true);
      // Try to get account info
      if (msalInstance) {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          setUser(accounts[0]);
        }
      }
    }
    setIsLoading(false);
  }, []);

  // Initialize MSAL
  useEffect(() => {
    if (typeof window !== 'undefined' && msalInstance) {
      try {
        // Initialize the MSAL instance
        msalInstance.initialize().then(() => {
          setMsalInitialized(true);
          
          // Check if user is already signed in
          const accounts = msalInstance.getAllAccounts();
          if (accounts.length > 0) {
            handleLoginSuccess(accounts[0]);
          } else {
            setIsLoading(false);
          }
        }).catch(err => {
          console.error('Error initializing MSAL:', err);
          setError('Failed to initialize authentication system.');
          setIsLoading(false);
        });
      } catch (err) {
        console.error('Error setting up MSAL:', err);
        setError('Failed to initialize authentication system.');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  // Handle successful login
  const handleLoginSuccess = async (account: any) => {
    setUser(account);
    setIsAuthenticated(true);
    
    // Get access token silently
    try {
      if (msalInstance) {
        const tokenResponse = await msalInstance.acquireTokenSilent({
          scopes: loginScopes,
          account: account
        });
        
        console.log('Got access token:', tokenResponse.accessToken.substring(0, 10) + '...');
        
        // Set the token for Graph API calls
        setUserAccessToken(tokenResponse.accessToken);
        
        // For debugging
        const expiresOn = new Date(tokenResponse.expiresOn).toLocaleString();
        console.log(`Token expires: ${expiresOn}`);
        console.log(`Scopes: ${tokenResponse.scopes.join(', ')}`);
      }
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        // User needs to login interactively
        login();
      } else {
        console.error('Error acquiring token:', err);
        setError('Error acquiring authentication token.');
      }
    }
  };

  // Login function
  const login = async () => {
    // First check if MSAL is initialized
    if (!msalInstance || !msalInitialized) {
      setError('Authentication system is not ready yet. Please try again in a moment.');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Use loginRedirect instead of popup for better compatibility
      await msalInstance.loginRedirect({
        scopes: loginScopes,
        prompt: 'select_account'
      });
      
      // The page will redirect and come back after auth
      // handleLoginSuccess will be called in the useEffect when the page loads
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  // Logout function - only logout from this app, not global
  const logout = () => {
    try {
      if (msalInstance) {
        // Just clear the account locally instead of a full logout
        msalInstance.clearCache();
        
        // Remove all accounts from the cache
        const accounts = msalInstance.getAllAccounts();
        accounts.forEach(account => {
          msalInstance.removeAccount(account);
        });
        
        // Reset the local state
        setUser(null);
        setIsAuthenticated(false);
        setUserAccessToken(null);
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Add a useEffect to handle redirect callback
  useEffect(() => {
    if (msalInstance && msalInitialized) {
      // Try to handle any redirect response on every page load
      console.log('Checking for auth redirect response...');
      
      msalInstance.handleRedirectPromise()
        .then(response => {
          // Check for auth response
          if (response) {
            console.log('Received auth redirect response:', response);
            handleLoginSuccess(response.account);
          } 
          // If no response but we're on a URL with a code/hash fragment
          else if (window.location.hash && window.location.hash.includes('code=')) {
            console.log('Found auth code in URL hash, trying to process');
            // Try to get accounts directly
            const accounts = msalInstance.getAllAccounts();
            if (accounts.length > 0) {
              console.log('Found account after redirect:', accounts[0]);
              handleLoginSuccess(accounts[0]);
            }
          }
        })
        .catch(err => {
          console.error('Error handling redirect:', err);
          setError('Login failed. Please try again.');
        });
    }
  }, [msalInitialized]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}