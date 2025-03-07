import { db } from "~/lib/db";
import { processEmailEmbeddings } from "./email-embeddings";
import { generateEmailSummary } from "./email-summarizer";
import { getClientEmails } from "./email-fetcher";

/**
 * Background processor for handling email-related tasks
 * This is a simple implementation that can be replaced with a more robust solution
 * like Bull, Celery, or a serverless queue system in production
 */

// Queue for background tasks
type Task = {
  id: string;
  type: 'generate_embeddings' | 'summarize_emails' | 'process_new_emails' | 'process_client_emails';
  params: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
  result?: any;
  error?: string;
};

// Task status tracking
interface TaskProgress {
  taskId: string;
  clientId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  totalEmails: number;
  processedEmails: number;
  startTime: number;
  lastUpdateTime: number;
  error?: string;
}

let taskQueue: Task[] = [];
let isProcessing = false;
let taskProgressMap: Record<string, TaskProgress> = {};

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
  
  // Initialize task progress tracking for client email processing
  if (type === 'process_client_emails' && params.clientId) {
    taskProgressMap[taskId] = {
      taskId,
      clientId: params.clientId,
      status: 'pending',
      progress: 0,
      totalEmails: 0,
      processedEmails: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now()
    };
  }
  
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
 * Get detailed progress for a client email processing task
 */
export function getClientEmailProcessingStatus(taskId: string): TaskProgress | null {
  return taskProgressMap[taskId] || null;
}

/**
 * Get the latest processing status for a client
 */
export function getLatestClientProcessingStatus(clientId: string): TaskProgress | null {
  const clientTasks = Object.values(taskProgressMap)
    .filter(progress => progress.clientId === clientId)
    .sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
  
  return clientTasks.length > 0 ? clientTasks[0] : null;
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
        result = await processNewEmails(
          task.params.limit || 20, 
          task.params.emailIds || undefined
        );
        break;
        
      case 'process_client_emails':
        result = await processClientEmails(task.id, task.params);
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
    
    // Update progress tracking for client email processing
    if (task.type === 'process_client_emails' && taskProgressMap[task.id]) {
      taskProgressMap[task.id].status = 'failed';
      taskProgressMap[task.id].error = error instanceof Error ? error.message : String(error);
      taskProgressMap[task.id].lastUpdateTime = Date.now();
    }
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
  
  // Clean up progress tracking for old tasks
  Object.keys(taskProgressMap).forEach(taskId => {
    const progress = taskProgressMap[taskId];
    if (progress.lastUpdateTime < thirtyMinutesAgo && progress.status !== 'processing') {
      delete taskProgressMap[taskId];
    }
  });
  
  // Process next task if available
  if (taskQueue.some(t => t.status === 'pending')) {
    processNextTask();
  }
}

/**
 * Process emails for a specific client and date range
 */
