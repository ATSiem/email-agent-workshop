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
import { env } from '~/lib/env';

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

  // Function to validate user's email domain
  const validateUserDomain = (email: string | undefined): boolean => {
    console.log('Validating email domain for:', email);
    
    if (!email) {
      console.log('No email provided for validation');
      return false;
    }
    
    const emailDomain = email.split('@')[1]?.toLowerCase();
    console.log('Email domain:', emailDomain);
    
    // Check for allowed domains
    if (env.ALLOWED_EMAIL_DOMAINS && env.ALLOWED_EMAIL_DOMAINS.length > 0) {
      console.log('Checking against allowed domains:', env.ALLOWED_EMAIL_DOMAINS);
      const isAllowed = env.ALLOWED_EMAIL_DOMAINS.includes(emailDomain);
      console.log('Domain validation result:', isAllowed ? 'Allowed' : 'Denied');
      return isAllowed;
    }
    
    // If no domains are configured, allow all domains
    console.log('No domain restrictions configured, allowing all domains');
    return true;
  };

  // Function to add user email to request headers
  const addUserEmailToHeaders = (email: string | undefined) => {
    if (typeof window !== 'undefined' && email) {
      console.log('Storing user email in session storage:', email);
      // Store the email in sessionStorage for use in API requests
      sessionStorage.setItem('userEmail', email);
    }
  };

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
          
          // Validate user domain
          const userEmail = result.account?.username;
          console.log('User email from auth result:', userEmail);
          
          if (!validateUserDomain(userEmail)) {
            console.error('User domain not allowed:', userEmail);
            setError(`Access restricted to ${env.ALLOWED_EMAIL_DOMAINS.join(', ')} email addresses`);
            setIsAuthenticated(false);
            sessionStorage.removeItem('msGraphToken');
            await logoutFromMicrosoft();
            setIsLoading(false);
            return;
          }
          
          setUser(result.account);
          setAccessToken(result.accessToken);
          setIsAuthenticated(true);
          
          // Store the token in sessionStorage for Graph API use
          sessionStorage.setItem('msGraphToken', result.accessToken);
          
          // Add user email to headers
          addUserEmailToHeaders(userEmail);
          
          // Clean URL
          if (isRedirectCallback && window.history) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else {
          // Check if we have an active account
          const account = await getActiveAccount();
          console.log('Active account:', account);
          
          // If no active account, but we have accounts, set the first one active
          if (!account) {
            const accounts = await getAllAccounts();
            console.log('All accounts:', accounts);
            
            if (accounts.length > 0) {
              await setActiveAccount(accounts[0]);
              
              // Validate user domain
              const userEmail = accounts[0]?.username;
              console.log('User email from accounts[0]:', userEmail);
              
              if (!validateUserDomain(userEmail)) {
                console.error('User domain not allowed:', userEmail);
                setError(`Access restricted to ${env.ALLOWED_EMAIL_DOMAINS.join(', ')} email addresses`);
                setIsAuthenticated(false);
                sessionStorage.removeItem('msGraphToken');
                await logoutFromMicrosoft();
                setIsLoading(false);
                return;
              }
              
              setUser(accounts[0]);
              
              // Try to get a token silently
              const token = await getAccessToken();
              if (token) {
                setAccessToken(token);
                setIsAuthenticated(true);
                sessionStorage.setItem('msGraphToken', token);
                
                // Add user email to headers
                addUserEmailToHeaders(userEmail);
              } else {
                setIsAuthenticated(false);
                sessionStorage.removeItem('msGraphToken');
              }
            } else {
              setIsAuthenticated(false);
              sessionStorage.removeItem('msGraphToken');
            }
          } else {
            // Validate user domain
            const userEmail = account?.username;
            console.log('User email from active account:', userEmail);
            
            if (!validateUserDomain(userEmail)) {
              console.error('User domain not allowed:', userEmail);
              setError(`Access restricted to ${env.ALLOWED_EMAIL_DOMAINS.join(', ')} email addresses`);
              setIsAuthenticated(false);
              sessionStorage.removeItem('msGraphToken');
              await logoutFromMicrosoft();
              setIsLoading(false);
              return;
            }
            
            setUser(account);
            
            // Try to get a token silently
            const token = await getAccessToken();
            if (token) {
              setAccessToken(token);
              setIsAuthenticated(true);
              sessionStorage.setItem('msGraphToken', token);
              
              // Add user email to headers
              addUserEmailToHeaders(userEmail);
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
      sessionStorage.removeItem('userEmail');
      
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
      sessionStorage.removeItem('userEmail');
      
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
      sessionStorage.removeItem('userEmail');
      clearMsalCache();
      setIsLoading(false);
    }
  };

  // Add user email to request headers for all API requests
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;
      
      window.fetch = async (input, init) => {
        // Only modify API requests to our own backend
        if (typeof input === 'string' && input.startsWith('/api/')) {
          const userEmail = sessionStorage.getItem('userEmail');
          console.log('Adding user email to API request:', userEmail);
          
          // Create new headers object with the user email
          const newInit = { ...init };
          newInit.headers = { ...newInit.headers };
          
          if (userEmail) {
            newInit.headers = {
              ...newInit.headers,
              'X-User-Email': userEmail
            };
          }
          
          return originalFetch(input, newInit);
        }
        
        // Pass through all other requests unchanged
        return originalFetch(input, init);
      };
      
      // Cleanup function to restore original fetch
      return () => {
        window.fetch = originalFetch;
      };
    }
  }, []);

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