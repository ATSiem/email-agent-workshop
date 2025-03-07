import { sql } from '@vercel/postgres';
import { pgDb } from './postgres';
import * as schema from './pg-schema';

/**
 * Initialize the Postgres database schema
 * This function creates all necessary tables if they don't exist
 */
export async function initializePostgresSchema() {
  console.log('Initializing Postgres database schema...');
  
  try {
    // Create clients table
    await sql`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domains TEXT NOT NULL,
        emails TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `;
    
    // Create report_templates table
    await sql`
      CREATE TABLE IF NOT EXISTS report_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        client_id TEXT REFERENCES clients(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        example_prompt TEXT
      );
    `;
    
    // Create messages table
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        "from" TEXT NOT NULL,
        "to" TEXT NOT NULL,
        date TEXT NOT NULL,
        body TEXT NOT NULL,
        attachments TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        summary TEXT,
        labels TEXT NOT NULL,
        cc TEXT DEFAULT '',
        bcc TEXT DEFAULT ''
      );
    `;
    
    // Create report_feedback table
    await sql`
      CREATE TABLE IF NOT EXISTS report_feedback (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        client_id TEXT REFERENCES clients(id),
        rating INTEGER,
        feedback_text TEXT,
        actions_taken TEXT,
        start_date TEXT,
        end_date TEXT,
        vector_search_used INTEGER,
        search_query TEXT,
        email_count INTEGER,
        copied_to_clipboard INTEGER,
        generation_time_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        user_agent TEXT,
        ip_address TEXT
      );
    `;
    
    console.log('Postgres database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing Postgres database schema:', error);
    return false;
  }
} 