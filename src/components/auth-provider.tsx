'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AccountInfo } from '@azure/msal-browser';
import { 
  handleRedirectResult, 
  getActiveAccount, 
  loginWithMicrosoft, 
  logoutFromMicrosoft, 
  getAccessToken,
  clearMsalCache,
  getAllAccounts,
  setActiveAccount
} from '~/lib/auth/msal-adapter';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AccountInfo | null;
  login: () => void;
  logout: () => void;
  error: string | null;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: () => {},
  logout: () => {},
  error: null,
  accessToken: null
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Initialize authentication
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Check for the hash in the URL which indicates a redirect from Microsoft
        const isRedirectCallback = window.location.hash && 
          (window.location.hash.includes('id_token=') || 
           window.location.hash.includes('access_token=') || 
           window.location.hash.includes('code='));
        
        console.log('Initializing auth with hash present:', isRedirectCallback);
        
        // Add a safety check to prevent endless loops
        const lastAuthAttempt = sessionStorage.getItem('lastAuthAttempt');
        const now = Date.now();
        const FIVE_SECONDS = 5000;
        
        if (isRedirectCallback && lastAuthAttempt && (now - parseInt(lastAuthAttempt)) < FIVE_SECONDS) {
          console.warn('Detected potential auth loop - skipping auth attempt');
          setIsLoading(false);
          return;
        }
        
        // Record this attempt to detect loops
        if (isRedirectCallback) {
          sessionStorage.setItem('lastAuthAttempt', now.toString());
        }
        
        // Handle redirect result (if we're returning from auth)
        const result = await handleRedirectResult();
        
        if (result) {
          // Successfully logged in via redirect
          console.log('Successfully authenticated from redirect');
          setUser(result.account);
          setAccessToken(result.accessToken);
          setIsAuthenticated(true);
          
          // Store the token in sessionStorage for Graph API use
          sessionStorage.setItem('msGraphToken', result.accessToken);
          
          // Clean URL
          if (isRedirectCallback && window.history) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else {
          // Check if we have an active account
          const account = await getActiveAccount();
          
          // If no active account, but we have accounts, set the first one active
          if (!account) {
            const accounts = await getAllAccounts();
            if (accounts.length > 0) {
              await setActiveAccount(accounts[0]);
              setUser(accounts[0]);
              
              // Try to get a token silently
              const token = await getAccessToken();
              if (token) {
                setAccessToken(token);
                setIsAuthenticated(true);
                sessionStorage.setItem('msGraphToken', token);
              } else {
                setIsAuthenticated(false);
                sessionStorage.removeItem('msGraphToken');
              }
            } else {
              setIsAuthenticated(false);
              sessionStorage.removeItem('msGraphToken');
            }
          } else {
            setUser(account);
            
            // Try to get a token silently
            const token = await getAccessToken();
            if (token) {
              setAccessToken(token);
              setIsAuthenticated(true);
              sessionStorage.setItem('msGraphToken', token);
            } else {
              setIsAuthenticated(false);
              sessionStorage.removeItem('msGraphToken');
            }
          }
          
          // Clean URL if it has authorization code
          if (isRedirectCallback && window.history) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (e) {
        console.error('Auth initialization error:', e);
        setError('Authentication failed. Please try again.');
        setIsAuthenticated(false);
        sessionStorage.removeItem('msGraphToken');
        
        // Clean URL even on error
        if (window.location.hash && window.history) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, []);

  // Login function
  const login = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Clear any previous state
      clearMsalCache();
      sessionStorage.removeItem('msGraphToken');
      
      // Redirect to Microsoft login
      await loginWithMicrosoft();
      // The page will redirect, so no need to update state here
    } catch (e) {
      console.error('Login error:', e);
      setError('Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  // Logout function - performs local logout only, not global Microsoft logout
  const logout = async () => {
    setIsLoading(true);
    
    try {
      // Call MSAL logout first (with onRedirectNavigate preventing global logout)
      await logoutFromMicrosoft();
      
      // Then clear all local state
      setIsAuthenticated(false);
      setUser(null);
      setAccessToken(null);
      sessionStorage.removeItem('msGraphToken');
      
      // Clear MSAL cache
      clearMsalCache();
      
      // Finally reset loading state
      setIsLoading(false);
    } catch (e) {
      console.error('Logout error:', e);
      setError('Logout failed. Please try again.');
      
      // Force cleanup on error
      setIsAuthenticated(false);
      setUser(null);
      setAccessToken(null);
      sessionStorage.removeItem('msGraphToken');
      clearMsalCache();
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading, 
      user, 
      login, 
      logout, 
      error,
      accessToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}