import { NextResponse } from "next/server";
import { syncEmails } from "~/lib/services/email";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";

export async function GET(request: Request) {
  try {
    // Get token from the Authorization header first
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // If no token in header, try the module-level token (getUserAccessToken)
    if (!accessToken) {
      accessToken = getUserAccessToken();
    }
    
    console.log('Sync API - Token available:', !!accessToken);
    
    if (!accessToken) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access your emails"
        },
        { status: 401 }
      );
    }
    
    // Set the token for use in subsequent function calls
    setUserAccessToken(accessToken);

    // Get count parameter from URL if provided
    const url = new URL(request.url);
    const count = url.searchParams.get("count") 
      ? parseInt(url.searchParams.get("count")!, 10) 
      : 5; // Reduced to 5 for better reliability
    
    try {
      // Trying with error handling wrapper
      try {
        // Sync emails
        console.log(`Attempting to sync ${count} emails...`);
        const processedCount = await syncEmails(count);
        console.log(`Successfully synced ${processedCount} emails`);
        
        return NextResponse.json({ 
          success: true, 
          message: `Successfully synced ${processedCount} emails`,
        });
      } catch (innerError) {
        throw innerError; // Re-throw to be caught by the outer catch
      }
    } catch (syncError) {
      console.error("Sync process error:", syncError);
      
      // Create a more detailed error object
      const errorDetail = syncError instanceof Error 
        ? {
            message: syncError.message,
            stack: syncError.stack,
            name: syncError.name
          }
        : String(syncError);
      
      return NextResponse.json(
        { 
          success: false, 
          error: "Sync process failed",
          errorDetail,
          message: "Failed to sync emails. See console for details."
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in sync API handler:", error);
    
    // Return a safe error response
    return NextResponse.json(
      { 
        success: false, 
        error: "API error",
        message: "An unexpected error occurred. Please check browser console logs."
      },
      { status: 500 }
    );
  }
}