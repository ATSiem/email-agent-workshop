import { NextResponse } from "next/server";
import { queueBackgroundTask } from "~/lib/client-reports/background-processor";
import { processEmailEmbeddings } from "~/lib/client-reports/email-embeddings";

// API endpoint to trigger embedding processing
export async function POST(request: Request) {
  try {
    // Queue the background task for generating embeddings
    const taskId = queueBackgroundTask('generate_embeddings', { limit: 500 });
    
    // Also trigger immediate processing for a smaller batch
    const immediateResult = await processEmailEmbeddings(50);
    
    return NextResponse.json({
      success: true,
      taskId: taskId,
      message: `Embedding generation queued with ID: ${taskId}`,
      immediateResult: {
        processed: immediateResult.processed,
        total: immediateResult.total
      }
    });
  } catch (error) {
    console.error("Error in embedding processing API:", error);
    return NextResponse.json(
      { error: "Failed to process embeddings", details: String(error) },
      { status: 500 }
    );
  }
} 