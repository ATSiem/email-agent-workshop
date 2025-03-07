import { NextResponse } from "next/server";
import { db } from "~/lib/db";

export async function GET(request: Request) {
  try {
    console.log('GET /api/test-db - Testing database connection');
    
    // Test database connection
    let dbStatus = 'unknown';
    let error = null;
    let clientCount = 0;
    
    try {
      // Check if db.connection exists
      if (!db.connection) {
        throw new Error('Database connection not initialized');
      }
      
      // Try to execute a simple query
      const stmt = db.connection.prepare('SELECT COUNT(*) as count FROM clients');
      const result = stmt.get();
      clientCount = result ? result.count : 0;
      dbStatus = 'connected';
    } catch (dbError) {
      console.error('Database connection test failed:', dbError);
      dbStatus = 'error';
      error = dbError.message;
    }
    
    // Return database status
    return NextResponse.json({
      status: dbStatus,
      error,
      clientCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in test-db endpoint:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error.message || 'Unknown error',
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 