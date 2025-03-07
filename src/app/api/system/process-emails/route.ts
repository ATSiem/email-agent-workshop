import { NextRequest, NextResponse } from "next/server";
import { queueBackgroundTask } from "~/lib/client-reports/background-processor";
import { db } from "~/lib/db";
import { clients } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { getClientEmails } from "~/lib/client-reports/email-fetcher";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";

/**
 * POST /api/system/process-emails
 * 
 * Process emails for a specific client and date range in the background
 * This allows pre-processing emails before generating a report
 */
export async function POST(request: NextRequest) {
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
    
    // Set the token for Graph API calls
    setUserAccessToken(accessToken);
    
    // Parse request body
    const body = await request.json();
    const { clientId, startDate, endDate, maxResults = 1000 } = body;
    
    if (!clientId || !startDate || !endDate) {
      return NextResponse.json(
        { 
          error: "Missing required parameters",
          message: "clientId, startDate, and endDate are required"
        },
        { status: 400 }
      );
    }
    
    // Fetch client details
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, clientId)
    });
    
    if (!client) {
      return NextResponse.json(
        { 
          error: "Client not found",
          message: "The specified client could not be found"
        },
        { status: 404 }
      );
    }
    
    // Parse client domains and emails
    let clientDomains = [];
    let clientEmails = [];
    
    try {
      clientDomains = JSON.parse(client.domains);
      clientEmails = JSON.parse(client.emails);
    } catch (err) {
      console.error('ProcessEmails API - Error parsing client domains/emails:', err);
    }
    
    // Queue a background task to fetch and process emails
    const taskId = queueBackgroundTask('process_client_emails', { 
      clientId,
      clientName: client.name,
      clientDomains,
      clientEmails,
      startDate,
      endDate,
      maxResults,
      priority: 'high'
    });
    
    // Start immediate processing of a small batch
    // This is done to provide some immediate feedback
    try {
      // Normalize date strings
      const startDateObj = new Date(startDate);
      startDateObj.setUTCHours(0, 0, 0, 0);
      const startDateIso = startDateObj.toISOString();
      
      const endDateObj = new Date(endDate);
      endDateObj.setUTCHours(23, 59, 59, 999);
      const endDateIso = endDateObj.toISOString();
      
      // Fetch a small batch immediately (limit to 50)
      getClientEmails({
        startDate: startDateIso,
        endDate: endDateIso,
        clientDomains,
        clientEmails,
        maxResults: 50
      }).catch(err => {
        console.error('ProcessEmails API - Error in immediate batch:', err);
      });
    } catch (err) {
      console.error('ProcessEmails API - Error starting immediate batch:', err);
    }
    
    return NextResponse.json({
      success: true,
      message: "Email processing started in the background",
      taskId,
      clientId,
      clientName: client.name,
      dateRange: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error("ProcessEmails API - Error:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to process emails",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 