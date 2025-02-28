import { openai } from "@ai-sdk/openai";
import { db } from "~/lib/db";
import { messages } from "~/lib/db/schema";
import { eq } from "drizzle-orm";

import { getCurrentModelSpec } from "~/lib/ai/model-info";
import { env } from "~/lib/env";

// Constants
const BATCH_SIZE = env.EMBEDDING_BATCH_SIZE;

// Get embedding dimension from the model spec
const embeddingModel = getCurrentModelSpec('embedding');
const EMBEDDING_DIMENSION = embeddingModel.embeddingDimension || 1536; // Default to 1536 as fallback

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
 * Generate embedding for a single email
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
    
    // Generate embedding
    const response = await openai(env.OPENAI_EMBEDDING_MODEL).embeddings({
      input: truncatedContent,
      dimensions: EMBEDDING_DIMENSION,
    });
    
    return response.data[0].embedding;
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
    const { limit = 20, startDate, endDate, clientDomains = [], clientEmails = [] } = options;
    
    // Generate embedding for the query
    const embedding = await generateEmbeddingForQuery(query);
    if (!embedding) {
      throw new Error('Failed to generate embedding for query');
    }
    
    // Build SQL conditions for client domains and emails
    const conditions = [];
    
    if (startDate) {
      conditions.push(`date >= '${startDate}'`);
    }
    
    if (endDate) {
      conditions.push(`date <= '${endDate}'`);
    }
    
    // Build domain and email conditions
    const domainConditions = clientDomains.map(domain => 
      `("from" LIKE '%@${domain.replace(/'/g, "''")}' OR "to" LIKE '%@${domain.replace(/'/g, "''")}')`
    );
    
    const emailConditions = clientEmails.map(email => 
      `("from" = '${email.replace(/'/g, "''")}' OR "to" = '${email.replace(/'/g, "''")}')`
    );
    
    if (domainConditions.length > 0 || emailConditions.length > 0) {
      conditions.push(`(${[...domainConditions, ...emailConditions].join(' OR ')})`);
    }
    
    // Ensure we only search emails with embeddings
    conditions.push(`embedding IS NOT NULL`);
    
    // Build the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Execute vector similarity search using dot product
    // This requires embedding to be stored as properly formatted JSON arrays
    const query = `
      SELECT id, subject, from, to, date, body, summary, labels,
             json_array_length(json(embedding)) as embedding_dimension
      FROM messages
      ${whereClause}
      ORDER BY embedding_dimension ASC  -- Temporary sorting, will be refined with vector similarity
      LIMIT ?
    `;
    
    console.log('EmailEmbeddings - Vector search query:', query);
    
    const stmt = db.connection.prepare(query);
    const results = stmt.all(limit);
    
    // Calculate similarity scores in JS (SQLite doesn't support vector operations)
    const scoredResults = results.map(email => {
      const emailEmbedding = JSON.parse(email.embedding || '[]');
      const similarityScore = calculateCosineSimilarity(embedding, emailEmbedding);
      
      return {
        ...email,
        similarity_score: similarityScore
      };
    });
    
    // Sort by similarity score
    scoredResults.sort((a, b) => b.similarity_score - a.similarity_score);
    
    // Return top results
    return scoredResults.slice(0, limit);
  } catch (error) {
    console.error('EmailEmbeddings - Error in vector search:', error);
    return [];
  }
}

/**
 * Generate embedding for a search query
 */
async function generateEmbeddingForQuery(query: string) {
  try {
    const response = await openai(env.OPENAI_EMBEDDING_MODEL).embeddings({
      input: query,
      dimensions: EMBEDDING_DIMENSION,
    });
    
    return response.data[0].embedding;
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