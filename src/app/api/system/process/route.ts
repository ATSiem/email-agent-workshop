import { NextResponse } from "next/server";
import { queueBackgroundTask, getTaskStatus } from "~/lib/client-reports/background-processor";

// API endpoint to trigger background processing or check status
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, taskType, params, taskId } = body;

    if (action === 'start') {
      // Validate taskType
      if (!taskType || !['generate_embeddings', 'summarize_emails', 'process_new_emails'].includes(taskType)) {
        return NextResponse.json(
          { error: "Invalid task type" },
          { status: 400 }
        );
      }

      // Queue the background task
      const id = queueBackgroundTask(taskType, params || {});
      
      return NextResponse.json({
        success: true,
        taskId: id,
        message: `Background task ${taskType} queued with ID: ${id}`
      });
    } 
    else if (action === 'status') {
      // Check task status
      if (!taskId) {
        return NextResponse.json(
          { error: "Task ID is required" },
          { status: 400 }
        );
      }
      
      const status = getTaskStatus(taskId);
      
      if (!status) {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        task: status
      });
    }
    else {
      return NextResponse.json(
        { error: "Invalid action. Use 'start' or 'status'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in background processing API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}