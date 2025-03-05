import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserAccessToken } from '~/lib/auth/microsoft';

// Define the paths that should be protected
const PROTECTED_API_PATHS = [
  '/api/clients',
  '/api/summarize',
  '/api/templates',
  '/api/search',
  '/api/feedback',
  '/api/system',
];

// Middleware function that runs before each request
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Only check authentication for API routes that need protection
  if (PROTECTED_API_PATHS.some(prefix => path.startsWith(prefix))) {
    // Check for Authorization header
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // If no token in the header, try to get from server-side session
    if (!accessToken) {
      accessToken = getUserAccessToken();
    }
    
    // If no token found, user is not authenticated
    if (!accessToken) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
  }
  
  // Allow the request to continue
  return NextResponse.next();
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    // Match all API routes except auth-related endpoints
    '/api/:path*',
    // Exclude auth-related routes from middleware
    '/((?!api/auth).*)',
  ],
}; 