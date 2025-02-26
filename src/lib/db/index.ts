import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";
import { env } from "~/lib/env";
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
        labels TEXT NOT NULL
      )
    `);
    
    db = drizzle(sqlite, { schema });
    // @ts-ignore - adding the connection property for raw SQL access
    db.connection = sqlite;
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
