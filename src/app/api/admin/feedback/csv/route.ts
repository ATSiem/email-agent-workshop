import { NextResponse } from 'next/server';
import { db } from '~/lib/db';

export async function GET(request: Request) {
  try {
    // Check for authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'Please sign in with your Microsoft account to access this feature' },
        { status: 401 }
      );
    }
    
    // Token validation would typically happen here
    // For now, we're just checking if a token exists
    
    // Fetch all feedback data with client names (no limit)
    const stmt = db.connection.prepare(`
      SELECT 
        rf.id, 
        rf.report_id as reportId,
        rf.client_id as clientId,
        c.name as clientName,
        rf.rating,
        rf.feedback_text as feedbackText,
        rf.actions_taken as actionsTaken,
        rf.start_date as startDate,
        rf.end_date as endDate,
        rf.vector_search_used as vectorSearchUsed,
        rf.search_query as searchQuery,
        rf.email_count as emailCount,
        rf.copied_to_clipboard as copiedToClipboard,
        rf.generation_time_ms as generationTimeMs,
        rf.created_at as createdAt,
        rf.user_agent as userAgent
      FROM report_feedback rf
      LEFT JOIN clients c ON rf.client_id = c.id
      ORDER BY rf.created_at DESC
    `);
    
    const feedbackRows = stmt.all();
    
    // Process the data
    const feedback = feedbackRows.map(row => ({
      ...row,
      vectorSearchUsed: row.vectorSearchUsed === 1 ? 'Yes' : 'No',
      copiedToClipboard: row.copiedToClipboard === 1 ? 'Yes' : 'No',
      actionsTaken: row.actionsTaken ? JSON.parse(row.actionsTaken).join(', ') : '',
      createdAt: new Date(Number(row.createdAt) * 1000).toISOString(),
      feedbackText: row.feedbackText || ''
    }));
    
    // Define CSV headers
    const headers = [
      'ID',
      'Report ID',
      'Client ID',
      'Client Name',
      'Rating',
      'Feedback',
      'Actions Taken',
      'Start Date',
      'End Date',
      'Vector Search Used',
      'Search Query',
      'Email Count',
      'Copied To Clipboard',
      'Generation Time (ms)',
      'Created At',
      'User Agent'
    ];
    
    // Convert to CSV
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const item of feedback) {
      const values = [
        item.id,
        item.reportId,
        item.clientId || '',
        `"${(item.clientName || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        item.rating || '',
        `"${(item.feedbackText || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        `"${(item.actionsTaken || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        item.startDate,
        item.endDate,
        item.vectorSearchUsed,
        `"${(item.searchQuery || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        item.emailCount,
        item.copiedToClipboard,
        item.generationTimeMs || '',
        item.createdAt,
        `"${(item.userAgent || '').replace(/"/g, '""')}"` // Escape quotes in CSV
      ];
      
      csvRows.push(values.join(','));
    }
    
    const csvContent = csvRows.join('\n');
    
    // Set headers for CSV download
    const headers_response = new Headers();
    headers_response.set('Content-Type', 'text/csv');
    headers_response.set('Content-Disposition', 'attachment; filename="feedback_export.csv"');
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: headers_response,
    });
  } catch (error) {
    console.error('Error exporting feedback data to CSV:', error);
    
    return NextResponse.json(
      { error: 'Failed to export feedback data' },
      { status: 500 }
    );
  }
} 