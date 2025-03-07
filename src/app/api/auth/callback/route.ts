import { NextResponse } from "next/server";

// This route will be used as the redirect URI for MSAL authentication
// The authentication itself happens on the client side using MSAL
// This route just redirects back to the main page after authentication

export async function GET(request: Request) {
  // Extract the auth code from URL parameters or hash fragment if present
  const url = new URL(request.url);
  
  // Get the host from request headers - this is more reliable in production environments
  const host = request.headers.get('host') || '';
  console.log('Raw host header:', host);
  
  // Determine the correct redirect URL based on the host header
  let redirectTo = url.origin;
  
  // Check if we're in production environment
  if (host.includes('client-reports.onrender.com')) {
    console.log('Production environment detected via host header');
    redirectTo = 'https://client-reports.onrender.com';
  } else if (host.includes('localhost')) {
    console.log('Local development environment detected via host header');
    // For local development, always use port 3000
    redirectTo = 'http://localhost:3000';
  } else {
    // Fallback to URL detection as a second method
    if (url.hostname === 'client-reports.onrender.com') {
      console.log('Production environment detected via URL hostname');
      redirectTo = 'https://client-reports.onrender.com';
    } else if (url.hostname === 'localhost') {
      console.log('Local development environment detected via URL hostname');
      redirectTo = 'http://localhost:3000';
    }
  }
  
  console.log('Callback detected, redirecting to:', redirectTo);
  
  // Get authorization code and state from URL parameters
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  console.log('Auth callback received:', { hasCode: !!code, hasState: !!state });
  
  // Debug information to help troubleshoot environment detection
  console.log('Request URL:', request.url);
  console.log('Headers:', {
    host: request.headers.get('host'),
    referer: request.headers.get('referer'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
    'x-forwarded-proto': request.headers.get('x-forwarded-proto')
  });
  
  // Create a URL with the auth code and state to be processed by MSAL in the frontend
  // This approach passes the authentication parameters to the client-side MSAL
  const clientUrl = new URL(redirectTo);
  
  // Add the auth parameters to the hash (MSAL expects them in the hash)
  let hashParams = [];
  if (code) hashParams.push(`code=${encodeURIComponent(code)}`);
  if (state) hashParams.push(`state=${encodeURIComponent(state)}`);
  
  if (hashParams.length > 0) {
    clientUrl.hash = hashParams.join('&');
  }
  
  // One final safety check - if we're on Render but the URL doesn't include it, fix it
  if (process.env.RENDER === 'true' && !clientUrl.toString().includes('client-reports.onrender.com')) {
    console.log('CRITICAL: Environment indicates Render but URL does not match! Forcing production URL');
    const fixedUrl = new URL('https://client-reports.onrender.com');
    // Copy hash parameters
    fixedUrl.hash = clientUrl.hash;
    clientUrl = fixedUrl;
  }
  
  console.log('Redirecting to:', clientUrl.toString());
  
  // Redirect to the main page with auth parameters in the URL hash
  return NextResponse.redirect(clientUrl.toString());
}