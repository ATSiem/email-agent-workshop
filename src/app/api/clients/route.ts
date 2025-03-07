import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/lib/db";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";
import { clients } from "~/lib/db/pg-schema"; // Import the clients table schema

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
    console.log('Clients API - Auth header present:', !!authHeader);
    
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
    
    // Check if we're using Postgres
    const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_TYPE === 'postgres';
    console.log('Clients API - Using Postgres:', usePostgres);
    
    // Ensure the clients table exists
    try {
      console.log('Clients API - Ensuring clients table exists');
      if (usePostgres) {
        // For Postgres, we don't need to create tables here as they should be created during deployment
        console.log('Clients API - Using Postgres, skipping table creation');
      } else {
        // For SQLite, create the table if it doesn't exist
        db.connection.prepare(`
          CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domains TEXT NOT NULL,
            emails TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch())
          )
        `).run();
      }
      console.log('Clients API - Clients table check completed');
    } catch (tableError) {
      console.error('Clients API - Error ensuring clients table exists:', tableError);
      // Continue with the request, as the table might already exist
    }
    
    // Get client ID from URL if provided (for single client fetch)
    const url = new URL(request.url);
    const clientId = url.searchParams.get('id');
    
    // Log database operations
    console.log('Clients API - Database operations starting');
    
    try {
      if (clientId) {
        console.log('Clients API - Fetching single client:', clientId);
        // Fetch a single client
        const stmt = db.connection.prepare(`
          SELECT * FROM clients WHERE id = ?
        `);
        
        const client = stmt.get(clientId);
        
        if (!client) {
          console.log('Clients API - Client not found');
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
        console.log('Clients API - Fetching all clients');
        // Fetch all clients
        const stmt = db.connection.prepare(`
          SELECT * FROM clients ORDER BY name ASC
        `);
        
        try {
          const clients = stmt.all();
          console.log('Clients API - Found', Array.isArray(clients) ? clients.length : 'non-array result', 'clients');
          
          // Ensure clients is an array before mapping
          if (!Array.isArray(clients)) {
            console.log('Clients API - Non-array result, returning empty array');
            return NextResponse.json({ clients: [] });
          }
          
          // Parse JSON strings back to arrays for each client
          const formattedClients = clients.map(client => {
            try {
              return {
                ...client,
                domains: JSON.parse(client.domains || '[]'),
                emails: JSON.parse(client.emails || '[]'),
              };
            } catch (parseError) {
              console.error('Error parsing client JSON fields:', parseError);
              return {
                ...client,
                domains: [],
                emails: [],
              };
            }
          });
          
          console.log('Clients API - Returning formatted clients:', formattedClients.length);
          return NextResponse.json({ clients: formattedClients });
        } catch (dbError) {
          console.error("Database query error:", dbError);
          return NextResponse.json({ 
            clients: [],
            error: "Database query error",
            message: dbError.message || "Failed to query clients"
          });
        }
      }
    } catch (dbError) {
      console.error("Database error:", dbError);
      
      // For new users, return an empty clients array instead of an error
      // This prevents showing "Failed to fetch clients" for new users
      if (!clientId) {
        console.log('Clients API - Database error but returning empty clients array for better UX');
        return NextResponse.json({ 
          clients: [],
          warning: "Database error occurred, but returning empty array",
          message: dbError.message || "Database error"
        });
      }
      
      // For specific client requests, we still need to return an error
      throw dbError;
    }
  } catch (error) {
    console.error("Clients API - Unhandled error:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch clients",
        message: error.message || "Unknown error occurred",
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      },
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
    
    console.log('POST /api/clients - Request received');
    
    // Check if we're using Postgres
    const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_TYPE === 'postgres';
    console.log('POST /api/clients - Using Postgres:', usePostgres);
    
    // Ensure the clients table exists
    try {
      console.log('POST /api/clients - Ensuring clients table exists');
      if (usePostgres) {
        // For Postgres, we don't need to create tables here as they should be created during deployment
        console.log('POST /api/clients - Using Postgres, skipping table creation');
      } else {
        // For SQLite, create the table if it doesn't exist
        db.connection.prepare(`
          CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domains TEXT NOT NULL,
            emails TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch())
          )
        `).run();
      }
      console.log('POST /api/clients - Clients table check completed');
    } catch (tableError) {
      console.error('POST /api/clients - Error ensuring clients table exists:', tableError);
      // Continue with the request, as the table might already exist
    }
    
    // Parse and validate the request body
    console.log('POST /api/clients - Parsing request body');
    let body;
    try {
      body = await request.json();
      console.log('POST /api/clients - Request body:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('POST /api/clients - Failed to parse request body:', parseError);
      return NextResponse.json(
        { 
          error: "Invalid request format", 
          message: "Could not parse request body as JSON",
          details: parseError.message
        },
        { status: 400 }
      );
    }
    
    try {
      console.log('POST /api/clients - Validating with Zod schema');
      const data = clientSchema.parse(body);
      console.log('POST /api/clients - Validation successful');
      
      // Generate a new client ID
      const clientId = crypto.randomUUID();
      console.log('POST /api/clients - Generated client ID:', clientId);
      
      // Insert the new client
      console.log('POST /api/clients - Preparing database insert');
      
      if (usePostgres) {
        // Use Postgres-compatible syntax
        try {
          console.log('POST /api/clients - Using Postgres insert');
          await db.insert('clients', {
            id: clientId,
            name: data.name,
            domains: JSON.stringify(data.domains),
            emails: JSON.stringify(data.emails),
          });
          console.log('POST /api/clients - Postgres insert successful');
        } catch (pgError) {
          console.error('POST /api/clients - Postgres insert error:', pgError);
          return NextResponse.json(
            { 
              error: "Database error", 
              message: "Failed to insert client into Postgres database",
              details: pgError.message
            },
            { status: 500 }
          );
        }
      } else {
        // Use SQLite syntax
        let stmt;
        try {
          stmt = db.connection.prepare(`
            INSERT INTO clients (id, name, domains, emails, created_at, updated_at)
            VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
          `);
        } catch (prepareError) {
          console.error('POST /api/clients - Failed to prepare SQL statement:', prepareError);
          return NextResponse.json(
            { 
              error: "Database error", 
              message: "Failed to prepare database statement",
              details: prepareError.message
            },
            { status: 500 }
          );
        }
        
        console.log('POST /api/clients - Executing database insert with values:', {
          id: clientId,
          name: data.name,
          domains: JSON.stringify(data.domains),
          emails: JSON.stringify(data.emails)
        });
        
        try {
          stmt.run(
            clientId,
            data.name,
            JSON.stringify(data.domains),
            JSON.stringify(data.emails)
          );
          console.log('POST /api/clients - Database insert successful');
        } catch (dbError) {
          console.error('POST /api/clients - Database insert error:', dbError);
          return NextResponse.json(
            { 
              error: "Database error", 
              message: "Failed to insert client into database",
              details: dbError.message
            },
            { status: 500 }
          );
        }
      }
      
      console.log('POST /api/clients - Returning success response');
      return NextResponse.json({
        id: clientId,
        name: data.name,
        domains: data.domains,
        emails: data.emails,
      }, { status: 201 });
    } catch (validationError) {
      console.error('POST /api/clients - Validation error:', validationError);
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: "Validation error", 
            message: "The provided data did not pass validation",
            details: validationError.format() 
          },
          { status: 400 }
        );
      }
      throw validationError;
    }
  } catch (error) {
    console.error("Error creating client:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Validation error", 
          message: "The provided data did not pass validation",
          details: error.format() 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to create client", 
        message: error.message || "Unknown error",
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      },
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
    
    // Ensure the clients table exists
    try {
      console.log('PUT /api/clients - Ensuring clients table exists');
      db.connection.prepare(`
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          domains TEXT NOT NULL,
          emails TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `).run();
      console.log('PUT /api/clients - Clients table check completed');
    } catch (tableError) {
      console.error('PUT /api/clients - Error ensuring clients table exists:', tableError);
      // Continue with the request, as the table might already exist
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
    
    // Check if client exists
    const checkStmt = db.connection.prepare(`
      SELECT id FROM clients WHERE id = ?
    `);
    
    const existingClient = checkStmt.get(clientId);
    
    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    
    // Update the client
    const updateStmt = db.connection.prepare(`
      UPDATE clients
      SET name = ?, domains = ?, emails = ?, updated_at = unixepoch()
      WHERE id = ?
    `);
    
    updateStmt.run(
      data.name,
      JSON.stringify(data.domains),
      JSON.stringify(data.emails),
      clientId
    );
    
    return NextResponse.json({
      id: clientId,
      name: data.name,
      domains: data.domains,
      emails: data.emails,
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
    
    // Get client ID from URL or path
    const url = new URL(request.url);
    
    // Try to get client ID from query parameter
    let clientId = url.searchParams.get('id');
    
    // If not found in query, try to extract from path
    if (!clientId) {
      const pathParts = url.pathname.split('/');
      // The last part of the path should be the client ID
      const potentialId = pathParts[pathParts.length - 1];
      if (potentialId && potentialId !== 'clients') {
        clientId = potentialId;
      }
    }
    
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