import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "~/lib/db";
import { clients } from "~/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserAccessToken, setUserAccessToken } from "~/lib/auth/microsoft";
import { getClientEmails } from "~/lib/client-reports/email-fetcher";
import { calculateEmailProcessingParams } from "~/lib/ai/model-info";
import { env } from "~/lib/env";

// Schema for the summarize request
const summarizeRequestSchema = z.object({
  startDate: z.string(), // ISO date string
  endDate: z.string(),   // ISO date string
  format: z.string(),    // Template format
  domains: z.array(z.string()).optional(),
  emails: z.array(z.string()).optional(),
  clientId: z.string().optional(),
  saveName: z.string().nullable().optional(), // Optional name to save this template
  examplePrompt: z.string().nullable().optional(), // Optional examples/instructions for the template
  searchQuery: z.string().optional(), // Optional semantic search query
  useVectorSearch: z.boolean().optional(), // Whether to use vector search
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
    
    // Verify OpenAI API key is available
    if (!env.OPENAI_API_KEY) {
      console.error('Summarize API - OpenAI API key is missing');
      return NextResponse.json(
        { 
          error: "OpenAI API key is missing",
          message: "The server is missing the OpenAI API key. Please contact the administrator."
        },
        { status: 500 }
      );
    }
    
    // Parse and validate the request body
    console.log('Summarize API - Parsing request body');
    let body;
    try {
      body = await request.json();
      console.log('Summarize API - Request body:', JSON.stringify(body));
    } catch (parseError) {
      console.error('Summarize API - Error parsing request body:', parseError);
      return NextResponse.json(
        { 
          error: "Invalid request format",
          message: "The request body could not be parsed as JSON"
        },
        { status: 400 }
      );
    }
    
    // Handle null values by replacing them with undefined
    Object.keys(body).forEach(key => {
      if (body[key] === null) {
        body[key] = undefined;
      }
    });
    
    // Validate the request data
    let data;
    try {
      data = summarizeRequestSchema.parse(body);
    } catch (validationError) {
      console.error('Summarize API - Validation error:', validationError);
      return NextResponse.json(
        { 
          error: "Invalid request data",
          message: "The request data did not match the expected schema",
          details: validationError
        },
        { status: 400 }
      );
    }
    
    // Modify format to include search results section if search query is provided
    let format = data.format;
    if (data.searchQuery && !format.includes('{search_results}')) {
      // Add search results section after the summary
      const summaryEndIndex = format.indexOf('### Summary') + '### Summary'.length;
      const nextSectionIndex = format.indexOf('###', summaryEndIndex);
      
      if (nextSectionIndex !== -1) {
        const searchSection = `

### Search Results: "${data.searchQuery}"
{search_results}
`;
        format = format.slice(0, nextSectionIndex) + searchSection + format.slice(nextSectionIndex);
      }
    }
    
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
      // Get environment variable for max emails or use a sensible default
      const maxFetchLimit = env.EMAIL_FETCH_LIMIT ? 
        parseInt(String(env.EMAIL_FETCH_LIMIT)) : 1000; // Default to 1000 if not specified
        
      emailResult = await getClientEmails({
        startDate: startDateIso,
        endDate: endDateIso,
        clientDomains: clientDomains,
        clientEmails: clientEmails,
        maxResults: maxFetchLimit,
        searchQuery: data.searchQuery,
        useVectorSearch: data.useVectorSearch || false
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
      const sortedEmails = [...emails].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Initialize variables for email processing parameters
      let MAX_DETAILED_EMAILS = 0;
      let MAX_SUMMARY_EMAILS = 0;
      let MAX_BODY_LENGTH = 0;
      let modelInfo = "";
      
      // Get total email count
      const totalEmails = emails.length;
      
      try {
        // Determine whether to use dynamic model-based limits or static limits
        if (env.USE_DYNAMIC_MODEL_LIMITS) {
          // Use the model's context window to calculate optimal parameters
          const params = calculateEmailProcessingParams(totalEmails, 4000);
          
          // Extract the calculated values
          MAX_DETAILED_EMAILS = params.detailedEmailCount;
          MAX_SUMMARY_EMAILS = params.summaryEmailCount;
          MAX_BODY_LENGTH = params.maxBodyLength;
          
          // Add model information for logging
          modelInfo = `Using dynamic limits based on ${params.model} with ${params.contextWindow} context window. ` +
            `Will process ${params.detailedEmailCount} emails in detail and ${params.summaryEmailCount} with summaries only. ` +
            `This covers ${params.percentageProcessed.toFixed(1)}% of all emails in this period.`;
          
          console.log('Summarize API - Using model-based parameters:', JSON.stringify(params));
        } else {
          // Fallback to standard percentage-based calculation
          const percentForDetailed = 0.3; // 30% for full content
          const percentForSummary = 0.6;  // 60% for summaries only
          
          // Calculate limits with reasonable maximums
          MAX_DETAILED_EMAILS = Math.min(Math.ceil(totalEmails * percentForDetailed), 30);
          MAX_SUMMARY_EMAILS = Math.min(Math.ceil(totalEmails * percentForSummary), 100);
          
          // Calculate maximum body length based on email count
          const baseCharPerEmail = 10000;
          const totalCharBudget = 1000000;
          
          MAX_BODY_LENGTH = Math.max(
            Math.min(
              Math.floor(totalCharBudget / (MAX_DETAILED_EMAILS || 1)),
              baseCharPerEmail
            ),
            300 // Minimum size
          );
          
          modelInfo = "Using standard percentage-based allocation";
          console.log('Summarize API - Using standard calculation parameters');
        }
        
        // Log the parameters we'll be using
        console.log(`Summarize API - Processing parameters: Total emails: ${totalEmails}, Detailed: ${MAX_DETAILED_EMAILS}, Summary: ${MAX_SUMMARY_EMAILS}, Max body length: ${MAX_BODY_LENGTH}`);
      } catch (error) {
        // If anything fails, use safe defaults
        console.error('Error calculating email parameters:', error);
        MAX_DETAILED_EMAILS = Math.min(15, totalEmails);
        MAX_SUMMARY_EMAILS = Math.min(50, totalEmails - MAX_DETAILED_EMAILS);
        MAX_BODY_LENGTH = 600;
        modelInfo = "Using fallback parameters due to calculation error";
      }
      
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
      let prompt = `Generate a communication report based on these emails ${clientName ? `with ${clientName}` : ''}.
                Use exactly this format template: "${format}"
                
                The template may contain placeholders like {date_range}, {summary}, {action_items}, etc.
                Replace these placeholders with appropriate content summarized from the emails.
                
                IMPORTANT: Follow ONLY the format provided in the template. Do not add any sections that are not explicitly included in the template.
                If a section is not in the template, do not include it in your response.
                
                CRITICAL INSTRUCTION: Your output must EXACTLY match the structure of the provided template. 
                Do not add any headers, sections, or content that is not explicitly requested in the template.
                The client expects the report to match their template precisely.
                
                CRITICAL SOURCE WEIGHTING: The 'source' field in each email MUST be used to determine how to phrase information:
                - When 'source' is 'client': Only present statements as potential decisions if they are explicitly stated as such by the client
                - When 'source' is 'user': Never present these as decisions. Always phrase these as suggestions, recommendations, or considerations
                
                Use appropriate language based on the source:
                - For user statements: "suggested", "recommended", "proposed", "noted", "raised a concern about"
                - For client statements: Only use "decided", "agreed to", "determined" when explicitly confirmed
                
                Only use words indicating decision or agreement when the CLIENT explicitly confirms something. 
                User statements should always be phrased as suggestions or considerations regardless of their tone or wording.
                
                Pay special attention to identifying strategy changes and shifts in direction in these communications. 
                Look for patterns that show how the current approach differs from previous strategies discussed.
                Highlight any significant pivots or changes in project focus.
                
                IMPORTANT: For the "highlights" field in your response, please return an empty array ([]) as this feature is no longer used.
                
                ${data.searchQuery && data.useVectorSearch ? 
                  `IMPORTANT: This is an AI search for "${data.searchQuery}". This report MUST focus EXCLUSIVELY on topics related to "${data.searchQuery}". 
                   ALL sections of this report should be focused ONLY on content related to this search query.
                   The emails have been selected based on semantic similarity to this topic.
                   
                   DO NOT include a separate "Search Results" section. Instead, ensure that ALL sections (summary, key topics, etc.) 
                   focus on "${data.searchQuery}" and related concepts.
                   
                   Ignore any emails or discussions not related to "${data.searchQuery}". The client is specifically looking
                   for information about this topic only.` : ''}
                
                Time period: ${new Date(data.startDate).toLocaleDateString()} to ${new Date(data.endDate).toLocaleDateString()}
                ${clientDomains.length > 0 ? `Client domains: ${clientDomains.join(', ')}` : ''}
                ${clientEmails.length > 0 ? `Client emails: ${clientEmails.join(', ')}` : ''}
                ${data.searchQuery ? `Search query: "${data.searchQuery}" (${data.useVectorSearch ? 'using semantic search' : 'using keyword search'})` : ''}
                
                Total emails in period: ${emails.length}
                ${emailMetadata}
                
                ${detailedEmails.length < emails.length ? 
                  `Note: Due to processing limits, only the ${detailedEmails.length} most recent emails were analyzed in detail, with metadata from all ${emails.length} emails.` : ''}
                
                TIER 1 - Detailed analysis of most recent ${detailedEmails.length} emails (including content):
                ${JSON.stringify(detailedEmails)}
                
                ${summaryEmails.length > 0 ? 
                  `TIER 2 - Summary of next ${summaryEmails.length} emails (metadata only):
                   ${JSON.stringify(summaryEmails)}` : ''}`;
                   
      // Add user-provided examples or instructions if available
      if (data.examplePrompt && data.examplePrompt.trim()) {
        prompt += `\n\nSPECIAL INSTRUCTIONS OR EXAMPLES:
        ${data.examplePrompt}
        
        Use these examples or instructions to guide your analysis, especially for strategy changes.`
      }
      
      // Log diagnostic information about the prompt
      console.log('Summarize API - AI prompt length:', prompt.length);
      console.log('Summarize API - Detailed emails:', detailedEmails.length);
      console.log('Summarize API - Summary emails:', summaryEmails.length);
      
      // Calculate rough token estimate - 1 token ≈ 4 chars for English text
      const estimatedTokens = Math.ceil(prompt.length / 4);
      console.log(`Summarize API - Estimated tokens: ~${estimatedTokens}`);
      
      // Add model info to the prompt
      if (modelInfo) {
        prompt += `\n\n${modelInfo}`;
      }
      
      // Use the configured model from environment variables with timeout handling
      try {
        // Set a reasonable timeout for the OpenAI API call
        const timeoutMs = 50000; // 50 seconds (Vercel functions have a 60s limit)
        
        // Create a promise that resolves with the AI result
        const aiPromise = generateObject({
          model: openai(env.OPENAI_REPORT_MODEL, { 
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
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`OpenAI API call timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });
        
        // Race the AI promise against the timeout
        result = await Promise.race([aiPromise, timeoutPromise]);
        
        console.log('Summarize API - AI result received');
        
        if (!result || !result.object) {
          throw new Error('No result returned from AI');
        }
        
        console.log('Summarize API - Report length:', result.object.report.length);
        console.log('Summarize API - Highlights count:', result.object.highlights.length);
      } catch (err) {
        console.error('Summarize API - AI generation error:', err);
        
        // Check for specific OpenAI API errors
        const errorMessage = err.message || String(err);
        
        if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
          return NextResponse.json({
            error: "OpenAI API authentication error",
            message: "The OpenAI API key is invalid or has expired. Please check your API key configuration."
          }, { status: 401 });
        }
        
        if (errorMessage.includes('timeout')) {
          return NextResponse.json({
            error: "OpenAI API timeout",
            message: "The request to OpenAI took too long to complete. Please try again with a smaller date range or fewer emails."
          }, { status: 504 });
        }
        
        return NextResponse.json({
          error: "AI generation error: " + errorMessage
        }, { status: 500 });
      }
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
          INSERT INTO report_templates (id, name, format, client_id, created_at, updated_at, example_prompt)
          VALUES (?, ?, ?, ?, unixepoch(), unixepoch(), ?)
        `);
        
        const templateId = crypto.randomUUID();
        saveStmt.run(
          templateId, 
          data.saveName, 
          format, // Use the potentially modified format 
          data.clientId, 
          data.examplePrompt || null
        );
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
    
    // Provide a more detailed error response
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { 
        error: "Failed to generate summary", 
        message: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}