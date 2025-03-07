import { NextRequest, NextResponse } from "next/server";
import { getClientEmailProcessingStatus, getLatestClientProcessingStatus } from "~/lib/client-reports/background-processor";
import { getUserAccessToken } from "~/lib/auth/microsoft";

/**
 * GET /api/system/process-status
 * 
 * Get the status of background email processing
 * Can be used to check if emails for a client have been processed
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    if (!accessToken) {
      accessToken = getUserAccessToken();
    }
    
    if (!accessToken) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Get parameters from query string
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const clientId = searchParams.get("clientId");
    
    if (!taskId && !clientId) {
      return NextResponse.json(
        { 
          error: "Missing parameters",
          message: "Either taskId or clientId must be provided"
        },
        { status: 400 }
      );
    }
    
    let status;
    
    if (taskId) {
      // Get status for a specific task
      status = getClientEmailProcessingStatus(taskId);
      
      if (!status) {
        return NextResponse.json(
          { 
            error: "Task not found",
            message: "The specified task could not be found or has expired"
          },
          { status: 404 }
        );
      }
    } else {
      // Get latest status for a client
      status = getLatestClientProcessingStatus(clientId);
      
      if (!status) {
        return NextResponse.json(
          { 
            found: false,
            message: "No processing tasks found for this client"
          }
        );
      }
    }
    
    return NextResponse.json({
      found: true,
      status: status.status,
      progress: status.progress,
      totalEmails: status.totalEmails,
      processedEmails: status.processedEmails,
      startTime: status.startTime,
      lastUpdateTime: status.lastUpdateTime,
      error: status.error,
      isComplete: status.status === 'completed',
      isProcessing: status.status === 'processing',
      isFailed: status.status === 'failed'
    });
  } catch (error) {
    console.error("ProcessStatus API - Error:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to get processing status",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 