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
    
    // Try both vector and SQL search when appropriate
    let vectorEmails = [];
    
    // If search query is provided and vector search is enabled, try semantic search
    if (searchQuery && useVectorSearch) {
      console.log(`EmailFetcher - Using vector search for query: "${searchQuery}"`);
      try {
        vectorEmails = await findSimilarEmails(searchQuery, {
          limit: maxResults,
          startDate,
          endDate,
          clientDomains,
          clientEmails
        });
        console.log(`EmailFetcher - Found ${vectorEmails.length} emails via vector search`);
      } catch (error) {
        console.error("EmailFetcher - Vector search error:", error);
        // Continue with traditional search if vector search fails
      }
    }
    
    // Always perform traditional SQL search
    const sqlEmails = await getClientEmailsFromDatabase(params);
    console.log(`EmailFetcher - Found ${sqlEmails.length} emails via SQL search`);
    
    // Use vector search results if available and not empty, otherwise fall back to SQL results
    if (searchQuery && useVectorSearch && vectorEmails.length > 0) {
      dbEmails = vectorEmails;
    } else {
      dbEmails = sqlEmails;
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
    const { 
      startDate, 
      endDate, 
      clientDomains = [], 
      clientEmails = [], 
      maxResults = 100,
      searchQuery = ""  // Add support for standard keyword search
    } = params;
    
    console.log('EmailFetcher - Fetching from database with date range:');
    console.log(`  - Start date: ${startDate}`);
    console.log(`  - End date: ${endDate}`);
    if (searchQuery) {
      console.log(`  - Search query: "${searchQuery}"`);
    }
    
    // First, get the user's own email
    // For the database, we need to get it from the Graph API first
    let userEmail = '';
    try {
      const client = getGraphClient();
      if (client) {
        const userInfo = await client.api('/me').select('mail,userPrincipalName').get();
        userEmail = userInfo.mail || userInfo.userPrincipalName || '';
        console.log(`EmailFetcher - User email for database query: ${userEmail}`);
      }
    } catch (error) {
      console.error('EmailFetcher - Error getting user email for database query:', error);
      // Continue with empty userEmail - will fall back to old behavior
    }
    
    // Using parameterized queries for better security
    const conditions = [];
    const queryParams = [];
    
    // Add date range parameters - convert ISO strings to just the date part
    if (startDate) {
      const dateStr = new Date(startDate).toISOString().split('T')[0];
      conditions.push("date >= ?");
      queryParams.push(dateStr);
    }
    
    if (endDate) {
      const dateStr = new Date(endDate).toISOString().split('T')[0];
      conditions.push("date <= ?");
      queryParams.push(dateStr);
    }
    
    // Add search term if provided (for standard non-vector search)
    if (searchQuery && searchQuery.trim()) {
      // Search in subject and body
      conditions.push("(subject LIKE ? OR body LIKE ?)");
      const searchTerm = `%${searchQuery}%`;
      queryParams.push(searchTerm);
      queryParams.push(searchTerm);
    }
    
    // Improved filtering logic when we have the user's email
    if (userEmail && (clientDomains.length > 0 || clientEmails.length > 0)) {
      const clientFilters = [];
      
      // Case 1: Email from user to client
      // For each client domain
      for (const domain of clientDomains) {
        clientFilters.push(`("from" = ? AND "to" LIKE ?)`);
        queryParams.push(userEmail);
        queryParams.push(`%@${domain}`);
      }
      
      // For each client email
      for (const email of clientEmails) {
        clientFilters.push(`("from" = ? AND "to" = ?)`);
        queryParams.push(userEmail);
        queryParams.push(email);
      }
      
      // Case 2: Email from client to user
      // For each client domain
      for (const domain of clientDomains) {
        clientFilters.push(`("from" LIKE ? AND "to" = ?)`);
        queryParams.push(`%@${domain}`);
        queryParams.push(userEmail);
      }
      
      // For each client email
      for (const email of clientEmails) {
        clientFilters.push(`("from" = ? AND "to" = ?)`);
        queryParams.push(email);
        queryParams.push(userEmail);
      }
      
      // Combine client filters
      if (clientFilters.length > 0) {
        conditions.push(`(${clientFilters.join(' OR ')})`);
      }
    } else {
      // Fallback to original behavior if we don't have the user's email
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
    }
    
    // Combine all conditions
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Query the database for client emails
    const query = `
      SELECT * FROM messages 
      ${whereClause}
      ORDER BY date DESC
      LIMIT ?
    `;
    
    queryParams.push(maxResults);
    
    console.log('EmailFetcher - Database query:', query);
    console.log('EmailFetcher - Database query params:', queryParams);
    
    const stmt = db.connection.prepare(query);
    const emails = stmt.all(...queryParams);
    
    // Add source information to emails for weighting
    const processedEmails = emails.map(email => {
      let source = 'other';
      const fromEmail = email.from || '';
      
      if (userEmail && fromEmail === userEmail) {
        source = 'user'; // Email is from the user
      } else if (
        clientEmails.includes(fromEmail) ||
        clientDomains.some(domain => fromEmail.endsWith(`@${domain}`))
      ) {
        source = 'client'; // Email is from a client
      }
      
      return {
        ...email,
        source
      };
    });
    
    return processedEmails;
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
    
    // First get the current user's email address
    const userInfo = await client.api('/me').select('mail,userPrincipalName').get();
    const userEmail = userInfo.mail || userInfo.userPrincipalName || '';
    
    if (!userEmail) {
      console.log('EmailFetcher - Could not determine user email');
      return [];
    }
    
    console.log(`EmailFetcher - User email identified as: ${userEmail}`);
    
    // Query Graph API
    const graphResult = await client
      .api('/me/messages')
      .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,hasAttachments')
      .filter(filterParts.join(' and '))
      .top(maxResults)
      .orderby('receivedDateTime desc')
      .get();
    
    if (!graphResult || !graphResult.value) {
      console.log('EmailFetcher - No results from Graph API');
      return [];
    }
    
    // Filter results by client domains/emails with improved logic
    let filteredResults = graphResult.value;
    
    if (clientDomains.length > 0 || clientEmails.length > 0) {
      filteredResults = graphResult.value.filter(message => {
        const fromEmail = message.from?.emailAddress?.address || '';
        const toRecipients = message.toRecipients?.map(r => r.emailAddress?.address || '') || [];
        const ccRecipients = message.ccRecipients?.map(r => r.emailAddress?.address || '') || [];
        const allRecipients = [...toRecipients, ...ccRecipients];
        
        // Determine if this is a client email based on the fixed logic:
        
        // Case 1: Email from user to client
        const isFromUserToClient = 
          fromEmail === userEmail && 
          (
            clientEmails.some(email => toRecipients.includes(email)) ||
            clientDomains.some(domain => toRecipients.some(recipient => recipient.endsWith(`@${domain}`)))
          );
        
        // Case 2: Email from client to user
        const isFromClientToUser = 
          toRecipients.includes(userEmail) &&
          (
            clientEmails.includes(fromEmail) ||
            clientDomains.some(domain => fromEmail.endsWith(`@${domain}`))
          );
        
        // Case 3 (to exclude): Both user and client are recipients but from someone else (newsletters, notifications)
        const isNewsletter = 
          allRecipients.includes(userEmail) && 
          (
            clientEmails.some(email => allRecipients.includes(email)) ||
            clientDomains.some(domain => allRecipients.some(recipient => recipient.endsWith(`@${domain}`)))
          ) &&
          !isFromUserToClient && 
          !isFromClientToUser;
        
        // Include only case 1 and 2, exclude newsletters/notifications (case 3)
        return isFromUserToClient || isFromClientToUser;
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
      
      // Determine the source (user, client, or other)
      let source = 'other';
      const fromEmail = message.from?.emailAddress?.address || '';
      
      if (fromEmail === userEmail) {
        source = 'user'; // Email is from the current user
      } else if (
        clientEmails.includes(fromEmail) ||
        clientDomains.some(domain => fromEmail.endsWith(`@${domain}`))
      ) {
        source = 'client'; // Email is from a client
      }
      
      return {
        id: message.id,
        subject: message.subject || '(No Subject)',
        from: message.from?.emailAddress?.address || '',
        to: message.toRecipients?.[0]?.emailAddress?.address || '',
        date: message.receivedDateTime,
        body: body,
        summary: '',
        labels: JSON.stringify([]),
        attachments: JSON.stringify([]),
        source: source // Add source field
      };
    });
    
    // Save emails to database
    try {
      console.log(`EmailFetcher - Attempting to save ${emails.length} emails to database`);
      
      // Log database schema for debugging
      try {
        const tableInfoStmt = db.connection.prepare('PRAGMA table_info(messages)');
        const tableInfo = tableInfoStmt.all();
        console.log('EmailFetcher - Database schema for messages table:', tableInfo);
      } catch (schemaError) {
        console.error('EmailFetcher - Error fetching schema:', schemaError);
      }
      
      const savedEmails = [];
      for (const email of emails) {
        try {
          // Check if email already exists in database
          const existingStmt = db.connection.prepare('SELECT id FROM messages WHERE id = ?');
          const existing = existingStmt.get(email.id);
          
          if (!existing) {
            // Insert email into database
            // SQLite requires quotes around column names that are keywords
            const insertStmt = db.connection.prepare(`
              INSERT INTO messages (
                id, subject, "from", "to", date, body, 
                attachments, summary, labels, processed_for_vector
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            `);
            
            insertStmt.run(
              email.id,
              email.subject,
              email.from,
              email.to,
              email.date,
              email.body,
              email.attachments,
              email.summary,
              email.labels
            );
            
            console.log(`EmailFetcher - Saved email with ID ${email.id} to database`);
            savedEmails.push(email.id);
          } else {
            console.log(`EmailFetcher - Email ${email.id} already exists in database`);
          }
        } catch (singleEmailError) {
          console.error(`EmailFetcher - Error saving email ${email.id}:`, singleEmailError);
          console.error(`EmailFetcher - Email data:`, JSON.stringify({
            id: email.id,
            subject: email.subject,
            from: email.from,
            to: email.to,
            date: email.date?.substring(0, 30) + '...',
          }));
        }
      }
      
      if (savedEmails.length > 0) {
        console.log(`EmailFetcher - Saved ${savedEmails.length} new emails to database`);
        // Queue background processing for these specific emails
        queueBackgroundTask('process_new_emails', { 
          emailIds: savedEmails,
          priority: 'high'
        });
      } else {
        console.log('EmailFetcher - No new emails to save to database');
      }
    } catch (dbError) {
      console.error('EmailFetcher - Error saving emails to database:', dbError);
    }
    
    return emails;
  } catch (error) {
    console.error('EmailFetcher - Error getting emails from Graph API:', error);
    return [];
  }
}