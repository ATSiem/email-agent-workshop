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
  '/api/admin',
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
    
    // If no token in the Authorization header, check X-MS-TOKEN header
    if (!accessToken) {
      const msTokenHeader = request.headers.get('X-MS-TOKEN');
      if (msTokenHeader) {
        accessToken = msTokenHeader;
        console.log('Got access token from X-MS-TOKEN header');
      }
    } else {
      console.log('Got access token from Authorization header');
    }
    
    // If still no token, try to get from server-side session
    if (!accessToken) {
      accessToken = getUserAccessToken();
      console.log('Got access token from server-side session:', !!accessToken);
    }
    
    // Check cookies as a last resort
    if (!accessToken) {
      const cookies = request.cookies;
      const msGraphToken = cookies.get('msGraphToken');
      if (msGraphToken) {
        accessToken = msGraphToken.value;
        console.log('Got access token from cookies');
      }
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
      } else {
        // Check if the email domain is in the allowed list
        // ALLOWED_EMAIL_DOMAIN can be a comma-separated list of domains
        const allowedDomains = env.ALLOWED_EMAIL_DOMAIN?.split(',').map(d => d.trim().toLowerCase()) || [];
        console.log('Allowed domains:', allowedDomains);
        
        if (!allowedDomains.includes(emailDomain)) {
          console.log('Domain not allowed, returning 403');
          return NextResponse.json(
            {
              error: "Access denied",
              message: `This application is restricted to users with ${allowedDomains.join(' or ')} email addresses`
            },
            { status: 403 }
          );
        }
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