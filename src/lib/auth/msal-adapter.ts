import { PublicClientApplication, Configuration, AccountInfo, AuthenticationResult } from '@azure/msal-browser';

// Singleton MSAL instance
let msalInstance: PublicClientApplication | null = null;

// Determine the appropriate redirect URI based on the current hostname
const getRedirectUri = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // For client-reports.onrender.com, use the production redirect URI
    if (hostname === 'client-reports.onrender.com') {
      return 'https://client-reports.onrender.com/api/auth/callback';
    }
    
    // For localhost, use the development redirect URI
    if (hostname === 'localhost') {
      return 'http://localhost:3000/api/auth/callback';
    }
  }
  
  // Default to the environment variable
  return process.env.NEXT_PUBLIC_AZURE_REDIRECT_URI || '';
};

// Base MSAL configuration
const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common'}`,
    // Use the dynamically determined redirect URI
    redirectUri: getRedirectUri(),
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  }
};

// Get or create the MSAL instance (singleton pattern)
export function getMsalInstance(): PublicClientApplication {
  if (typeof window === 'undefined') {
    throw new Error('MSAL can only be used in browser context');
  }
  
  if (!msalInstance) {
    // Create new configuration with current redirect URI
    const currentMsalConfig = {
      ...msalConfig,
      auth: {
        ...msalConfig.auth,
        redirectUri: getRedirectUri(),
      }
    };
    
    console.log('Initializing MSAL with redirect URI:', currentMsalConfig.auth.redirectUri);
    
    msalInstance = new PublicClientApplication(currentMsalConfig);
    // Initialize the instance
    msalInstance.initialize().catch(e => {
      console.error('Failed to initialize MSAL instance:', e);
    });
  }
  return msalInstance;
}

// Login scopes
export const loginScopes = [
  'User.Read',
  'Mail.Read',
  'Mail.ReadBasic',
  'offline_access'
];

// Login function
export async function loginWithMicrosoft(): Promise<void> {
  const instance = getMsalInstance();
  // Ensure instance is initialized before redirect
  await instance.initialize();
  return instance.loginRedirect({
    scopes: loginScopes,
    prompt: 'select_account'
  });
}

// Logout function - local logout only, doesn't sign out from Microsoft
export async function logoutFromMicrosoft(): Promise<void> {
  const instance = getMsalInstance();
  // Ensure instance is initialized before logout
  await instance.initialize();
  
  // Use logoutRedirect with postLogoutRedirectUri set to current page
  // and mainWindowRedirectUri to prevent full Microsoft logout
  return instance.logoutRedirect({
    postLogoutRedirectUri: window.location.origin,
    mainWindowRedirectUri: window.location.origin,
    onRedirectNavigate: () => {
      // Prevent actual redirect to Microsoft - we'll handle it ourselves
      return false;
    }
  });
}

// Get token
export async function getAccessToken(): Promise<string | null> {
  const instance = getMsalInstance();
  // Ensure instance is initialized
  await instance.initialize();
  
  const accounts = await getAllAccounts();
  
  if (accounts.length === 0) {
    return null;
  }

  try {
    const silentRequest = {
      scopes: loginScopes,
      account: accounts[0]
    };
    
    const response = await instance.acquireTokenSilent(silentRequest);
    return response.accessToken;
  } catch (e) {
    console.error('Silent token acquisition failed', e);
    return null;
  }
}

// Handle redirect
export async function handleRedirectResult(): Promise<AuthenticationResult | null> {
  const instance = getMsalInstance();
  // Ensure instance is initialized before handling redirect
  await instance.initialize();
  return instance.handleRedirectPromise();
}

// Get active account
export async function getActiveAccount(): Promise<AccountInfo | null> {
  const instance = getMsalInstance();
  // Ensure instance is initialized
  await instance.initialize();
  return instance.getActiveAccount();
}

// Get all accounts
export async function getAllAccounts(): Promise<AccountInfo[]> {
  const instance = getMsalInstance();
  // Ensure instance is initialized
  await instance.initialize();
  return instance.getAllAccounts();
}

// Set active account
export async function setActiveAccount(account: AccountInfo): Promise<void> {
  const instance = getMsalInstance();
  // Ensure instance is initialized
  await instance.initialize();
  instance.setActiveAccount(account);
}

// Clear MSAL cache
export function clearMsalCache(): void {
  if (typeof window === 'undefined') return;
  
  // Clear sessionStorage items related to MSAL
  Object.keys(sessionStorage)
    .filter(key => key.startsWith('msal.'))
    .forEach(key => {
      sessionStorage.removeItem(key);
    });
}