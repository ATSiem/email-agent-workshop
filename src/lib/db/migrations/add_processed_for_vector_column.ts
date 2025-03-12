import { db } from '../index';

/**
 * Migration to add processed_for_vector column to the messages table
 */
export function addProcessedForVectorColumn() {
  try {
    console.log('Starting migration: Adding processed_for_vector column to messages table');
    
    // Check if column already exists
    // @ts-ignore - connection property is added in db/index.ts
    const tableInfo = db.connection.prepare('PRAGMA table_info(messages)').all();
    
    const columnNames = tableInfo.map(col => col.name);
    console.log('Current columns in messages table:', columnNames);
    
    // Add processed_for_vector column if it doesn't exist
    if (!columnNames.includes('processed_for_vector')) {
      console.log('Adding processed_for_vector column to messages table');
      // @ts-ignore - connection property is added in db/index.ts
      db.connection.prepare(`ALTER TABLE messages ADD COLUMN processed_for_vector INTEGER DEFAULT 0`).run();
      console.log('processed_for_vector column added successfully');
    } else {
      console.log('processed_for_vector column already exists in messages table');
    }
    
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  const result = addProcessedForVectorColumn();
  if (result) {
    console.log('Migration completed successfully');
    process.exit(0);
  } else {
    console.error('Migration failed');
    process.exit(1);
  }
} 