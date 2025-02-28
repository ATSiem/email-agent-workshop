import { db } from "~/lib/db";
import { processEmailEmbeddings } from "./email-embeddings";
import { generateEmailSummary } from "./email-summarizer";

/**
 * Background processor for handling email-related tasks
 * This is a simple implementation that can be replaced with a more robust solution
 * like Bull, Celery, or a serverless queue system in production
 */

// Queue for background tasks
type Task = {
  id: string;
  type: 'generate_embeddings' | 'summarize_emails' | 'process_new_emails';
  params: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
  result?: any;
  error?: string;
};

let taskQueue: Task[] = [];
let isProcessing = false;

/**
 * Add a task to the background queue
 */
export function queueBackgroundTask(
  type: Task['type'], 
  params: any = {}
): string {
  const taskId = crypto.randomUUID();
  const task: Task = {
    id: taskId,
    type,
    params,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  taskQueue.push(task);
  console.log(`BackgroundProcessor - Task queued: ${type} (${taskId})`);
  
  // Start processing if not already running
  if (!isProcessing) {
    processNextTask();
  }
  
  return taskId;
}

/**
 * Get status of a task by ID
 */
export function getTaskStatus(taskId: string): Task | null {
  return taskQueue.find(task => task.id === taskId) || null;
}

/**
 * Process the next task in the queue
 */
async function processNextTask() {
  if (taskQueue.length === 0 || isProcessing) {
    return;
  }
  
  isProcessing = true;
  const task = taskQueue.find(t => t.status === 'pending');
  
  if (!task) {
    isProcessing = false;
    return;
  }
  
  console.log(`BackgroundProcessor - Processing task: ${task.type} (${task.id})`);
  task.status = 'processing';
  task.updatedAt = Date.now();
  
  try {
    let result;
    
    switch (task.type) {
      case 'generate_embeddings':
        result = await processEmailEmbeddings(task.params.limit || 50);
        break;
        
      case 'summarize_emails':
        result = await processPendingSummaries(task.params.limit || 20);
        break;
        
      case 'process_new_emails':
        result = await processNewEmails(task.params.limit || 20);
        break;
        
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
    
    task.status = 'completed';
    task.result = result;
  } catch (error) {
    console.error(`BackgroundProcessor - Task failed: ${task.type} (${task.id})`, error);
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : String(error);
  }
  
  task.updatedAt = Date.now();
  isProcessing = false;
  
  // Clean up completed tasks older than 30 minutes
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  taskQueue = taskQueue.filter(t => 
    t.status === 'pending' || 
    t.status === 'processing' || 
    t.updatedAt > thirtyMinutesAgo
  );
  
  // Process next task if available
  if (taskQueue.some(t => t.status === 'pending')) {
    processNextTask();
  }
}

/**
 * Process emails that need summaries
 */
async function processPendingSummaries(limit = 20) {
  try {
    console.log('BackgroundProcessor - Processing pending summaries');
    
    // Find emails that need summaries (where summary is empty or null)
    const stmt = db.connection.prepare(`
      SELECT id, subject, from, to, date, body
      FROM messages
      WHERE summary IS NULL OR summary = ''
      LIMIT ?
    `);
    
    const emails = stmt.all(limit);
    console.log(`BackgroundProcessor - Found ${emails.length} emails needing summaries`);
    
    if (emails.length === 0) {
      return { success: true, processed: 0 };
    }
    
    let processedCount = 0;
    
    // Process emails in sequence to avoid rate limits
    for (const email of emails) {
      try {
        const summary = await generateEmailSummary(email);
        
        if (summary) {
          const updateStmt = db.connection.prepare(`
            UPDATE messages
            SET summary = ?, updated_at = unixepoch()
            WHERE id = ?
          `);
          
          updateStmt.run(summary, email.id);
          processedCount++;
        }
      } catch (err) {
        console.error(`BackgroundProcessor - Error summarizing email ${email.id}:`, err);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`BackgroundProcessor - Successfully summarized ${processedCount} emails`);
    return { success: true, processed: processedCount };
  } catch (error) {
    console.error('BackgroundProcessor - Error processing summaries:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Process new emails (both summary and embeddings)
 */
async function processNewEmails(limit = 20) {
  try {
    console.log('BackgroundProcessor - Processing new emails');
    
    // First, generate summaries for emails that need them
    const summaryResult = await processPendingSummaries(limit);
    
    // Then, generate embeddings for emails that need them
    const embeddingResult = await processEmailEmbeddings(limit);
    
    return {
      success: true,
      summaries: summaryResult,
      embeddings: embeddingResult
    };
  } catch (error) {
    console.error('BackgroundProcessor - Error processing new emails:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Start background processing
 * This can be called at application startup
 */
export function startBackgroundProcessing() {
  console.log('BackgroundProcessor - Starting background processing');
  
  // Verify we're in a server environment
  if (typeof window !== 'undefined') {
    console.error('BackgroundProcessor - Cannot run in browser environment');
    return false;
  }
  
  try {
    // Initial processing of any pending tasks
    processNextTask();
    
    // Schedule periodic processing
    const pollInterval = 5 * 60 * 1000; // 5 minutes
    
    setInterval(() => {
      queueBackgroundTask('process_new_emails', { limit: 50 });
    }, pollInterval);
    
    // Queue initial task
    queueBackgroundTask('process_new_emails', { limit: 50 });
    
    return true;
  } catch (error) {
    console.error('BackgroundProcessor - Error starting background processing:', error);
    return false;
  }
}