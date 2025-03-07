import { NextRequest, NextResponse } from "next/server";
import { initializePostgresSchema } from "~/lib/db/pg-init";

/**
 * POST /api/system/init-db
 * 
 * Initialize the database schema
 * This is useful for first-time setup or after schema changes
 */
export async function POST(request: NextRequest) {
  try {
    // Check for a secret key to prevent unauthorized access
    const authHeader = request.headers.get('Authorization');
    const secretKey = process.env.DB_INIT_SECRET || 'client-reports-init-key';
    
    if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
      return NextResponse.json(
        { 
          error: "Unauthorized",
          message: "Invalid or missing authorization"
        },
        { status: 401 }
      );
    }
    
    // Initialize the database schema
    const success = await initializePostgresSchema();
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: "Database schema initialized successfully"
      });
    } else {
      return NextResponse.json(
        { 
          error: "Initialization failed",
          message: "Failed to initialize database schema"
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Init DB API - Error:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to initialize database",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 