import { db } from '../index';

/**
 * Migration to add cc and bcc columns to the messages table
 */
export function addCcBccColumns() {
  try {
    console.log('Starting migration: Adding cc and bcc columns to messages table');
    
    // Check if columns already exist
    const tableInfo = db.connection.prepare('PRAGMA table_info(messages)').all();
    
    const columnNames = tableInfo.map(col => col.name);
    console.log('Current columns in messages table:', columnNames);
    
    // Add cc column if it doesn't exist
    if (!columnNames.includes('cc')) {
      console.log('Adding cc column to messages table');
      db.connection.prepare(`ALTER TABLE messages ADD COLUMN cc TEXT DEFAULT ''`).run();
    } else {
      console.log('cc column already exists in messages table');
    }
    
    // Add bcc column if it doesn't exist
    if (!columnNames.includes('bcc')) {
      console.log('Adding bcc column to messages table');
      db.connection.prepare(`ALTER TABLE messages ADD COLUMN bcc TEXT DEFAULT ''`).run();
    } else {
      console.log('bcc column already exists in messages table');
    }
    
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
} 