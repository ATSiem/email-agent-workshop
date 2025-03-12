import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/lib/db";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";
import { env } from "~/lib/env";

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Schema for creating/updating a client
const clientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  domains: z.array(z.string()),
  emails: z.array(z.string().email("Invalid email address")),
});

export async function GET(request: Request) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    console.log('Clients API - Auth header present:', !!authHeader);
    
    if (!accessToken) {
      console.log('Clients API - No auth header, trying getUserAccessToken()');
      accessToken = getUserAccessToken();
      console.log('Clients API - Token from getUserAccessToken:', accessToken ? 'present' : 'missing');
    }
    
    if (!accessToken) {
      console.log('Clients API - No token found, returning 401');
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Set the token for Graph API calls that might happen later
    console.log('Clients API - Setting user access token');
    setUserAccessToken(accessToken);
    
    // Get user email from the request headers (set by auth-provider)
    let userEmail = request.headers.get('X-User-Email');
    console.log('Clients API - User email from request headers:', userEmail);
    
    // In development mode, use a default email if none is provided
    if (!userEmail && isDevelopment) {
      userEmail = 'dev@example.com';
      console.log('Clients API - Using default development email:', userEmail);
    }
    
    if (!userEmail) {
      console.log('Clients API - No user email found, returning 401');
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "User email information is missing"
        },
        { status: 401 }
      );
    }
    
    // Get client ID from URL if provided (for single client fetch)
    const url = new URL(request.url);
    const clientId = url.searchParams.get('id');
    
    // Log database operations
    console.log('Clients API - Database operations starting');
    
    if (clientId) {
      console.log('Clients API - Fetching single client:', clientId);
      // Fetch a single client, ensuring it belongs to the current user
      const stmt = db.connection.prepare(`
        SELECT * FROM clients WHERE id = ? AND (user_id = ? OR user_id IS NULL)
      `);
      
      const client = stmt.get(clientId, userEmail);
      
      if (!client) {
        console.log('Clients API - Client not found or does not belong to user');
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      
      console.log('Clients API - Client found, returning data');
      // Parse JSON strings back to arrays
      return NextResponse.json({
        ...client,
        domains: JSON.parse(client.domains),
        emails: JSON.parse(client.emails),
      });
    } else {
      console.log('Clients API - Fetching all clients for user:', userEmail);
      // Fetch all clients for the current user, including those without a user_id (for backward compatibility)
      const stmt = db.connection.prepare(`
        SELECT * FROM clients WHERE user_id = ? OR user_id IS NULL ORDER BY name ASC
      `);
      
      const clients = stmt.all(userEmail);
      console.log('Clients API - Found', clients.length, 'clients for user');
      
      // Parse JSON strings back to arrays for each client
      const formattedClients = clients.map(client => ({
        ...client,
        domains: JSON.parse(client.domains),
        emails: JSON.parse(client.emails),
      }));
      
      console.log('Clients API - Returning formatted clients');
      return NextResponse.json({ clients: formattedClients });
    }
  } catch (error) {
    console.error("Error fetching clients:", error);
    console.error("Error details:", error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
    
    // Get user email from the request headers (set by auth-provider)
    let userEmail = request.headers.get('X-User-Email');
    
    // In development mode, use a default email if none is provided
    if (!userEmail && isDevelopment) {
      userEmail = 'dev@example.com';
      console.log('Clients API - Using default development email:', userEmail);
    }
    
    if (!userEmail) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "User email information is missing"
        },
        { status: 401 }
      );
    }
    
    // Parse and validate the request body
    const body = await request.json();
    const data = clientSchema.parse(body);
    
    // Generate a new client ID
    const clientId = crypto.randomUUID();
    
    // Insert the new client with the user ID
    const stmt = db.connection.prepare(`
      INSERT INTO clients (id, name, domains, emails, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
    `);
    
    stmt.run(
      clientId,
      data.name,
      JSON.stringify(data.domains),
      JSON.stringify(data.emails),
      userEmail
    );
    
    return NextResponse.json({
      id: clientId,
      name: data.name,
      domains: data.domains,
      emails: data.emails,
      userId: userEmail
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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
    
    // Get user email from the request headers (set by auth-provider)
    let userEmail = request.headers.get('X-User-Email');
    
    // In development mode, use a default email if none is provided
    if (!userEmail && isDevelopment) {
      userEmail = 'dev@example.com';
      console.log('Clients API - Using default development email:', userEmail);
    }
    
    if (!userEmail) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "User email information is missing"
        },
        { status: 401 }
      );
    }
    
    // Get client ID from URL
    const url = new URL(request.url);
    const clientId = url.searchParams.get('id');
    
    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }
    
    // Parse and validate the request body
    const body = await request.json();
    const data = clientSchema.parse(body);
    
    // Check if client exists and belongs to the current user
    const checkStmt = db.connection.prepare(`
      SELECT id FROM clients WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `);
    
    const existingClient = checkStmt.get(clientId, userEmail);
    
    if (!existingClient) {
      return NextResponse.json({ error: "Client not found or you don't have permission to update it" }, { status: 404 });
    }
    
    // Update the client
    const updateStmt = db.connection.prepare(`
      UPDATE clients
      SET name = ?, domains = ?, emails = ?, user_id = ?, updated_at = unixepoch()
      WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `);
    
    updateStmt.run(
      data.name,
      JSON.stringify(data.domains),
      JSON.stringify(data.emails),
      userEmail,
      clientId,
      userEmail
    );
    
    return NextResponse.json({
      id: clientId,
      name: data.name,
      domains: data.domains,
      emails: data.emails,
      userId: userEmail
    });
  } catch (error) {
    console.error("Error updating client:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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
    
    // Get user email from the request headers (set by auth-provider)
    let userEmail = request.headers.get('X-User-Email');
    
    // In development mode, use a default email if none is provided
    if (!userEmail && isDevelopment) {
      userEmail = 'dev@example.com';
      console.log('Clients API - Using default development email:', userEmail);
    }
    
    if (!userEmail) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "User email information is missing"
        },
        { status: 401 }
      );
    }
    
    // Get client ID from URL
    const url = new URL(request.url);
    const clientId = url.searchParams.get('id');
    
    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }
    
    // Check if client exists and belongs to the current user
    const checkStmt = db.connection.prepare(`
      SELECT id FROM clients WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `);
    
    const existingClient = checkStmt.get(clientId, userEmail);
    
    if (!existingClient) {
      return NextResponse.json({ error: "Client not found or you don't have permission to delete it" }, { status: 404 });
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
      DELETE FROM clients WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `);
    
    deleteClientStmt.run(clientId, userEmail);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}