import { NextResponse } from "next/server";

// This route will be used as the redirect URI for MSAL authentication
// The authentication itself happens on the client side using MSAL
// This route just redirects back to the main page after authentication

export async function GET(request: Request) {
  // Extract the auth code from URL parameters
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  console.log('Auth callback received:', { hasCode: !!code, hasState: !!state });
  
  // Get host information
  const host = request.headers.get('host') || '';
  const forwardedHost = request.headers.get('x-forwarded-host') || '';
  
  console.log('Host header:', host);
  console.log('X-Forwarded-Host:', forwardedHost);
  
  // Simple redirect URL determination - don't rely on request.url at all
  // since it can show localhost:10000 in Render even though we're in production
  const isProduction = host.includes('client-reports.onrender.com') || 
                       forwardedHost.includes('client-reports.onrender.com') || 
                       process.env.RENDER === 'true';
  
  // Create the redirect URL
  const redirectUrl = new URL(
    isProduction
      ? 'https://client-reports.onrender.com'
      : 'http://localhost:3000'
  );
  
  console.log(`Environment detected: ${isProduction ? 'Production' : 'Development'}`);
  
  // Add the auth parameters to the hash (MSAL expects them in the hash)
  if (code || state) {
    const hashParams = [];
    if (code) hashParams.push(`code=${encodeURIComponent(code)}`);
    if (state) hashParams.push(`state=${encodeURIComponent(state)}`);
    redirectUrl.hash = hashParams.join('&');
  }
  
  console.log('Redirecting to:', redirectUrl.toString());
  
  // Redirect to the main page with auth parameters in the URL hash
  return NextResponse.redirect(redirectUrl.toString());
}