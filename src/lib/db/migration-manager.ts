import { db } from './index';
import { addCcBccColumns } from './migrations/add_cc_bcc_columns';
import { addExamplePromptColumn } from './migrations/add_example_prompt_column';

/**
 * This function sets up and runs all database migrations
 */
export async function runMigrations() {
  console.log('Starting database migrations...');
  
  try {
    // Check if db is properly initialized
    if (!db || !db.connection) {
      console.error('Database not properly initialized for migrations');
      return false;
    }
    
    // Create migrations table if it doesn't exist
    db.connection.prepare(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run();
    
    // Check if migrations have been run
    const migrationsTable = db.connection.prepare('SELECT name FROM migrations').all();
    const appliedMigrations = new Set(migrationsTable.map(m => m.name));
    
    console.log('Already applied migrations:', Array.from(appliedMigrations));
    
    // Define migrations
    const migrations = [
      { name: 'add_cc_bcc_columns', fn: addCcBccColumns },
      { name: 'add_example_prompt_column', fn: addExamplePromptColumn }
    ];
    
    // Run migrations that haven't been applied yet
    for (const migration of migrations) {
      if (!appliedMigrations.has(migration.name)) {
        console.log(`Running migration: ${migration.name}`);
        const success = migration.fn();
        
        if (success) {
          // Record the migration as applied
          db.connection.prepare(`
            INSERT INTO migrations (name) VALUES (?)
          `).run(migration.name);
          
          console.log(`Migration ${migration.name} completed and recorded`);
        } else {
          console.error(`Migration ${migration.name} failed`);
          throw new Error(`Migration ${migration.name} failed`);
        }
      } else {
        console.log(`Skipping already applied migration: ${migration.name}`);
      }
    }
    
    console.log('All migrations completed');
    return true;
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error; // Re-throw to ensure calling code knows migrations failed
  }
} 