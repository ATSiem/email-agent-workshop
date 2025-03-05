import { db } from '../index';

/**
 * Migration to add example_prompt column to the report_templates table
 */
export function addExamplePromptColumn() {
  try {
    console.log('Starting migration: Adding example_prompt column to report_templates table');
    
    // Check if column already exists
    const tableInfo = db.connection.prepare('PRAGMA table_info(report_templates)').all();
    
    const columnNames = tableInfo.map(col => col.name);
    console.log('Current columns in report_templates table:', columnNames);
    
    // Add example_prompt column if it doesn't exist
    if (!columnNames.includes('example_prompt')) {
      console.log('Adding example_prompt column to report_templates table');
      db.connection.prepare(`ALTER TABLE report_templates ADD COLUMN example_prompt TEXT`).run();
      console.log('example_prompt column added successfully');
    } else {
      console.log('example_prompt column already exists in report_templates table');
    }
    
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
} 