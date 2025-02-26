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
    // Clear any stale interaction states before creating a new instance
    try {
      localStorage.removeItem('msal.interaction.status');
      sessionStorage.removeItem('msal.interaction.status');
      
      // Additional cleanup for any session storage tokens
      const storageKeys = Object.keys(sessionStorage);
      storageKeys.forEach(key => {
        if (key.startsWith('msal.') && key.includes('idtoken')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.log('Error clearing cache (non-critical):', e);
    }
    
    // Create MSAL instance with robust configuration
    msalInstance = new PublicClientApplication(msalConfig);
    console.log('MSAL instance created with config:', 
      JSON.stringify({
        clientId: msalConfig.auth.clientId ? `${msalConfig.auth.clientId.substring(0, 5)}...` : 'missing',
        authority: msalConfig.auth.authority,
        redirectUri: msalConfig.auth.redirectUri,
        cacheLocation: msalConfig.cache.cacheLocation,
      })
    );
    
    // Register event handlers for debugging
    msalInstance.addEventCallback((event) => {
      if (event.eventType) {
        console.log('MSAL Event:', event.eventType, event);
      }
    });
    
    // Attempt to handle any existing redirect on page load
    msalInstance.handleRedirectPromise().catch(err => {
      console.warn('Initial redirect handling error (non-critical):', err);
    });
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
    console.log('Handling login success with account:', account);
    setUser(account);
    setIsAuthenticated(true);
    
    // Get access token silently
    try {
      if (msalInstance) {
        // Request interactive login if needed to ensure we have a valid token
        try {
          console.log('Acquiring token silently for scopes:', loginScopes);
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
          
          // Clean URL after successful authentication
          if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (silentError) {
          console.error('Error acquiring token silently:', silentError);
          
          // Use popup as a fallback when silent acquisition fails
          if (silentError instanceof InteractionRequiredAuthError) {
            console.log('Interaction required, trying popup...');
            const tokenResponse = await msalInstance.acquireTokenPopup({
              scopes: loginScopes,
              account: account
            });
            
            console.log('Got access token from popup:', tokenResponse.accessToken.substring(0, 10) + '...');
            setUserAccessToken(tokenResponse.accessToken);
          } else {
            throw silentError; // Re-throw if not an interaction required error
          }
        }
      }
    } catch (err) {
      console.error('Error acquiring token:', err);
      setError('Error acquiring authentication token. Please try refreshing the page.');
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
      
      // Check for interaction in progress by looking at session/local storage
      // This is compatible with older MSAL versions
      const hasInteractionInProgress = sessionStorage.getItem('msal.interaction.status') === 'in_progress' || 
                                      localStorage.getItem('msal.interaction.status') === 'in_progress';
      
      if (hasInteractionInProgress) {
        console.log("Authentication interaction already in progress, clearing and restarting");
        
        // Try to clear the interaction state
        try {
          localStorage.removeItem('msal.interaction.status');
          sessionStorage.removeItem('msal.interaction.status');
          
          // Additional cleanup for any auth-related storage items
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('msal.')) {
              localStorage.removeItem(key);
            }
          }
          
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('msal.')) {
              sessionStorage.removeItem(key);
            }
          }
          
          // Reload the page to clear any in-memory state
          window.location.reload();
          return;
        } catch (e) {
          console.error('Error clearing auth state:', e);
          setError("Authentication already in progress. Please try refreshing the page.");
          setIsLoading(false);
          return;
        }
      }
      
      // Check if there's already an active account
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        // An account is already active, try to get a token silently first
        try {
          const account = accounts[0];
          const tokenResponse = await msalInstance.acquireTokenSilent({
            scopes: loginScopes,
            account: account
          });
          handleLoginSuccess(account);
          return;
        } catch (silentError) {
          console.log('Silent token acquisition failed, falling back to redirect:', silentError);
          // Continue with redirect flow if not an interaction_in_progress error
          if (silentError.message && silentError.message.includes('interaction_in_progress')) {
            setError("Authentication already in progress. Please try again in a moment.");
            setIsLoading(false);
            return;
          }
        }
      }
      
      // Clear any stale login states first
      try {
        // Try to clear browser cache of any pending auth states
        localStorage.removeItem('msal.interaction.status');
        sessionStorage.removeItem('msal.interaction.status');
      } catch (e) {
        console.log('Error clearing cache:', e);
      }
      
      // Check if we have a valid client ID before attempting login
      // Check if MSAL instance is available
      if (!msalInstance) {
        console.error("MSAL instance is null or undefined");
        setError("Authentication system is not available. Please try refreshing the page.");
        setIsLoading(false);
        return;
      }
      
      // Log configuration details for debugging
      const clientId = msalConfig.auth.clientId;
      if (!clientId || clientId === '') {
        console.error("Azure client ID is missing. Check your environment variables.");
        setError("Microsoft authentication is not properly configured. Please check the application settings.");
        setIsLoading(false);
        return;
      }
      
      console.log("Using client ID:", clientId.substring(0, 5) + "...");
      console.log("Redirect URI:", msalConfig.auth.redirectUri);
      console.log("Authority:", msalConfig.auth.authority);
      
      // Use popup login first as it's less prone to interaction_in_progress errors
      try {
        console.log("Starting login popup flow");
        
        // Check for interaction in progress
        const hasInteractionInProgress = sessionStorage.getItem('msal.interaction.status') === 'in_progress' || 
                                        localStorage.getItem('msal.interaction.status') === 'in_progress';
        
        if (hasInteractionInProgress) {
          console.log("Authentication interaction already in progress, clearing state");
          localStorage.removeItem('msal.interaction.status');
          sessionStorage.removeItem('msal.interaction.status');
          
          // Clear any MSAL-related items from storage
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('msal.')) localStorage.removeItem(key);
          });
          
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('msal.')) sessionStorage.removeItem(key);
          });
          
          setError("Authentication already in progress. Please try again.");
          setIsLoading(false);
          return;
        }
        
        // Attempt to use popup login
        const result = await msalInstance.loginPopup({
          scopes: loginScopes,
          prompt: 'select_account'
        });
        
        if (result) {
          console.log("Popup login successful, handling login success");
          handleLoginSuccess(result.account);
        }
      } catch (loginError) {
        console.error('Login error:', loginError);
        
        // If user cancelled popup, don't show an error
        if (loginError.message && loginError.message.includes('user_cancelled')) {
          console.log('User cancelled the login popup');
          setIsLoading(false);
          return;
        }
        
        if (loginError.message && loginError.message.includes('interaction_in_progress')) {
          // If interaction is in progress, clear state
          localStorage.removeItem('msal.interaction.status');
          sessionStorage.removeItem('msal.interaction.status');
          
          // Clean all MSAL-related items from storage
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('msal.')) localStorage.removeItem(key);
          });
          
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('msal.')) sessionStorage.removeItem(key);
          });
          
          setError("Auth session was stuck. Please refresh the page and try signing in again.");
        } else {
          setError('Login failed: ' + loginError.message);
        }
        
        setIsLoading(false);
      }
      
      // The page will redirect and come back after auth
      // handleLoginSuccess will be called in the useEffect when the page loads
    } catch (err) {
      console.error('Login error:', err);
      
      // Special handling for interaction_in_progress errors
      if (err.message && err.message.includes('interaction_in_progress')) {
        // Clear all MSAL storage to fix the issue
        localStorage.removeItem('msal.interaction.status');
        sessionStorage.removeItem('msal.interaction.status');
        
        // Clean all MSAL-related items from storage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('msal.')) localStorage.removeItem(key);
        });
        
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('msal.')) sessionStorage.removeItem(key);
        });
        
        setError("Authentication was stuck. Please refresh the page and try again.");
      } else {
        setError('Login failed. Please try again.');
      }
      
      setIsLoading(false);
    }
  };

  // Logout function - only logout from this app, not global
  const logout = () => {
    try {
      if (msalInstance) {
        // Clean all MSAL-related items from storage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('msal.')) localStorage.removeItem(key);
        });
        
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('msal.')) sessionStorage.removeItem(key);
        });
        
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
        
        // Remove the token from session storage
        sessionStorage.removeItem('msGraphToken');
        
        console.log('Logout completed successfully');
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Add a useEffect to handle redirect callback and check for hard reset flags
  useEffect(() => {
    // Check for special auth reset flags
    if (typeof window !== 'undefined') {
      // Check if we need to clear storage on page load due to previous auth issues
      if (sessionStorage.getItem('auth_hard_reset') === 'true') {
        console.log('Hard reset flag detected, clearing all storage');
        
        // Clear the flag first
        sessionStorage.removeItem('auth_hard_reset');
        
        // Clear all storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Reload the page one more time with clean state
        window.location.reload();
        return;
      }
    }
    
    if (msalInstance && msalInitialized) {
      // Try to handle any redirect response on every page load
      console.log('Checking for auth redirect response...');
      
      // Make sure only one redirect handler runs at a time
      let redirectHandled = false;
      
      // Clear any auth_flow_starting flag if it exists
      if (sessionStorage.getItem('auth_flow_starting') === 'true') {
        console.log('Clearing auth_flow_starting flag');
        sessionStorage.removeItem('auth_flow_starting');
      }
      
      // Check if we're on a URL with a code/hash fragment - this indicates a redirect is being processed
      if (window.location.hash && window.location.hash.includes('code=')) {
        console.log('Found auth code in URL hash, processing authentication response...');
      }
      
      msalInstance.handleRedirectPromise()
        .then(response => {
          if (redirectHandled) return;
          redirectHandled = true;
          
          // Check for auth response
          if (response) {
            console.log('Received auth redirect response:', response);
            handleLoginSuccess(response.account);
            
            // Clean up the URL hash
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } 
          // If no response but we're on a URL with a code/hash fragment
          else if (window.location.hash && window.location.hash.includes('code=')) {
            console.log('Found auth code in URL hash, trying to process manually');
            // Try to get accounts directly
            const accounts = msalInstance.getAllAccounts();
            if (accounts.length > 0) {
              console.log('Found account after redirect:', accounts[0]);
              handleLoginSuccess(accounts[0]);
              
              // Clean up the URL hash
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            } else {
              console.log('No accounts found, requesting token silently...');
              // Try to request the token silently, which might work with the code in the URL
              msalInstance.acquireTokenSilent({ scopes: loginScopes })
                .then(tokenResponse => {
                  console.log('Successfully acquired token silently');
                  handleLoginSuccess(tokenResponse.account);
                  
                  // Clean up the URL hash
                  if (window.history && window.history.replaceState) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }
                })
                .catch(error => {
                  console.log('Failed to acquire token silently:', error);
                });
            }
          }
        })
        .catch(err => {
          console.error('Error handling redirect:', err);
          
          // If we get an interaction_in_progress error during redirect handling,
          // set the hard reset flag
          if (err.message && err.message.includes('interaction_in_progress')) {
            console.log('Setting hard reset flag due to interaction_in_progress during redirect');
            sessionStorage.setItem('auth_hard_reset', 'true');
            
            // Reload the page
            window.location.reload();
            return;
          }
          
          setError('Login failed. Please try again.');
        })
        .finally(() => {
          // Always set loading to false after redirect handling
          setIsLoading(false);
        });
    }
  }, [msalInitialized]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}