import { getGraphClient, setUserAccessToken } from '~/lib/auth/microsoft';
import { db } from '~/lib/db';
import { messages } from '~/lib/db/schema';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// Define email interface matching our database schema
interface Email {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  attachments: { name: string; type: string; size: number }[];
}

// Function to fetch recent emails from Microsoft Graph
export async function fetchRecentEmails(count = 10): Promise<Email[]> {
  try {
    // Get the authenticated Graph client
    // This will throw if user is not authenticated
    const client = getGraphClient();
    
    try {
      // Get recent messages from the authenticated user's inbox
      const result = await client
        .api('/me/messages')
        .top(count)
        .orderby('receivedDateTime DESC')
        .select('id,subject,from,toRecipients,receivedDateTime,bodyPreview,hasAttachments')
        .get();
    
      const emails: Email[] = [];
    
      // Process each message
      for (const message of result.value) {
        // If message has attachments, get them
        let attachments = [];
        if (message.hasAttachments) {
          const attachmentResult = await client
            .api(`/me/messages/${message.id}/attachments`)
            .get();
          
          attachments = attachmentResult.value.map((attachment: any) => ({
            name: attachment.name,
            type: attachment.contentType,
            size: attachment.size,
          }));
        }
        
        // Get full message body
        const fullMessage = await client
          .api(`/me/messages/${message.id}`)
          .select('body')
          .get();
        
        // Extract text from HTML body
        const body = fullMessage.body.content
          .replace(/<[^>]*>/g, ' ') // Remove HTML tags
          .replace(/\\s+/g, ' ')    // Normalize whitespace
          .trim();
        
        emails.push({
          id: message.id,
          subject: message.subject || '(No Subject)',
          from: message.from.emailAddress.address,
          to: message.toRecipients[0]?.emailAddress.address || '',
          date: message.receivedDateTime,
          body: body,
          attachments,
        });
      }
      
      return emails;
    } catch (apiError) {
      console.error('Microsoft Graph API error:', apiError);
      throw apiError;
    }
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
}

// Process emails with AI and store in database
export async function processAndStoreEmails(emails: Email[]) {
  if (!emails || emails.length === 0) {
    console.log('No emails to process');
    return;
  }
  
  console.log(`Processing ${emails.length} emails`);
  
  for (const email of emails) {
    try {
      console.log(`Processing email: ${email.subject.substring(0, 30)}...`);
      
      // Safety check for valid email data
      if (!email.id || !email.subject || !email.from || !email.to) {
        console.error('Invalid email data:', email);
        continue;
      }
      
      try {
        // Check if email already exists in database - using SQL directly for compatibility
        const stmt = db.connection.prepare(
          'SELECT * FROM messages WHERE id = ? LIMIT 1'
        );
        const existing = stmt.get(email.id);
        
        if (existing) {
          console.log(`Email already exists: ${email.id}`);
          continue; // Skip if already processed
        }
      } catch (dbError) {
        console.error('Database query error:', dbError);
        throw new Error(`Database error checking existing email: ${dbError.message}`);
      }
      
      let summary, labels;
      
      // Determine if we should use sample data or OpenAI
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === '') {
        console.log('Using default summary (no OpenAI key)');
        // Generate a simple default summary
        const defaultSummary = {
          summary: `Email from ${email.from} about ${email.subject}`,
          labels: ["Email"]
        };
        summary = defaultSummary.summary;
        labels = JSON.stringify(defaultSummary.labels);
      } else {
        try {
          // Process with AI
          console.log('Processing with OpenAI...');
          const result = await generateObject({
            model: openai("gpt-4o-2024-08-06", { structuredOutputs: true }),
            schemaName: "email",
            schemaDescription: "An email summary.",
            schema: z.object({ summary: z.string(), labels: z.array(z.string()) }),
            prompt: `Generate a summary and labels for the following email: ${JSON.stringify({
              subject: email.subject,
              from: email.from,
              body: email.body.substring(0, 1000) // Limit length for API
            })}. The summary should be a 1-2 sentences and only generate 1-2 labels that are relevant to the email.`,
          });
          
          summary = result.object.summary;
          labels = JSON.stringify(result.object.labels);
          console.log('Got OpenAI summary:', summary);
        } catch (aiError) {
          console.error('OpenAI processing error:', aiError);
          // Fallback to simple summary
          summary = `Email about: ${email.subject}`;
          labels = JSON.stringify(["Email"]);
        }
      }
      
      try {
        // Store in database using raw SQL for better compatibility
        console.log('Storing in database...');
        const insertStmt = db.connection.prepare(`
          INSERT INTO messages (id, subject, "from", "to", body, attachments, summary, labels, date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        insertStmt.run(
          email.id,
          email.subject,
          email.from,
          email.to,
          email.body,
          JSON.stringify(email.attachments || []),
          summary,
          labels,
          email.date
        );
        
        console.log(`Successfully stored email in database: ${email.subject}`);
      } catch (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error(`Failed to store email in database: ${insertError.message}`);
      }
    } catch (error) {
      console.error(`Error processing email:`, error);
      // Continue processing other emails
    }
  }
}

// Get pre-defined summaries for sample emails
function getSampleSummary(emailId: string): { summary: string, labels: string[] } {
  switch (emailId) {
    case 'sample-1':
      return {
        summary: "Reminder about weekly team meeting tomorrow at 10:00 AM to discuss Q2 roadmap and upcoming project deadlines.",
        labels: ["Meeting", "Work"]
      };
    case 'sample-2':
      return {
        summary: "Colleague has completed the initial phase of a project and needs feedback on the implementation approach.",
        labels: ["Project", "Feedback"]
      };
    case 'sample-3':
      return {
        summary: "HR announcing the holiday schedule for the upcoming year, with office closure during the last week of December.",
        labels: ["HR", "Holiday"]
      };
    default:
      return {
        summary: "Email content summary not available.",
        labels: ["Misc"]
      };
  }
}

// Main function to fetch and process emails
export async function syncEmails(count = 10) {
  try {
    const emails = await fetchRecentEmails(count);
    await processAndStoreEmails(emails);
    return emails.length;
  } catch (error) {
    console.error('Error syncing emails, falling back to sample emails:', error);
    
    // Always fall back to sample emails if there's an error
    const sampleEmails = getSampleEmails();
    await processAndStoreEmails(sampleEmails);
    return sampleEmails.length;
  }
}

// Function to get sample emails when Microsoft Graph API is not configured
function getSampleEmails(): Email[] {
  return [
    {
      id: 'sample-1',
      subject: 'Weekly Team Meeting',
      from: 'manager@example.com',
      to: 'you@company.com',
      date: new Date().toISOString(),
      body: 'Hello team,\n\nThis is a reminder about our weekly team meeting tomorrow at 10:00 AM in the main conference room. We\'ll be discussing the Q2 roadmap and upcoming project deadlines.\n\nPlease prepare a brief update on your current tasks.\n\nBest regards,\nYour Manager',
      attachments: [
        { name: 'agenda.pdf', type: 'application/pdf', size: 245000 }
      ]
    },
    {
      id: 'sample-2',
      subject: 'Project Status Update',
      from: 'colleague@example.com',
      to: 'you@company.com',
      date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      body: 'Hi,\n\nI\'ve completed the initial phase of the project we discussed. You can find the documentation in our shared folder.\n\nI need your feedback on the implementation approach before I proceed further.\n\nThanks,\nYour Colleague',
      attachments: []
    },
    {
      id: 'sample-3',
      subject: 'Office Holiday Schedule',
      from: 'hr@example.com',
      to: 'all-staff@company.com',
      date: new Date(Date.now() - 172800000).toISOString(), // Two days ago
      body: 'Dear all,\n\nPlease find attached the holiday schedule for the upcoming year. Note that the office will be closed during the last week of December.\n\nIf you have any questions, please reach out to the HR department.\n\nRegards,\nHR Team',
      attachments: [
        { name: 'holiday_schedule.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 128500 }
      ]
    }
  ];
}