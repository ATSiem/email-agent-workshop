import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserAccessToken } from '~/lib/auth/microsoft';
import { env } from '~/lib/env';

// Define the paths that should be protected
const PROTECTED_API_PATHS = [
  '/api/clients',
  '/api/summarize',
  '/api/templates',
  '/api/search',
  '/api/feedback',
  '/api/system',
];

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Middleware function that runs before each request
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  console.log(`Middleware processing path: ${path}`);
  
  // Only check authentication for API routes that need protection
  if (PROTECTED_API_PATHS.some(prefix => path.startsWith(prefix))) {
    console.log('Path requires authentication');
    
    // Check for Authorization header
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // If no token in the header, try to get from server-side session
    if (!accessToken) {
      accessToken = getUserAccessToken();
      console.log('Got access token from server-side session:', !!accessToken);
    } else {
      console.log('Got access token from Authorization header');
    }
    
    // If no token found, user is not authenticated
    if (!accessToken) {
      console.log('No access token found, returning 401');
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }

    // Get user email from the request headers (set by auth-provider)
    const userEmail = request.headers.get('X-User-Email');
    console.log('User email from request headers:', userEmail);
    
    // Check if the user's email domain is allowed
    if (userEmail) {
      const emailDomain = userEmail.split('@')[1]?.toLowerCase();
      console.log('Email domain:', emailDomain, 'Allowed domain:', env.ALLOWED_EMAIL_DOMAIN);
      
      // Skip domain validation in development mode if configured
      if (isDevelopment && !env.ALLOWED_EMAIL_DOMAIN) {
        console.log('Development mode: skipping domain validation');
      } else if (emailDomain !== env.ALLOWED_EMAIL_DOMAIN) {
        console.log('Domain not allowed, returning 403');
        return NextResponse.json(
          {
            error: "Access denied",
            message: `This application is restricted to users with ${env.ALLOWED_EMAIL_DOMAIN} email addresses`
          },
          { status: 403 }
        );
      }
    } else {
      console.log('No user email in request headers');
      // In development, we might want to allow requests without email headers
      if (!isDevelopment) {
        console.log('Production mode: rejecting request without email header');
        return NextResponse.json(
          {
            error: "Access denied",
            message: "User email information is missing"
          },
          { status: 403 }
        );
      }
    }
  }
  
  // Allow the request to continue
  console.log('Request allowed to continue');
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