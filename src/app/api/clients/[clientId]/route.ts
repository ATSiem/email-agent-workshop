import { NextResponse } from "next/server";
import { db } from "~/lib/db";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";

export async function DELETE(
  request: Request,
  { params }: { params: { clientId: string } }
) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    if (!accessToken) {
      accessToken = getUserAccessToken();
    }
    
    if (!accessToken) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Set the token for Graph API calls that might happen later
    setUserAccessToken(accessToken);
    
    const { clientId } = params;
    
    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }
    
    // Check if client exists
    const checkStmt = db.connection.prepare(`
      SELECT id FROM clients WHERE id = ?
    `);
    
    const existingClient = checkStmt.get(clientId);
    
    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    
    // First, delete any associated report feedback
    try {
      const deleteFeedbackStmt = db.connection.prepare(`
        DELETE FROM report_feedback WHERE client_id = ?
      `);
      
      deleteFeedbackStmt.run(clientId);
      console.log(`Deleted report feedback for client ${clientId}`);
    } catch (feedbackError) {
      console.error("Error deleting client feedback:", feedbackError);
      // Continue with deletion even if feedback deletion fails
    }
    
    // Next, delete any associated report templates
    const deleteTemplatesStmt = db.connection.prepare(`
      DELETE FROM report_templates WHERE client_id = ?
    `);
    
    deleteTemplatesStmt.run(clientId);
    
    // Then delete the client
    const deleteClientStmt = db.connection.prepare(`
      DELETE FROM clients WHERE id = ?
    `);
    
    deleteClientStmt.run(clientId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
} 