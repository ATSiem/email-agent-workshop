import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/lib/db";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";

// Schema for report template
const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  format: z.string().min(1, "Template format is required"),
  clientId: z.string().optional(),
  examplePrompt: z.string().optional(),
});

export async function GET(request: Request) {
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
    
    // Get template ID or client ID from URL
    const url = new URL(request.url);
    const templateId = url.searchParams.get('id');
    const clientId = url.searchParams.get('clientId');
    
    if (templateId) {
      // Fetch a single template
      const stmt = db.connection.prepare(`
        SELECT t.*, c.name as client_name
        FROM report_templates t
        LEFT JOIN clients c ON t.client_id = c.id
        WHERE t.id = ?
      `);
      
      const template = stmt.get(templateId);
      
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      
      return NextResponse.json(template);
    } else if (clientId) {
      // Fetch templates for a specific client
      const stmt = db.connection.prepare(`
        SELECT t.*, c.name as client_name
        FROM report_templates t
        LEFT JOIN clients c ON t.client_id = c.id
        WHERE t.client_id = ?
        ORDER BY t.name ASC
      `);
      
      const templates = stmt.all(clientId);
      
      return NextResponse.json({ templates });
    } else {
      // Fetch all templates
      const stmt = db.connection.prepare(`
        SELECT t.*, c.name as client_name
        FROM report_templates t
        LEFT JOIN clients c ON t.client_id = c.id
        ORDER BY t.name ASC
      `);
      
      const templates = stmt.all();
      
      return NextResponse.json({ templates });
    }
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
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
    
    // Parse and validate the request body
    const body = await request.json();
    const data = templateSchema.parse(body);
    
    // If clientId is provided, check if client exists
    if (data.clientId) {
      const checkClientStmt = db.connection.prepare(`
        SELECT id FROM clients WHERE id = ?
      `);
      
      const existingClient = checkClientStmt.get(data.clientId);
      
      if (!existingClient) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
    }
    
    // Generate a new template ID
    const templateId = crypto.randomUUID();
    
    // Insert the new template
    const stmt = db.connection.prepare(`
      INSERT INTO report_templates (id, name, format, client_id, created_at, updated_at, example_prompt)
      VALUES (?, ?, ?, ?, unixepoch(), unixepoch(), ?)
    `);
    
    stmt.run(
      templateId,
      data.name,
      data.format,
      data.clientId || null,
      data.examplePrompt || null
    );
    
    return NextResponse.json({
      id: templateId,
      name: data.name,
      format: data.format,
      clientId: data.clientId || null,
      examplePrompt: data.examplePrompt || null,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create template" },
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
    
    // Get template ID from URL
    const url = new URL(request.url);
    const templateId = url.searchParams.get('id');
    
    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }
    
    // Parse and validate the request body
    const body = await request.json();
    const data = templateSchema.parse(body);
    
    // Check if template exists
    const checkTemplateStmt = db.connection.prepare(`
      SELECT id FROM report_templates WHERE id = ?
    `);
    
    const existingTemplate = checkTemplateStmt.get(templateId);
    
    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    
    // If clientId is provided, check if client exists
    if (data.clientId) {
      const checkClientStmt = db.connection.prepare(`
        SELECT id FROM clients WHERE id = ?
      `);
      
      const existingClient = checkClientStmt.get(data.clientId);
      
      if (!existingClient) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
    }
    
    // Update the template
    const updateStmt = db.connection.prepare(`
      UPDATE report_templates
      SET name = ?, format = ?, client_id = ?, updated_at = unixepoch(), example_prompt = ?
      WHERE id = ?
    `);
    
    updateStmt.run(
      data.name,
      data.format,
      data.clientId || null,
      data.examplePrompt || null,
      templateId
    );
    
    return NextResponse.json({
      id: templateId,
      name: data.name,
      format: data.format,
      clientId: data.clientId || null,
      examplePrompt: data.examplePrompt || null,
    });
  } catch (error) {
    console.error("Error updating template:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to update template" },
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
    
    // Get template ID from URL
    const url = new URL(request.url);
    const templateId = url.searchParams.get('id');
    
    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }
    
    // Check if template exists
    const checkStmt = db.connection.prepare(`
      SELECT id FROM report_templates WHERE id = ?
    `);
    
    const existingTemplate = checkStmt.get(templateId);
    
    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    
    // Delete the template
    const deleteStmt = db.connection.prepare(`
      DELETE FROM report_templates WHERE id = ?
    `);
    
    deleteStmt.run(templateId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}