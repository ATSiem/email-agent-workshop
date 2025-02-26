import { NextResponse } from "next/server";
import { db } from "~/lib/db";
import { messages } from "~/lib/db/schema";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";

export async function GET(request: Request) {
  try {
    // Get token from the Authorization header first
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // If no token in header, try the module-level token
    if (!accessToken) {
      accessToken = getUserAccessToken();
    }
    
    if (!accessToken) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access your emails",
          messages: [] 
        },
        { status: 401 }
      );
    }
    
    // Set the token for Graph API calls that might happen later
    setUserAccessToken(accessToken);
    
    // Use raw SQL for compatibility
    const stmt = db.connection.prepare(`
      SELECT * FROM messages 
      ORDER BY created_at DESC
    `);
    
    const allMessages = stmt.all();

    return NextResponse.json({ 
      messages: allMessages 
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages", messages: [] },
      { status: 500 }
    );
  }
}