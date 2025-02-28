import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/lib/db';
import { z } from 'zod';

// Schema for action tracking
const actionSchema = z.object({
  reportId: z.string(),
  action: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Get request data
    const data = await request.json();
    
    // Validate data
    const validatedData = actionSchema.parse(data);
    
    // Check if report feedback exists
    const checkStmt = db.connection.prepare(`
      SELECT id FROM report_feedback 
      WHERE report_id = ?
    `);
    
    const existingFeedback = checkStmt.get(validatedData.reportId);
    
    if (existingFeedback) {
      // Update existing feedback record with action
      if (validatedData.action === 'clipboard_copy') {
        const updateStmt = db.connection.prepare(`
          UPDATE report_feedback 
          SET copied_to_clipboard = 1
          WHERE report_id = ?
        `);
        updateStmt.run(validatedData.reportId);
      }
    } else {
      // Create a minimal feedback entry with just the action
      const insertStmt = db.connection.prepare(`
        INSERT INTO report_feedback (
          id, report_id, copied_to_clipboard, created_at
        ) VALUES (?, ?, ?, unixepoch())
      `);
      
      const feedbackId = crypto.randomUUID();
      
      insertStmt.run(
        feedbackId,
        validatedData.reportId,
        validatedData.action === 'clipboard_copy' ? 1 : 0
      );
    }
    
    // Return success
    return NextResponse.json({
      success: true,
      message: 'Action recorded'
    });
  } catch (error) {
    console.error('Error recording action:', error);
    
    // Still return success to prevent user disruption
    return NextResponse.json({
      success: true,
      message: 'Action tracked'
    });
  }
}