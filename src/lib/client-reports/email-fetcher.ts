import { db } from "~/lib/db";
import { getGraphClient } from "~/lib/auth/microsoft";

// Parameters for email fetching
interface EmailParams {
  startDate: string;
  endDate: string;
  clientDomains?: string[];
  clientEmails?: string[];
  maxResults?: number;
}

// Function to get emails from both database and Microsoft Graph API
export async function getClientEmails(params: EmailParams) {
  try {
    console.log('EmailFetcher - Fetching client emails with params:', params);
    
    const { startDate, endDate, clientDomains = [], clientEmails = [], maxResults = 100 } = params;
    
    // Get stored client emails from database
    const dbEmails = await getClientEmailsFromDatabase(params);
    console.log(`EmailFetcher - Found ${dbEmails.length} emails in database`);
    
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
    
    // Sort by date (newest first)
    allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Limit the number of results
    if (maxResults && allEmails.length > maxResults) {
      allEmails = allEmails.slice(0, maxResults);
    }
    
    return {
      emails: allEmails,
      fromGraphApi
    };
  } catch (error) {
    console.error('EmailFetcher - Error getting comprehensive emails:', error);
    throw error;
  }
}

// Function to get client emails from database
async function getClientEmailsFromDatabase(params: EmailParams) {
  try {
    const { startDate, endDate, clientDomains = [], clientEmails = [] } = params;
    
    console.log('EmailFetcher - Fetching from database with date range:');
    console.log(`  - Start date: ${startDate}`);
    console.log(`  - End date: ${endDate}`);
    
    // Convert client domains and emails to SQL filter conditions
    const domainConditions = clientDomains.map(domain => 
      `("from" LIKE '%@${domain}' OR "to" LIKE '%@${domain}')`
    );
    
    const emailConditions = clientEmails.map(email => 
      `("from" = '${email.replace(/'/g, "''")}' OR "to" = '${email.replace(/'/g, "''")}')`
    );
    
    // Combine conditions
    const filterConditions = [...domainConditions, ...emailConditions];
    const whereClause = filterConditions.length > 0 
      ? `AND (${filterConditions.join(' OR ')})`
      : '';
    
    // Query the database for client emails
    const query = `
      SELECT * FROM messages 
      WHERE date >= '${startDate}' AND date <= '${endDate}'
      ${whereClause}
      ORDER BY date DESC
    `;
    
    console.log('EmailFetcher - Database query:', query);
    
    const stmt = db.connection.prepare(query);
    const emails = stmt.all();
    
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