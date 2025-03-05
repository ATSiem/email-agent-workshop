import { NextResponse } from "next/server";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";
import { verifyGraphApiPermissions } from "~/lib/auth/graph-permissions";

export async function GET(request: Request) {
  try {
    console.log('Graph Permissions API - Request received');
    
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    console.log('Graph Permissions API - Auth header present:', !!authHeader);
    
    if (!accessToken) {
      console.log('Graph Permissions API - No auth header, trying getUserAccessToken()');
      accessToken = getUserAccessToken();
      console.log('Graph Permissions API - Token from getUserAccessToken:', accessToken ? 'present' : 'missing');
    }
    
    if (!accessToken) {
      console.log('Graph Permissions API - No token found, returning 401');
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Set the token for Graph API calls
    console.log('Graph Permissions API - Setting user access token');
    setUserAccessToken(accessToken);
    
    // Verify Graph API permissions
    console.log('Graph Permissions API - Verifying permissions');
    const permissionsResult = await verifyGraphApiPermissions();
    
    console.log('Graph Permissions API - Permission verification completed:', 
      permissionsResult.success ? 'Success' : 'Failed');
    
    if (!permissionsResult.success) {
      return NextResponse.json({
        success: false,
        message: permissionsResult.message || 'Failed to verify Graph API permissions'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      permissions: permissionsResult
    });
    
  } catch (error) {
    console.error('Graph Permissions API - Error:', error);
    
    return NextResponse.json(
      { 
        error: "Failed to verify Graph API permissions",
        message: error.message || String(error)
      },
      { status: 500 }
    );
  }
} 