async function processClientEmails(taskId: string, params: any) {
  try {
    console.log('BackgroundProcessor - Processing client emails with params:', params);
    
    const { 
      clientId, 
      clientName,
      clientDomains = [], 
      clientEmails = [], 
      startDate, 
      endDate, 
      maxResults = 1000 
    } = params;
    
    // Update progress tracking
    if (taskProgressMap[taskId]) {
      taskProgressMap[taskId].status = 'processing';
      taskProgressMap[taskId].lastUpdateTime = Date.now();
    }
    
    // Normalize date strings
    const startDateObj = new Date(startDate);
    startDateObj.setUTCHours(0, 0, 0, 0);
    const startDateIso = startDateObj.toISOString();
    
    const endDateObj = new Date(endDate);
    endDateObj.setUTCHours(23, 59, 59, 999);
    const endDateIso = endDateObj.toISOString();
    
    // Fetch emails for the client
    console.log(`BackgroundProcessor - Fetching emails for client ${clientName} (${clientId})`);
    console.log(`BackgroundProcessor - Date range: ${startDateIso} to ${endDateIso}`);
    
    const emailResult = await getClientEmails({
      startDate: startDateIso,
      endDate: endDateIso,
      clientDomains,
      clientEmails,
      maxResults
    });
    
    const emails = emailResult.emails || [];
    console.log(`BackgroundProcessor - Found ${emails.length} emails for client ${clientName}`);
    
    // Update progress tracking
    if (taskProgressMap[taskId]) {
      taskProgressMap[taskId].totalEmails = emails.length;
      taskProgressMap[taskId].progress = 10; // 10% progress after fetching emails
      taskProgressMap[taskId].lastUpdateTime = Date.now();
    }
    
    // Process emails in batches to generate summaries and embeddings
    const batchSize = 20;
    let processedCount = 0;
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchIds = batch.map(email => email.id);
      
      console.log(`BackgroundProcessor - Processing batch ${i/batchSize + 1} of ${Math.ceil(emails.length/batchSize)}`);
      
      try {
        // Process this batch of emails
        await processNewEmails(batchSize, batchIds);
        
        processedCount += batch.length;
        
        // Update progress tracking
        if (taskProgressMap[taskId]) {
          taskProgressMap[taskId].processedEmails = processedCount;
          taskProgressMap[taskId].progress = Math.min(
            10 + Math.floor((processedCount / emails.length) * 90), 
            100
          );
          taskProgressMap[taskId].lastUpdateTime = Date.now();
        }
        
        // Small delay between batches to avoid overloading the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (batchError) {
        console.error(`BackgroundProcessor - Error processing batch ${i/batchSize + 1}:`, batchError);
      }
    }
    
    // Mark task as completed
    if (taskProgressMap[taskId]) {
      taskProgressMap[taskId].status = 'completed';
      taskProgressMap[taskId].progress = 100;
      taskProgressMap[taskId].lastUpdateTime = Date.now();
    }
    
    return {
      success: true,
      clientId,
      clientName,
      totalEmails: emails.length,
      processedEmails: processedCount,
      dateRange: {
        startDate: startDateIso,
        endDate: endDateIso
      }
    };
  } catch (error) {
    console.error('BackgroundProcessor - Error processing client emails:', error);
    return { success: false, error: String(error) };
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
      SELECT id, subject, "from", "to", date, body
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
async function processNewEmails(limit = 20, emailIds?: string[]) {
  try {
    console.log('BackgroundProcessor - Processing new emails', 
      emailIds ? `(specific IDs: ${emailIds.length})` : `(limit: ${limit})`);
    
    if (emailIds && emailIds.length > 0) {
      // Process specific emails by IDs
      console.log(`BackgroundProcessor - Processing specific emails: ${emailIds.slice(0, 3).join(', ')}${emailIds.length > 3 ? '...' : ''}`);
      
      // Generate summaries for these specific emails
      for (const emailId of emailIds) {
        try {
          // Check if the email needs a summary
          const emailStmt = db.connection.prepare(`
            SELECT id, subject, "from", "to", date, body
            FROM messages
            WHERE id = ? AND (summary IS NULL OR summary = '')
          `);
          
          const email = emailStmt.get(emailId);
          
          if (email) {
            // Generate and save summary
            const summary = await generateEmailSummary(email);
            
            if (summary) {
              const updateStmt = db.connection.prepare(`
                UPDATE messages
                SET summary = ?, updated_at = unixepoch()
                WHERE id = ?
              `);
              
              updateStmt.run(summary, emailId);
              console.log(`BackgroundProcessor - Generated summary for email ${emailId}`);
            }
          }
        } catch (err) {
          console.error(`BackgroundProcessor - Error processing specific email ${emailId}:`, err);
        }
      }
      
      // Generate embeddings using the existing process
      // The processEmailEmbeddings function will pick up these emails
      // in its next batch since they're marked as needing processing
      const embeddingResult = await processEmailEmbeddings(Math.min(emailIds.length, limit));
      
      return {
        success: true,
        processedIds: emailIds,
        embeddings: embeddingResult
      };
    } else {
      // Standard processing using the limit
      // First, generate summaries for emails that need them
      const summaryResult = await processPendingSummaries(limit);
      
      // Then, generate embeddings for emails that need them
      const embeddingResult = await processEmailEmbeddings(limit);
      
      return {
        success: true,
        summaries: summaryResult,
        embeddings: embeddingResult
      };
    }
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