import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";
import { env, isRenderFreeTier } from "~/lib/env";
export * from "drizzle-orm";

// For server-side database connection
let db: ReturnType<typeof drizzle>;

// This initialization will only run on the server
if (typeof window === 'undefined') {
  try {
    // Ensure directory exists
    const dbDir = dirname(env.SQLITE_DB_PATH);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Create SQLite connection
    const sqlite = new Database(env.SQLITE_DB_PATH);
    
    // Create tables if they don't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        "from" TEXT NOT NULL,
        "to" TEXT NOT NULL,
        date TEXT NOT NULL,
        body TEXT NOT NULL,
        attachments TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        summary TEXT NOT NULL,
        labels TEXT NOT NULL,
        cc TEXT DEFAULT '',
        bcc TEXT DEFAULT ''
      );
      
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domains TEXT NOT NULL,
        emails TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      
      CREATE TABLE IF NOT EXISTS report_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        client_id TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );
      
      CREATE TABLE IF NOT EXISTS report_feedback (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        client_id TEXT,
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
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        user_agent TEXT,
        ip_address TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );
    `);
    
    // Add SQLite functions for vector operations
    if (typeof sqlite.create_function === 'function') {
      sqlite.create_function("cosine_similarity", (vec1Str, vec2Str) => {
        try {
          // Parse the JSON strings to arrays
          const vec1 = JSON.parse(vec1Str);
          const vec2 = JSON.parse(vec2Str);
          
          if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
            console.error('Invalid vectors for cosine similarity', { 
              vec1Length: Array.isArray(vec1) ? vec1.length : 'not array', 
              vec2Length: Array.isArray(vec2) ? vec2.length : 'not array' 
            });
            return 0;
          }
          
          // Calculate dot product
          let dotProduct = 0;
          let mag1 = 0;
          let mag2 = 0;
          
          for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            mag1 += vec1[i] * vec1[i];
            mag2 += vec2[i] * vec2[i];
          }
          
          mag1 = Math.sqrt(mag1);
          mag2 = Math.sqrt(mag2);
          
          if (mag1 === 0 || mag2 === 0) return 0;
          
          return dotProduct / (mag1 * mag2);
        } catch (error) {
          console.error('Error calculating cosine similarity:', error);
          return 0;
        }
      });
    } else {
      if (isRenderFreeTier) {
        console.warn('SQLite create_function method not available on Render free tier - vector search functionality is disabled');
        console.warn('TODO: Upgrade to Render paid tier ($7/mo) to enable vector search functionality');
      } else {
        console.warn('SQLite create_function method not available - vector search functionality will be limited');
      }
    }
    
    db = drizzle(sqlite, { schema });
    // @ts-ignore - adding the connection property for raw SQL access
    db.connection = sqlite;
    
    // Run migrations synchronously during initialization
    try {
      // Export the db object first before importing migration-manager
      // This ensures db is fully initialized before migrations try to use it
      // Using dynamic import for migration manager to avoid circular dependency
      import('./migration-manager').then(({ runMigrations }) => {
        runMigrations().catch(err => {
          console.error('Failed to run database migrations:', err);
        });
      }).catch(error => {
        console.error('Error importing migration manager:', error);
      });
    } catch (error) {
      console.error('Error importing migration manager:', error);
    }
  } catch (error) {
    console.error("Database initialization error:", error);
    // Provide a fallback db object
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });
    // @ts-ignore - adding the connection property for raw SQL access
    db.connection = sqlite;
  }
} else {
  // Client-side fallback (this code won't actually run, but is needed for type checking)
  // @ts-ignore - This is to prevent client-side errors
  db = {} as ReturnType<typeof drizzle>;
}

export { db };
