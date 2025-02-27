import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "~/lib/db";
import { clients } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";
import { getClientEmails } from "~/lib/client-reports/email-fetcher";

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
    
    // Use our client email fetcher
    console.log('Summarize API - Fetching client emails for date range:', 
      data.startDate, 'to', data.endDate);
    
    // Ensure date strings are properly formatted ISO strings
    // This adds a layer of safety in case the client sends malformed dates
    let startDateIso = data.startDate;
    let endDateIso = data.endDate;
    
    try {
      // Ensure startDate is a valid ISO date string with full UTC day coverage
      const startDate = new Date(data.startDate);
      startDate.setUTCHours(0, 0, 0, 0);
      startDateIso = startDate.toISOString();
      
      // Ensure endDate is a valid ISO date string with full UTC day coverage  
      const endDate = new Date(data.endDate);
      endDate.setUTCHours(23, 59, 59, 999);
      endDateIso = endDate.toISOString();
      
      console.log('Summarize API - Using normalized date range:');
      console.log(`  - Original startDate: ${data.startDate}`);
      console.log(`  - Original endDate: ${data.endDate}`);
      console.log(`  - Normalized startDate: ${startDateIso}`);
      console.log(`  - Normalized endDate: ${endDateIso}`);
    } catch (err) {
      console.error('Summarize API - Error normalizing dates:', err);
      // Continue with original dates if normalization fails
    }
    
    // Get emails from database AND Microsoft Graph if needed
    let emailResult;
    try {
      // Use the normalized date strings for the query
      emailResult = await getClientEmails({
        startDate: startDateIso,
        endDate: endDateIso,
        clientDomains: clientDomains,
        clientEmails: clientEmails,
        maxResults: 500 // Increased from 100 to fetch more emails
      });
      
      // Check if we have emails
      if (!emailResult.emails || emailResult.emails.length === 0) {
        console.log('Summarize API - No emails found anywhere');
        return NextResponse.json({
          error: "No emails found for the given criteria",
          emailCount: 0
        }, { status: 404 });
      }
      
      console.log(`Summarize API - Found ${emailResult.emails.length} emails, ${emailResult.fromGraphApi ? 'including' : 'not including'} from Graph API`);
      
      // Verify email format is what we expect
      if (emailResult.emails.length > 0) {
        console.log('Summarize API - Sample email fields:', Object.keys(emailResult.emails[0]));
      }
    } catch (err) {
      console.error('Summarize API - Error fetching emails:', err);
      return NextResponse.json({
        error: "Error fetching emails: " + (err.message || String(err))
      }, { status: 500 });
    }
    
    // Set shorthand for emails
    const emails = emailResult.emails;
    
    // Generate the summary using AI
    console.log('Summarize API - Generating report with AI');
    
    // Enhanced diagnostic info
    console.log('Summarize API - Email statistics:');
    console.log(`  - Total email count: ${emails.length}`);
    
    // Check date range of emails in the dataset
    if (emails.length > 0) {
      try {
        const sortedDates = [...emails].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        console.log('Summarize API - Email date range in dataset:');
        console.log(`  - Earliest: ${sortedDates[0].date} (subject: ${sortedDates[0].subject})`);
        console.log(`  - Latest: ${sortedDates[sortedDates.length-1].date} (subject: ${sortedDates[sortedDates.length-1].subject})`);
        
        // Create a histogram of dates to see the distribution
        const dateMap = new Map();
        emails.forEach(email => {
          const day = new Date(email.date).toISOString().split('T')[0];
          dateMap.set(day, (dateMap.get(day) || 0) + 1);
        });
        
        console.log('Summarize API - Emails by date:');
        Array.from(dateMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([date, count]) => console.log(`  - ${date}: ${count} emails`));
      } catch (err) {
        console.error('Summarize API - Error analyzing date distribution:', err);
      }
    }
    
    let result;
    try {
      // Two-tier approach: use summaries for most emails, full content for only the most recent/important ones
      // Sort emails by date (newest first) to prioritize recent communications
      const sortedEmails = [...emails].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      // Set limits based on email volume
      const MAX_DETAILED_EMAILS = 15; // Emails to analyze in full detail
      const MAX_SUMMARY_EMAILS = 50; // Additional emails to include just the summaries
      const MAX_BODY_LENGTH = 600; // Characters per email body (reduced from 800)
      
      // Split into two tiers:
      // 1. Recent emails with truncated bodies for detailed analysis
      // 2. Older emails with just metadata and summaries (no bodies)
      const detailedEmails = sortedEmails
        .slice(0, MAX_DETAILED_EMAILS)
        .map(email => ({
          id: email.id,
          subject: email.subject,
          from: email.from,
          to: email.to,
          date: email.date,
          // Truncate long email bodies to save tokens
          body: email.body && email.body.length > MAX_BODY_LENGTH 
            ? email.body.substring(0, MAX_BODY_LENGTH) + '... [truncated]' 
            : email.body,
          summary: email.summary,
          labels: email.labels
        }));
      
      // For older emails, only include metadata and summaries without bodies
      const summaryEmails = sortedEmails
        .slice(MAX_DETAILED_EMAILS, MAX_DETAILED_EMAILS + MAX_SUMMARY_EMAILS)
        .map(email => ({
          id: email.id,
          subject: email.subject,
          from: email.from,
          to: email.to,
          date: email.date,
          summary: email.summary,
          labels: email.labels
          // Intentionally omit body to save tokens
        }));
      
      console.log(`Summarize API - Using ${detailedEmails.length} emails for detailed analysis and ${summaryEmails.length} for summary analysis`);
      
      // Create a summary of all emails by day and most common subjects
      let emailMetadata = "";
      try {
        // Group emails by date
        const emailsByDate = {};
        emails.forEach(email => {
          const day = new Date(email.date).toISOString().split('T')[0];
          if (!emailsByDate[day]) emailsByDate[day] = [];
          emailsByDate[day].push(email);
        });
        
        // Create a summary of emails per day (just top 10 days if there are many)
        emailMetadata = "Email distribution by date:\n";
        Object.keys(emailsByDate)
          .sort()
          .slice(-10) // Only show last 10 days if there are many
          .forEach(date => {
            emailMetadata += `- ${date}: ${emailsByDate[date].length} emails\n`;
          });
        
        // Count subject frequencies
        const subjectCount = {};
        emails.forEach(email => {
          const normalizedSubject = email.subject
            .replace(/^(RE:|FW:|FWD:)\s*/i, '')
            .trim();
          subjectCount[normalizedSubject] = (subjectCount[normalizedSubject] || 0) + 1;
        });
        
        // Get top 5 most common threads
        const topThreads = Object.entries(subjectCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
          
        if (topThreads.length > 0) {
          emailMetadata += "\nMost active discussion threads:\n";
          topThreads.forEach(([subject, count]) => {
            emailMetadata += `- "${subject}" (${count} emails)\n`;
          });
        }
      } catch (err) {
        console.error('Summarize API - Error generating metadata:', err);
      }
      
      // Build prompt with two-tier approach
      const prompt = `Generate a communication report based on these emails ${clientName ? `with ${clientName}` : ''}.
                Use exactly this format template: "${data.format}"
                
                The template may contain placeholders like {date_range}, {summary}, {action_items}, etc.
                Replace these placeholders with appropriate content summarized from the emails.
                
                Time period: ${new Date(data.startDate).toLocaleDateString()} to ${new Date(data.endDate).toLocaleDateString()}
                ${clientDomains.length > 0 ? `Client domains: ${clientDomains.join(', ')}` : ''}
                ${clientEmails.length > 0 ? `Client emails: ${clientEmails.join(', ')}` : ''}
                
                Total emails in period: ${emails.length}
                ${emailMetadata}
                
                ${detailedEmails.length < emails.length ? 
                  `Note: Due to processing limits, only the ${detailedEmails.length} most recent emails were analyzed in detail, with metadata from all ${emails.length} emails.` : ''}
                
                TIER 1 - Detailed analysis of most recent ${detailedEmails.length} emails (including content):
                ${JSON.stringify(detailedEmails)}
                
                ${summaryEmails.length > 0 ? 
                  `TIER 2 - Summary of next ${summaryEmails.length} emails (metadata only):
                   ${JSON.stringify(summaryEmails)}` : ''}`;
      
      // Log diagnostic information about the prompt
      console.log('Summarize API - AI prompt length:', prompt.length);
      console.log('Summarize API - Detailed emails:', detailedEmails.length);
      console.log('Summarize API - Summary emails:', summaryEmails.length);
      
      // Calculate rough token estimate - 1 token ≈ 4 chars for English text
      const estimatedTokens = Math.ceil(prompt.length / 4);
      console.log(`Summarize API - Estimated tokens: ~${estimatedTokens}`);
      
      result = await generateObject({
        // Use 128k context model with structured output
        model: openai("gpt-4o-2024-08-06", { 
          structuredOutputs: true,
          maxTokens: 4000 // Limit response size
        }),
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
      fromGraphApi: emailResult.fromGraphApi
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