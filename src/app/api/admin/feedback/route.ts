import { NextResponse } from 'next/server';
import { db } from '~/lib/db';

export async function GET() {
  try {
    // Fetch feedback data with client names
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
      LIMIT 50
    `);
    
    const feedbackRows = stmt.all();
    
    // Process the data
    const feedback = feedbackRows.map(row => ({
      ...row,
      vectorSearchUsed: row.vectorSearchUsed === 1,
      copiedToClipboard: row.copiedToClipboard === 1,
      actionsTaken: row.actionsTaken ? JSON.parse(row.actionsTaken) : [],
    }));
    
    // Generate statistics
    const statsStmt = db.connection.prepare(`
      SELECT 
        COUNT(*) as totalReports,
        AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE NULL END) as averageRating,
        AVG(vector_search_used) as vectorSearchPercentage,
        AVG(generation_time_ms) as averageGenerationTime,
        SUM(CASE WHEN copied_to_clipboard = 1 THEN 1 ELSE 0 END) / CAST(COUNT(*) AS REAL) as clipboardCopyRate,
        SUM(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*) as feedbackSubmissionRate
      FROM report_feedback
    `);
    
    const statsRow = statsStmt.get();
    
    // Get most common actions
    const actionsStmt = db.connection.prepare(`
      SELECT actions_taken FROM report_feedback
      WHERE actions_taken IS NOT NULL AND actions_taken != '[]'
    `);
    
    const actionsRows = actionsStmt.all();
    
    // Count action frequencies
    const actionCounts = {};
    actionsRows.forEach(row => {
      try {
        const actions = JSON.parse(row.actions_taken);
        actions.forEach(action => {
          actionCounts[action] = (actionCounts[action] || 0) + 1;
        });
      } catch (e) {
        console.error('Error parsing actions:', e);
      }
    });
    
    // Sort actions by frequency
    const mostCommonActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const stats = {
      totalReports: statsRow.totalReports || 0,
      averageRating: statsRow.averageRating || 0,
      vectorSearchPercentage: statsRow.vectorSearchPercentage || 0,
      averageGenerationTime: statsRow.averageGenerationTime || 0,
      clipboardCopyRate: statsRow.clipboardCopyRate || 0,
      feedbackSubmissionRate: statsRow.feedbackSubmissionRate || 0,
      mostCommonActions,
    };
    
    return NextResponse.json({
      feedback,
      stats,
    });
  } catch (error) {
    console.error('Error fetching feedback data:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch feedback data' },
      { status: 500 }
    );
  }
}