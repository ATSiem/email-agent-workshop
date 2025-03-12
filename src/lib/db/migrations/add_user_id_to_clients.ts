import { db } from '../index';

export async function addUserIdToClients() {
  console.log('Running migration: Adding user_id column to clients table');
  
  try {
    // Check if the column already exists
    const tableInfo = db.connection.prepare('PRAGMA table_info(clients)').all();
    const columnExists = tableInfo.some((column: any) => column.name === 'user_id');
    
    if (!columnExists) {
      // Add the user_id column
      db.connection.prepare('ALTER TABLE clients ADD COLUMN user_id TEXT').run();
      console.log('Successfully added user_id column to clients table');
    } else {
      console.log('user_id column already exists in clients table');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error adding user_id column to clients table:', error);
    return { success: false, error };
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  addUserIdToClients()
    .then(result => {
      if (result.success) {
        console.log('Migration completed successfully');
        process.exit(0);
      } else {
        console.error('Migration failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unexpected error during migration:', error);
      process.exit(1);
    });
} 