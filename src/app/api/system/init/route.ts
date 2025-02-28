import { NextResponse } from "next/server";
import { startBackgroundProcessing } from "~/lib/client-reports/background-processor";

// Track initialization state
let initialized = false;

// API endpoint to initialize the background processing system
export async function GET() {
  try {
    if (!initialized) {
      console.log('API - Initializing background processor');
      startBackgroundProcessing();
      initialized = true;
      return NextResponse.json({ 
        success: true, 
        message: "Background processing initialized" 
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        message: "Background processing already initialized" 
      });
    }
  } catch (error) {
    console.error("Error initializing background processing:", error);
    return NextResponse.json(
      { error: "Failed to initialize background processing" },
      { status: 500 }
    );
  }
}