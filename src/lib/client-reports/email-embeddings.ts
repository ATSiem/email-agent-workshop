import { openai } from "@ai-sdk/openai";
import { db } from "~/lib/db";
import { messages } from "~/lib/db/schema";
import { eq } from "drizzle-orm";

import { getCurrentModelSpec } from "~/lib/ai/model-info";
import { env } from "~/lib/env";

// Initialize OpenAI - make sure API key is set
if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY is not set in the environment");
}

// Constants
const BATCH_SIZE = env.EMBEDDING_BATCH_SIZE;

// Get embedding dimension from the model spec
const embeddingModel = getCurrentModelSpec('embedding');
const EMBEDDING_DIMENSION = embeddingModel.embeddingDimension || 1536; // Default to 1536 as fallback

console.log(`EmailEmbeddings - Using model: ${embeddingModel.modelId}, dimension: ${EMBEDDING_DIMENSION}`)

/**
 * Generate and store embeddings for emails that haven't been processed yet
 * @param limit Maximum number of emails to process (default: 200, or configurable via env)
 */
export async function processEmailEmbeddings(limit = process.env.EMAIL_EMBEDDING_BATCH_SIZE ? 
  parseInt(process.env.EMAIL_EMBEDDING_BATCH_SIZE) : 200) {
  try {
    console.log('EmailEmbeddings - Starting embedding generation for unprocessed emails');
    
    // Get emails that need embeddings
    const stmt = db.connection.prepare(`
      SELECT id, subject, body, summary 
      FROM messages 
      WHERE processed_for_vector = 0 OR embedding IS NULL
      LIMIT ?
    `);
    
    const unprocessedEmails = stmt.all(limit);
    console.log(`EmailEmbeddings - Found ${unprocessedEmails.length} emails to process`);
    
    if (unprocessedEmails.length === 0) {
      return { success: true, processed: 0 };
    }
    
    // Process in batches to avoid rate limits
    let processedCount = 0;
    
    for (let i = 0; i < unprocessedEmails.length; i += BATCH_SIZE) {
      const batch = unprocessedEmails.slice(i, i + BATCH_SIZE);
      console.log(`EmailEmbeddings - Processing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(unprocessedEmails.length/BATCH_SIZE)}`);
      
      await Promise.all(batch.map(async (email) => {
        try {
          // Generate embedding using OpenAI
          const embedding = await generateEmbedding(email);
          
          // Store the embedding in the database
          if (embedding) {
            const updateStmt = db.connection.prepare(`
              UPDATE messages 
              SET embedding = ?, processed_for_vector = 1, updated_at = unixepoch()
              WHERE id = ?
            `);
            
            updateStmt.run(JSON.stringify(embedding), email.id);
            processedCount++;
          }
        } catch (err) {
          console.error(`EmailEmbeddings - Error processing email ${email.id}:`, err);
        }
      }));
      
      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < unprocessedEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`EmailEmbeddings - Successfully processed ${processedCount} emails`);
    return { success: true, processed: processedCount };
  } catch (error) {
    console.error('EmailEmbeddings - Error processing email embeddings:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate embedding for a single email using the OpenAI API directly
 */
async function generateEmbedding(email: { id: string, subject: string, body: string, summary: string }) {
  try {
    // Combine relevant fields for embedding
    const content = [
      `Subject: ${email.subject}`,
      `Summary: ${email.summary || ''}`,
      `Body: ${email.body}`
    ].join('\n');
    
    // Truncate to avoid token limits (ada-002 has max 8191 tokens)
    const truncatedContent = content.slice(0, 6000);
    
    // Create API request directly with fetch
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: truncatedContent,
        dimensions: EMBEDDING_DIMENSION
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    
    const result = await response.json();
    return result.data[0].embedding;
  } catch (err) {
    console.error(`EmailEmbeddings - Error generating embedding for email ${email.id}:`, err);
    return null;
  }
}

/**
 * Find similar emails using vector similarity search
 */
export async function findSimilarEmails(query: string, options: {
  limit?: number;
  startDate?: string;
  endDate?: string;
  clientDomains?: string[];
  clientEmails?: string[];
}) {
  try {
    const {
      limit = 10,
      startDate,
      endDate,
      clientDomains = [],
      clientEmails = []
    } = options;

    // Check if cc and bcc columns exist in the database
    const columnInfo = await db.connection.get('PRAGMA table_info(messages)');
    const hasCcBccColumns = columnInfo.some((column: any) => column.name === 'cc') && 
                           columnInfo.some((column: any) => column.name === 'bcc');
    
    console.log(`EmailEmbeddings - Vector search has cc/bcc columns: ${hasCcBccColumns}`);
    
    // If columns don't exist, log a warning but continue
    if (!hasCcBccColumns) {
      console.warn('EmailEmbeddings - CC and BCC columns not found in messages table. Some email filtering may be limited.');
    }
    
    // Get user email for filtering
    const userEmail = await getUserEmail();
    console.log(`EmailEmbeddings - User email for vector search: ${userEmail}`);
    
    // Build domain-based conditions
    let domainConditions = '';
    if (clientDomains.length > 0) {
      const domainFilters = clientDomains.map((domain) => {
        const sanitizedDomain = domain.replace(/'/g, "''");  // SQL escape single quotes
        return `("from" LIKE '%@${sanitizedDomain}%' OR "from" LIKE '%@%.${sanitizedDomain}%' OR "to" LIKE '%@${sanitizedDomain}%' OR "to" LIKE '%@%.${sanitizedDomain}%'${hasCcBccColumns ? ` OR "cc" LIKE '%@${sanitizedDomain}%' OR "cc" LIKE '%@%.${sanitizedDomain}%' OR "bcc" LIKE '%@${sanitizedDomain}%' OR "bcc" LIKE '%@%.${sanitizedDomain}%'` : ''})`;
      }).join(' OR ');
      
      if (domainFilters) {
        domainConditions = ` OR (${domainFilters})`;
      }
    }
    
    // Build client email conditions with checks against both FROM and TO fields
    const emailConditions = [];
    
    if (userEmail) {
      const sanitizedUserEmail = userEmail.replace(/'/g, "''");  // SQL escape single quotes
      
      // Add conditions for each client email
      clientEmails.forEach(clientEmail => {
        const sanitizedClientEmail = clientEmail.replace(/'/g, "''");  // SQL escape single quotes
        if (hasCcBccColumns) {
          // User to client
          emailConditions.push(`("from" = '${sanitizedUserEmail}' AND ("to" = '${sanitizedClientEmail}' OR "cc" LIKE '%${sanitizedClientEmail}%' OR "bcc" LIKE '%${sanitizedClientEmail}%'))`);
          // Client to user
          emailConditions.push(`("from" = '${sanitizedClientEmail}' AND ("to" = '${sanitizedUserEmail}' OR "cc" LIKE '%${sanitizedUserEmail}%' OR "bcc" LIKE '%${sanitizedUserEmail}%'))`);
        } else {
          // User to client
          emailConditions.push(`("from" = '${sanitizedUserEmail}' AND "to" = '${sanitizedClientEmail}')`);
          // Client to user
          emailConditions.push(`("from" = '${sanitizedClientEmail}' AND "to" = '${sanitizedUserEmail}')`);
        }
      });
    }
    
    // Combine all email conditions
    const emailFilter = emailConditions.length > 0 ? `(${emailConditions.join(' OR ')})` : '1=1'; // Default condition that's always true
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbeddingForQuery(query);
    if (!queryEmbedding) {
      console.error('EmailEmbeddings - Failed to generate embedding for query');
      return [];
    }
    
    // Convert embedding to string for SQL
    const queryEmbeddingStr = JSON.stringify(queryEmbedding);
    
    // Build date conditions
    const dateConditions = [];
    if (startDate) {
      const startDateStr = new Date(startDate).toISOString().split('T')[0];
      dateConditions.push(`date >= '${startDateStr}'`);
    }
    if (endDate) {
      const endDateStr = new Date(endDate).toISOString().split('T')[0];
      dateConditions.push(`date <= '${endDateStr}'`);
    }
    
    // Combine date conditions
    const dateFilter = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : '';
    
    // Build the SQL query for vector search
    const vectorSearchQuery = `
      SELECT id, subject, from, to, date, body, summary, 
        json_extract(embedding, '$') as embedding_json,
        (SELECT cosine_similarity(json_extract(embedding, '$'), json('${queryEmbeddingStr}'))) as similarity
      FROM messages
      WHERE embedding IS NOT NULL ${dateFilter}
        AND (${emailFilter}${domainConditions})
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;
    
    console.log('EmailEmbeddings - Vector search query:', vectorSearchQuery);
    
    // Execute the query
    const results = await db.connection.all(vectorSearchQuery);
    
    // Process results
    return results.map((result: any) => ({
      ...result,
      embedding: JSON.parse(result.embedding_json || '[]'),
      source: 'vector_search'
    }));
  } catch (error) {
    console.error('EmailEmbeddings - Error finding similar emails:', error);
    return [];
  }
}

/**
 * Generate embedding for a search query using the OpenAI API directly
 */
async function generateEmbeddingForQuery(query: string) {
  try {
    // Create API request directly with fetch
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: query,
        dimensions: EMBEDDING_DIMENSION
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    
    const result = await response.json();
    return result.data[0].embedding;
  } catch (err) {
    console.error('EmailEmbeddings - Error generating embedding for query:', err);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}