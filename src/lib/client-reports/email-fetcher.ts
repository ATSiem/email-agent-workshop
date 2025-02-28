import { db } from "~/lib/db";
import { getGraphClient } from "~/lib/auth/microsoft";
import { findSimilarEmails } from "./email-embeddings";
import { queueBackgroundTask } from "./background-processor";

// Parameters for email fetching
interface EmailParams {
  startDate: string;
  endDate: string;
  clientDomains?: string[];
  clientEmails?: string[];
  maxResults?: number;
  searchQuery?: string;  // New: Support semantic search
  useVectorSearch?: boolean; // New: Flag to enable vector search
}

// Function to get emails from both database and Microsoft Graph API
export async function getClientEmails(params: EmailParams) {
  try {
    console.log('EmailFetcher - Fetching client emails with params:', params);
    
    const { 
      startDate, 
      endDate, 
      clientDomains = [], 
      clientEmails = [], 
      maxResults = process.env.EMAIL_FETCH_LIMIT ? parseInt(process.env.EMAIL_FETCH_LIMIT) : 500,
      searchQuery,
      useVectorSearch = false
    } = params;
    
    let dbEmails = [];
    
    // If search query is provided and vector search is enabled, use semantic search
    if (searchQuery && useVectorSearch) {
      console.log(`EmailFetcher - Using vector search for query: "${searchQuery}"`);
      dbEmails = await findSimilarEmails(searchQuery, {
        limit: maxResults,
        startDate,
        endDate,
        clientDomains,
        clientEmails
      });
      console.log(`EmailFetcher - Found ${dbEmails.length} emails via vector search`);
    } else {
      // Use traditional SQL search
      dbEmails = await getClientEmailsFromDatabase(params);
      console.log(`EmailFetcher - Found ${dbEmails.length} emails via SQL search`);
    }
    
    // Queue a background task to process any new emails
    // Use configurable batch size from environment or a reasonable default
    const batchSize = process.env.EMAIL_PROCESSING_BATCH_SIZE ? 
      parseInt(process.env.EMAIL_PROCESSING_BATCH_SIZE) : 200;
    
    queueBackgroundTask('process_new_emails', { limit: batchSize });
    
    // Try to fetch emails from Graph API if we have access
    let graphEmails = [];
    let fromGraphApi = false;
    
    try {
      // Get Microsoft Graph client
      const client = getGraphClient();
      
      if (client) {
        // Get emails from Graph API filtered by client domains/emails
        graphEmails = await getClientEmailsFromGraph(params);
        console.log(`EmailFetcher - Found ${graphEmails.length} emails from Graph API`);
        fromGraphApi = graphEmails.length > 0;
      }
    } catch (error) {
      console.error('EmailFetcher - Error fetching from Graph API:', error);
      // Continue with just the database emails
    }
    
    // Combine emails from both sources and deduplicate
    let allEmails = [...dbEmails, ...graphEmails];
    
    // Deduplicate based on email ID
    const emailMap = new Map();
    for (const email of allEmails) {
      emailMap.set(email.id, email);
    }
    
    // Convert back to array
    allEmails = Array.from(emailMap.values());
    
    // Sort by date (newest first) - unless we're using vector search, which already orders by relevance
    if (!useVectorSearch) {
      allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    // Limit the number of results
    if (maxResults && allEmails.length > maxResults) {
      allEmails = allEmails.slice(0, maxResults);
    }
    
    return {
      emails: allEmails,
      fromGraphApi,
      vectorSearchUsed: useVectorSearch && !!searchQuery
    };
  } catch (error) {
    console.error('EmailFetcher - Error getting comprehensive emails:', error);
    throw error;
  }
}

// Function to get client emails from database using SQL
async function getClientEmailsFromDatabase(params: EmailParams) {
  try {
    const { startDate, endDate, clientDomains = [], clientEmails = [], maxResults = 100 } = params;
    
    console.log('EmailFetcher - Fetching from database with date range:');
    console.log(`  - Start date: ${startDate}`);
    console.log(`  - End date: ${endDate}`);
    
    // Using parameterized queries for better security
    const conditions = [];
    const queryParams = [];
    
    // Add date range parameters
    conditions.push("date >= ?");
    queryParams.push(startDate);
    
    conditions.push("date <= ?");
    queryParams.push(endDate);
    
    // Add domain and email conditions
    const clientFilters = [];
    
    // Add domain conditions
    for (const domain of clientDomains) {
      clientFilters.push(`("from" LIKE ? OR "to" LIKE ?)`);
      queryParams.push(`%@${domain}`);
      queryParams.push(`%@${domain}`);
    }
    
    // Add email conditions
    for (const email of clientEmails) {
      clientFilters.push(`("from" = ? OR "to" = ?)`);
      queryParams.push(email);
      queryParams.push(email);
    }
    
    // Combine client filters
    if (clientFilters.length > 0) {
      conditions.push(`(${clientFilters.join(' OR ')})`);
    }
    
    // Combine all conditions
    const whereClause = conditions.join(' AND ');
    
    // Query the database for client emails
    const query = `
      SELECT * FROM messages 
      WHERE ${whereClause}
      ORDER BY date DESC
      LIMIT ?
    `;
    
    queryParams.push(maxResults);
    
    console.log('EmailFetcher - Database query params:', queryParams);
    
    const stmt = db.connection.prepare(query);
    const emails = stmt.all(...queryParams);
    
    return emails;
  } catch (error) {
    console.error('EmailFetcher - Error getting emails from database:', error);
    return [];
  }
}

// Function to get client emails from Microsoft Graph API
async function getClientEmailsFromGraph(params: EmailParams) {
  try {
    const { startDate, endDate, clientDomains = [], clientEmails = [], maxResults = 100 } = params;
    
    console.log('EmailFetcher - Fetching from Graph with date range:');
    console.log(`  - Start date: ${startDate}`);
    console.log(`  - End date: ${endDate}`);
    
    // Build filter conditions for Graph API
    const filterParts = [];
    
    // Date range filter
    filterParts.push(`receivedDateTime ge ${startDate} and receivedDateTime le ${endDate}`);
    
    // Get Microsoft Graph client
    const client = getGraphClient();
    
    if (!client) {
      console.log('EmailFetcher - No Graph client available');
      return [];
    }
    
    // Query Graph API
    const graphResult = await client
      .api('/me/messages')
      .select('id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,hasAttachments')
      .filter(filterParts.join(' and '))
      .top(maxResults)
      .orderby('receivedDateTime desc')
      .get();
    
    if (!graphResult || !graphResult.value) {
      console.log('EmailFetcher - No results from Graph API');
      return [];
    }
    
    // Filter results by client domains/emails
    let filteredResults = graphResult.value;
    
    if (clientDomains.length > 0 || clientEmails.length > 0) {
      filteredResults = graphResult.value.filter(message => {
        const fromEmail = message.from?.emailAddress?.address || '';
        const toEmail = message.toRecipients?.[0]?.emailAddress?.address || '';
        
        // Check if email matches client domains
        const matchesDomain = clientDomains.some(domain => 
          fromEmail.endsWith(`@${domain}`) || toEmail.endsWith(`@${domain}`)
        );
        
        // Check if email matches client emails
        const matchesEmail = clientEmails.some(email => 
          fromEmail === email || toEmail === email
        );
        
        return matchesDomain || matchesEmail;
      });
    }
    
    // Convert Graph API format to our format
    const emails = filteredResults.map(message => {
      // Extract text from HTML body
      const bodyContent = message.body?.content || '';
      const body = bodyContent
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/\\s+/g, ' ')    // Normalize whitespace
        .trim();
      
      return {
        id: message.id,
        subject: message.subject || '(No Subject)',
        from: message.from?.emailAddress?.address || '',
        to: message.toRecipients?.[0]?.emailAddress?.address || '',
        date: message.receivedDateTime,
        body: body,
        summary: '',
        labels: JSON.stringify([]),
        attachments: JSON.stringify([])
      };
    });
    
    return emails;
  } catch (error) {
    console.error('EmailFetcher - Error getting emails from Graph API:', error);
    return [];
  }
}