import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { env } from "~/lib/env";
import { getCurrentModelSpec } from "~/lib/ai/model-info";

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
}

/**
 * Generate a concise summary of an email
 * @param email The email to summarize
 * @returns A summary string or null if an error occurs
 */
export async function generateEmailSummary(email: Email): Promise<string | null> {
  try {
    // Handle empty body case
    if (!email.body || email.body.trim() === '') {
      return "No content to summarize";
    }
    
    // Truncate long emails to prevent token overflow
    const maxBodyLength = 4000;
    const truncatedBody = email.body.length > maxBodyLength 
      ? email.body.substring(0, maxBodyLength) + '... [truncated]' 
      : email.body;
    
    // Construct email content for summarization
    const emailContent = `
      From: ${email.from}
      To: ${email.to}
      Date: ${new Date(email.date).toLocaleString()}
      Subject: ${email.subject}
      
      ${truncatedBody}
    `;
    
    // Get model info
    const summaryModel = getCurrentModelSpec('summary');
    
    // Calculate optimal token limit (usually 150 is fine for summaries)
    const maxTokens = 150;
    
    // Call OpenAI API to generate summary
    const result = await generateObject({
      model: openai(env.OPENAI_SUMMARY_MODEL, { 
        structuredOutputs: true,
        maxTokens: maxTokens // Limit summary length
      }),
      schemaName: "emailSummary",
      schemaDescription: "A concise summary of an email",
      schema: z.object({ 
        summary: z.string(),
        keyPoints: z.array(z.string()).optional(),
        topicCategory: z.string().optional(),
      }),
      prompt: `Summarize this email concisely:
      
      ${emailContent}
      
      Focus on the main point, any action items or requests, and key information.
      The summary should be 1-2 sentences. Be factual and objective.`,
    });
    
    if (!result || !result.object) {
      throw new Error('No summary generated');
    }
    
    return result.object.summary;
  } catch (error) {
    console.error('EmailSummarizer - Error summarizing email:', error);
    return null;
  }
}

/**
 * Batch summarize emails
 * @param emails Array of emails to summarize
 * @returns Object with success and results
 */
export async function batchSummarizeEmails(emails: Email[]) {
  const results = [];
  let successCount = 0;
  
  for (const email of emails) {
    try {
      const summary = await generateEmailSummary(email);
      
      results.push({
        id: email.id,
        summary: summary,
        success: !!summary
      });
      
      if (summary) {
        successCount++;
      }
      
      // Small delay between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`EmailSummarizer - Error summarizing email ${email.id}:`, error);
      results.push({
        id: email.id,
        error: String(error),
        success: false
      });
    }
  }
  
  return {
    success: successCount > 0,
    total: emails.length,
    succeeded: successCount,
    failed: emails.length - successCount,
    results
  };
}