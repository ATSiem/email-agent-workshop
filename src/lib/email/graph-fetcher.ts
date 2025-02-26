import { getGraphClient } from '../auth/microsoft';
import { db } from '../db';
import { messages } from '../db/schema';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * Direct approach: Fetch all emails from Graph API for the date range,
 * save them to the database, and return everything.
 * 
 * This ensures we have complete coverage for reports.
 */
export async function getComprehensiveEmails(options: {
  startDate: string;
  endDate: string;
  clientDomains?: string[];
  clientEmails?: string[];
  maxResults?: number;
}): Promise<{emails: any[], fromGraphApi: boolean}> {
  try {
    console.log('GraphFetcher - Starting comprehensive email fetch');
    // Increase default maxResults to ensure we get most of the emails for the period
    const { startDate, endDate, clientDomains = [], clientEmails = [], maxResults = 500 } = options;
    
    // STEP 1: Get all emails directly from Microsoft Graph API
    console.log('GraphFetcher - Fetching emails directly from Graph API');
    // Pass the options with potentially increased maxResults
    const graphEmails = await fetchEmailsFromGraph({
      startDate,
      endDate,
      clientDomains,
      clientEmails,
      maxResults
    });
    console.log(`GraphFetcher - Found ${graphEmails.length} emails from Graph API`);
    
    // Get the emails we already have in the database
    const existingEmails = await getExistingEmails(graphEmails.map(e => e.id));
    console.log(`GraphFetcher - ${existingEmails.size} of these emails already exist in database`);
    
    // STEP 2: Save new emails to the database
    const newEmails = [];
    let saveCount = 0;
    for (const email of graphEmails) {
      if (!existingEmails.has(email.id)) {
        try {
          await db.insert(messages).values({
            id: email.id,
            subject: email.subject,
            from: email.from,
            to: email.to,
            date: email.date,
            body: email.body,
            attachments: email.attachments || '[]',
            summary: email.summary,
            labels: typeof email.labels === 'string' ? email.labels : JSON.stringify(email.labels),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          newEmails.push(email);
          saveCount++;
          
          // Don't log every single email to avoid console spam
          if (saveCount <= 5 || saveCount % 10 === 0) {
            console.log(`GraphFetcher - Saved new email to database: ${email.subject} (${saveCount} of ${graphEmails.length - existingEmails.size})`);
          }
        } catch (err) {
          console.error(`GraphFetcher - Error saving email ${email.id}:`, err);
        }
      }
    }
    
    console.log(`GraphFetcher - Saved ${saveCount} new emails to database`);
    
    // STEP 3: Get all matching emails from the database for the report
    // Apply the exact same filters as requested (don't try to be smart)
    const allDbEmails = await getEmailsFromDatabase(
      new Date(startDate).toISOString(), 
      new Date(endDate).toISOString(),
      clientDomains,
      clientEmails
    );
    
    console.log(`GraphFetcher - Found ${allDbEmails.length} emails in database matching the requested filters`);
    
    // Log the first few emails from database for debugging
    if (allDbEmails.length > 0) {
      console.log('GraphFetcher - Sample emails from database:');
      allDbEmails.slice(0, Math.min(3, allDbEmails.length)).forEach((email, i) => {
        console.log(`Email ${i+1}: ${email.subject}, Date: ${email.date}, From: ${email.from}`);
      });
    }
    
    console.log(`GraphFetcher - Final email count from database: ${allDbEmails.length}`);
    
    return {
      emails: allDbEmails,
      fromGraphApi: newEmails.length > 0
    };
  } catch (error) {
    console.error('GraphFetcher - Error in comprehensive email fetch:', error);
    
    // Fallback to just database emails if Graph API fails
    const dbEmails = await getEmailsFromDatabase(
      new Date(options.startDate).toISOString(),
      new Date(options.endDate).toISOString(),
      options.clientDomains,
      options.clientEmails
    );
    
    return { 
      emails: dbEmails, 
      fromGraphApi: false 
    };
  }
}

/**
 * Get a Set of email IDs that already exist in the database
 */
async function getExistingEmails(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  
  // Group IDs into batches to avoid too many parameters in the SQL query
  const batchSize = 100;
  const existingIds = new Set<string>();
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(',');
    
    try {
      const stmt = db.connection.prepare(`
        SELECT id FROM messages WHERE id IN (${placeholders})
      `);
      
      const results = stmt.all(...batch);
      
      for (const row of results) {
        existingIds.add(row.id);
      }
    } catch (err) {
      console.error('GraphFetcher - Error checking existing emails:', err);
    }
  }
  
  return existingIds;
}

/**
 * Get emails from the database matching the criteria
 */
async function getEmailsFromDatabase(startDate: string, endDate: string, domains: string[] = [], emails: string[] = []) {
  try {
    // Log input parameters for debugging
    console.log('GraphFetcher - getEmailsFromDatabase called with:');
    console.log(`  - startDate: ${startDate}`);
    console.log(`  - endDate: ${endDate}`);
    console.log(`  - domains: ${JSON.stringify(domains)}`);
    console.log(`  - emails: ${JSON.stringify(emails)}`);
    
    // First, check total count of emails in the date range without any filtering
    try {
      const countStmt = db.connection.prepare(`
        SELECT COUNT(*) as count FROM messages 
        WHERE date BETWEEN ? AND ?
      `);
      
      const countResult = countStmt.get(startDate, endDate);
      console.log(`GraphFetcher - Total emails in date range: ${countResult.count}`);
      
      // Sample a few date values from the database for debugging
      const sampleStmt = db.connection.prepare(`
        SELECT id, date FROM messages
        LIMIT 5
      `);
      
      const samples = sampleStmt.all();
      console.log('GraphFetcher - Sample date values in database:');
      samples.forEach(sample => console.log(`  - ID: ${sample.id}, Date: ${sample.date}`));
    } catch (err) {
      console.error('GraphFetcher - Error running diagnostic queries:', err);
    }
    
    // Build SQL query with domain and email filters
    // SQLite's BETWEEN operator can have issues with ISO date strings
    // We'll use direct string comparison which is more reliable for ISO dates
    let sql = `
      SELECT * FROM messages 
      WHERE date >= ? AND date <= ?
    `;
    
    const params = [startDate, endDate];
    
    // Log an example date format comparison for debugging
    console.log('GraphFetcher - Date comparison will match emails where:');
    console.log(`  - date >= ${startDate}`);
    console.log(`  - date <= ${endDate}`);
    
    if (domains.length > 0 || emails.length > 0) {
      // For domains, we search for the domain in from/to fields
      const domainClauses = domains.map(domain => {
        if (!domain || !domain.trim()) return null;
        return `(\`from\` LIKE '%@${domain.trim()}' OR \`to\` LIKE '%@${domain.trim()}')`;
      }).filter(Boolean);
      
      // For specific emails, create exact matches (not partial matches)
      // This ensures we don't accidentally match partial email addresses
      const emailClauses = emails.map(email => {
        if (!email || !email.trim()) return null;
        
        // Exact match is better than LIKE for specific email addresses
        const cleanEmail = email.trim();
        return `(\`from\` = '${cleanEmail}' OR \`to\` LIKE '%${cleanEmail}%')`;
      }).filter(Boolean);
      
      const allClauses = [...domainClauses, ...emailClauses];
      if (allClauses.length > 0) {
        sql += ` AND (${allClauses.join(' OR ')})`;
      }
    }
    
    sql += ` ORDER BY date ASC`;
    
    // Log the SQL query for debugging
    console.log('GraphFetcher - SQL Query:', sql);
    console.log('GraphFetcher - Parameters:', params);
    
    // Execute the query
    const stmt = db.connection.prepare(sql);
    const results = stmt.all(...params);
    
    console.log(`GraphFetcher - Query returned ${results.length} results`);
    
    // If there are results, log the first and last for debugging
    if (results.length > 0) {
      console.log('GraphFetcher - First email:', {
        id: results[0].id,
        date: results[0].date,
        subject: results[0].subject
      });
      
      if (results.length > 1) {
        console.log('GraphFetcher - Last email:', {
          id: results[results.length - 1].id,
          date: results[results.length - 1].date,
          subject: results[results.length - 1].subject
        });
      }
    }
    
    // Transform the results to make sure the labels are parsed from JSON
    return results.map(email => ({
      ...email,
      labels: typeof email.labels === 'string' ? JSON.parse(email.labels) : email.labels
    }));
  } catch (err) {
    console.error('GraphFetcher - Error getting emails from database:', err);
    return [];
  }
}

/**
 * Fetch emails directly from Microsoft Graph API
 * This function handles pagination to retrieve ALL emails in the date range
 */
async function fetchEmailsFromGraph(options: {
  startDate: string;
  endDate: string;
  clientDomains?: string[];
  clientEmails?: string[];
  maxResults?: number;
}): Promise<any[]> {
  const { startDate, endDate, clientDomains = [], clientEmails = [], maxResults = 500 } = options;
  
  try {
    // Ensure we have authentication
    const graphClient = getGraphClient();
    
    // Ensure we're using full days for date comparison - using UTC to be consistent
    // Start at beginning of day (UTC midnight)
    const dateStart = new Date(startDate);
    dateStart.setUTCHours(0, 0, 0, 0);
    const formattedStartDate = dateStart.toISOString();
    
    // End at end of day (UTC just before midnight)
    const dateEnd = new Date(endDate);
    dateEnd.setUTCHours(23, 59, 59, 999);
    const formattedEndDate = dateEnd.toISOString();
    
    console.log('GraphFetcher - Using date range:');
    console.log(`  - Original startDate: ${startDate}`);
    console.log(`  - Original endDate: ${endDate}`);
    console.log(`  - Formatted startDate: ${formattedStartDate}`);
    console.log(`  - Formatted endDate: ${formattedEndDate}`);
    
    // Build filter query
    // We're using OData filter syntax for MS Graph
    let query = `receivedDateTime ge ${formattedStartDate} and receivedDateTime le ${formattedEndDate}`;
    
    // Add domain/email filters
    const addressFilters: string[] = [];
    
    // Add domain filters - if any are provided
    if (clientDomains.length > 0) {
      clientDomains.forEach(domain => {
        if (domain && domain.trim()) {
          // Use simple 'contains' for the from address
          addressFilters.push(`contains(from/emailAddress/address, '${domain}')`);
          
          // For recipients, use the correct syntax for the any() operator
          // The any() operator requires a boolean expression inside
          addressFilters.push(`toRecipients/any(r:contains(r/emailAddress/address, '${domain}'))`);
        }
      });
    }
    
    // Add specific email filters - if any are provided
    if (clientEmails.length > 0) {
      clientEmails.forEach(email => {
        if (email && email.trim()) {
          // Simple equality for sender
          addressFilters.push(`from/emailAddress/address eq '${email}'`);
          
          // Proper any() syntax for recipients
          addressFilters.push(`toRecipients/any(r:r/emailAddress/address eq '${email}')`);
        }
      });
    }
    
    // Combine all filters, but don't apply them if there are none valid
    if (addressFilters.length > 0) {
      query += ` and (${addressFilters.join(' or ')})`;
    }
    
    console.log('GraphFetcher - Graph API query:', query);
    
    // Variables for paging results
    let allEmails = [];
    let nextLink = null;
    let pageCount = 0;
    const pageSize = 100; // Microsoft Graph API's max page size
    
    // Initial request - try specific targeted query if emails are provided
    let result;
    let usedSpecificEmailQuery = false;
    
    try {
      // If we are looking for specific email addresses, use a more direct approach
      if (clientEmails.length === 1 && clientEmails[0] && clientEmails[0].trim()) {
        // Direct specific query for a single email is more reliable
        const specificEmail = clientEmails[0].trim();
        const specificQuery = `(from/emailAddress/address eq '${specificEmail}' or toRecipients/any(r:r/emailAddress/address eq '${specificEmail}')) and receivedDateTime ge ${formattedStartDate} and receivedDateTime le ${formattedEndDate}`;
        
        console.log('GraphFetcher - Using targeted query for specific email:', specificEmail);
        console.log('GraphFetcher - Specific query:', specificQuery);
        
        result = await graphClient
          .api('/me/messages')
          .filter(specificQuery)
          .top(pageSize)
          .select('id,subject,body,from,toRecipients,receivedDateTime')
          .orderby('receivedDateTime desc')
          .get();
          
        usedSpecificEmailQuery = true;
        console.log('GraphFetcher - Specific email query successful');
      } else {
        // Use the regular query with all filters
        result = await graphClient
          .api('/me/messages')
          .filter(query)
          .top(pageSize)
          .select('id,subject,body,from,toRecipients,receivedDateTime')
          .orderby('receivedDateTime desc')
          .get();
          
        console.log('GraphFetcher - Standard Graph API request successful');
      }
    } catch (err) {
      console.error('GraphFetcher - Error in Graph API request:', err);
      console.log('GraphFetcher - Checking if this is a filter syntax error...');
      
      // Try a simplified query without complex filters as fallback
      try {
        const simpleQuery = `receivedDateTime ge ${formattedStartDate} and receivedDateTime le ${formattedEndDate}`;
        console.log('GraphFetcher - Trying simplified query:', simpleQuery);
        
        result = await graphClient
          .api('/me/messages')
          .filter(simpleQuery)
          .top(pageSize)
          .select('id,subject,body,from,toRecipients,receivedDateTime')
          .orderby('receivedDateTime desc')
          .get();
          
        console.log('GraphFetcher - Simplified query successful');
      } catch (fallbackErr) {
        console.error('GraphFetcher - Even simplified query failed:', fallbackErr);
        return [];
      }
    }
    
    // Process the first page
    if (result.value && result.value.length > 0) {
      allEmails.push(...result.value);
      pageCount++;
      console.log(`GraphFetcher - Retrieved page ${pageCount} with ${result.value.length} emails`);
      
      // Log a sample email for debugging
      console.log('GraphFetcher - Sample email fields from first result:');
      const sample = result.value[0];
      console.log({
        id: sample.id,
        subject: sample.subject,
        from: sample.from?.emailAddress?.address,
        receivedDateTime: sample.receivedDateTime
      });
    } else {
      console.log('GraphFetcher - No emails found in first page');
      return [];
    }
    
    // Get the @odata.nextLink property if it exists
    nextLink = result['@odata.nextLink'];
    
    // Continue fetching pages until we have all emails or reach the max
    while (nextLink && allEmails.length < maxResults) {
      try {
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Fetch the next page directly using the nextLink URL
        result = await graphClient
          .api(nextLink)
          .get();
        
        if (result.value && result.value.length > 0) {
          allEmails.push(...result.value);
          pageCount++;
          console.log(`GraphFetcher - Retrieved page ${pageCount} with ${result.value.length} emails (total: ${allEmails.length})`);
        }
        
        // Update the next link
        nextLink = result['@odata.nextLink'];
      } catch (err) {
        console.error('GraphFetcher - Error fetching next page:', err);
        break;
      }
    }
    
    console.log(`GraphFetcher - Total emails retrieved from Graph API: ${allEmails.length} from ${pageCount} pages`);
    
    // Process emails in batches to generate summaries
    const processedEmails = [];
    const batchSize = 5; // Process in small batches for AI summarization
    
    for (let i = 0; i < allEmails.length; i += batchSize) {
      const batch = allEmails.slice(i, i + batchSize);
      console.log(`GraphFetcher - Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(allEmails.length/batchSize)}`);
      
      // Process emails in parallel within each batch
      const batchPromises = batch.map(async (email) => {
        try {
          if (!email.id || !email.subject || !email.from || !email.receivedDateTime) {
            console.error('GraphFetcher - Email missing required fields:', email.id);
            return null;
          }
          
          // Extract basic email data - being very careful about possibly missing fields
          const emailData = {
            id: email.id,
            subject: email.subject || '(No Subject)',
            from: email.from?.emailAddress?.address || 'unknown@example.com',
            to: email.toRecipients?.map(r => r?.emailAddress?.address).filter(Boolean).join(', ') || '',
            date: email.receivedDateTime,
            body: email.body?.content || '',
            attachments: '[]'
          };
          
          // Generate AI summary and labels
          const summaryResult = await generateObject({
            model: openai("gpt-4o-2024-08-06", { structuredOutputs: true }),
            schemaName: "email",
            schemaDescription: "An email summary.",
            schema: z.object({ 
              summary: z.string(), 
              labels: z.array(z.string()) 
            }),
            prompt: `Generate a summary and labels for the following email: ${JSON.stringify({
              subject: emailData.subject,
              from: emailData.from,
              to: emailData.to,
              body: emailData.body,
            })}. The summary should be 1-2 sentences and only generate 1-2 labels that are relevant to the email.`,
          });
          
          return {
            ...emailData,
            summary: summaryResult.object.summary,
            labels: summaryResult.object.labels
          };
        } catch (err) {
          console.error(`GraphFetcher - Error processing email ${email.id}:`, err);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      processedEmails.push(...batchResults.filter(Boolean));
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < allEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`GraphFetcher - Successfully processed ${processedEmails.length} of ${allEmails.length} emails from Graph API`);
    
    return processedEmails;
  } catch (error) {
    console.error('GraphFetcher - Error fetching from Graph API:', error);
    return [];
  }
}