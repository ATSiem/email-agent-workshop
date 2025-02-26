import { NextResponse } from "next/server";

// This route will be used as the redirect URI for MSAL authentication
// The authentication itself happens on the client side using MSAL
// This route just redirects back to the main page after authentication

export async function GET(request: Request) {
  // Extract the auth code from URL parameters or hash fragment if present
  const url = new URL(request.url);
  const redirectTo = url.origin;
  
  // If there's a hash fragment (common with MSAL), we need to forward it to the client
  // for proper MSAL processing
  const hash = url.hash || request.headers.get('x-hash-fragment');
  
  console.log('Auth callback - redirect to:', redirectTo);
  console.log('Auth callback - hash fragment present:', !!hash);
  
  // Redirect back to the home page with any hash fragment
  // This ensures MSAL can properly process the authentication response
  return NextResponse.redirect(`${redirectTo}/${hash || ''}`);
}