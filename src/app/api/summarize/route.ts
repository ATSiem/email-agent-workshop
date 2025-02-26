import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "~/lib/db";
import { clients } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";

// Schema for the summarize request
const summarizeRequestSchema = z.object({
  startDate: z.string(), // ISO date string
  endDate: z.string(),   // ISO date string
  format: z.string(),    // Template format
  domains: z.array(z.string()).optional(),
  emails: z.array(z.string()).optional(),
  clientId: z.string().optional(),
  saveName: z.string().nullable().optional(), // Optional name to save this template
});

export async function POST(request: Request) {
  try {
    console.log('Summarize API - Request received');
    
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    console.log('Summarize API - Auth header present:', !!authHeader);
    
    if (!accessToken) {
      console.log('Summarize API - No auth header, trying getUserAccessToken()');
      accessToken = getUserAccessToken();
      console.log('Summarize API - Token from getUserAccessToken:', accessToken ? 'present' : 'missing');
    }
    
    if (!accessToken) {
      console.log('Summarize API - No token found, returning 401');
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Set the token for Graph API calls that might happen later
    console.log('Summarize API - Setting user access token');
    setUserAccessToken(accessToken);
    
    // Parse and validate the request body
    console.log('Summarize API - Parsing request body');
    const body = await request.json();
    console.log('Summarize API - Request body:', JSON.stringify(body));
    
    // Handle null values by replacing them with undefined
    Object.keys(body).forEach(key => {
      if (body[key] === null) {
        body[key] = undefined;
      }
    });
    
    const data = summarizeRequestSchema.parse(body);
    
    // Fetch client details if clientId is provided
    let clientDomains = data.domains || [];
    let clientEmails = data.emails || [];
    let clientName = "";
    
    if (data.clientId) {
      console.log('Summarize API - Fetching client details for ID:', data.clientId);
      const stmt = db.connection.prepare(`
        SELECT * FROM clients WHERE id = ?
      `);
      
      const client = stmt.get(data.clientId);
      console.log('Summarize API - Client found:', !!client);
      
      if (client) {
        clientName = client.name;
        try {
          clientDomains = [...clientDomains, ...JSON.parse(client.domains)];
          clientEmails = [...clientEmails, ...JSON.parse(client.emails)];
          console.log('Summarize API - Client domains:', clientDomains);
          console.log('Summarize API - Client emails:', clientEmails);
        } catch (err) {
          console.error('Summarize API - Error parsing client domains/emails:', err);
          console.log('Summarize API - Raw domains data:', client.domains);
          console.log('Summarize API - Raw emails data:', client.emails);
        }
      }
    }
    
    // Build SQL query with domain and email filters
    console.log('Summarize API - Building SQL query');
    let sql = `
      SELECT * FROM messages 
      WHERE date BETWEEN ? AND ?
    `;
    
    const params = [data.startDate, data.endDate];
    console.log('Summarize API - Date range:', data.startDate, 'to', data.endDate);
    
    if (clientDomains.length > 0 || clientEmails.length > 0) {
      const domainClauses = clientDomains.map(domain => 
        `(\`from\` LIKE '%@${domain}' OR \`to\` LIKE '%@${domain}')`
      );
      
      const emailClauses = clientEmails.map(email => 
        `(\`from\` LIKE '%${email}%' OR \`to\` LIKE '%${email}%')`
      );
      
      const allClauses = [...domainClauses, ...emailClauses];
      if (allClauses.length > 0) {
        sql += ` AND (${allClauses.join(' OR ')})`;
      }
    }
    
    sql += ` ORDER BY date ASC`;
    console.log('Summarize API - Final SQL query:', sql);
    console.log('Summarize API - Query parameters:', params);
    
    // Execute the query and get emails
    let emails = [];
    try {
      const stmt = db.connection.prepare(sql);
      emails = stmt.all(...params);
      console.log('Summarize API - Found emails:', emails.length);
      
      // Exit early if no emails found
      if (emails.length === 0) {
        console.log('Summarize API - No emails found for criteria');
        return NextResponse.json({
          error: "No emails found for the given criteria",
          emailCount: 0
        }, { status: 404 });
      }
      
      // Verify email format is what we expect
      if (emails.length > 0) {
        console.log('Summarize API - Sample email fields:', Object.keys(emails[0]));
        console.log('Summarize API - Sample email:', JSON.stringify(emails[0]));
      }
    } catch (err) {
      console.error('Summarize API - SQL query error:', err);
      return NextResponse.json({
        error: "Database error when querying emails: " + (err.message || String(err))
      }, { status: 500 });
    }
    
    // Generate the summary using AI
    console.log('Summarize API - Generating report with AI');
    let result;
    try {
      const prompt = `Generate a communication report based on these emails ${clientName ? `with ${clientName}` : ''}.
                Use exactly this format template: "${data.format}"
                
                The template may contain placeholders like {date_range}, {summary}, {action_items}, etc.
                Replace these placeholders with appropriate content summarized from the emails.
                
                Time period: ${new Date(data.startDate).toLocaleDateString()} to ${new Date(data.endDate).toLocaleDateString()}
                ${clientDomains.length > 0 ? `Client domains: ${clientDomains.join(', ')}` : ''}
                ${clientEmails.length > 0 ? `Client emails: ${clientEmails.join(', ')}` : ''}
                
                Emails: ${JSON.stringify(emails)}`;
      
      console.log('Summarize API - AI prompt length:', prompt.length);
      console.log('Summarize API - AI prompt snippet:', prompt.substring(0, 300) + '...');
      
      result = await generateObject({
        model: openai("gpt-4o-2024-08-06", { structuredOutputs: true }),
        schemaName: "communicationReport",
        schemaDescription: "A formatted report of email communications",
        schema: z.object({ 
          report: z.string(),
          highlights: z.array(z.string())
        }),
        prompt,
      });
      
      console.log('Summarize API - AI result received');
      
      if (!result || !result.object) {
        throw new Error('No result returned from AI');
      }
      
      console.log('Summarize API - Report length:', result.object.report.length);
      console.log('Summarize API - Highlights count:', result.object.highlights.length);
    } catch (err) {
      console.error('Summarize API - AI generation error:', err);
      return NextResponse.json({
        error: "AI generation error: " + (err.message || String(err))
      }, { status: 500 });
    }
    
    // Save template if requested - only if saveName is a non-empty string
    if (data.saveName && data.saveName.trim() !== '' && data.clientId) {
      console.log('Summarize API - Saving template:', data.saveName);
      try {
        const saveStmt = db.connection.prepare(`
          INSERT INTO report_templates (id, name, format, client_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
        `);
        
        const templateId = crypto.randomUUID();
        saveStmt.run(templateId, data.saveName, data.format, data.clientId);
        console.log('Summarize API - Template saved with ID:', templateId);
      } catch (err) {
        console.error('Summarize API - Error saving template:', err);
        // Continue anyway since this is not critical
      }
    } else {
      console.log('Summarize API - Not saving template (empty name or no client ID)');
    }
    
    console.log('Summarize API - Returning successful response');
    return NextResponse.json({
      report: result.object.report,
      highlights: result.object.highlights,
      emailCount: emails.length,
    });
  } catch (error) {
    console.error("Error generating summary:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    return NextResponse.json(
      { error: "Failed to generate summary: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}