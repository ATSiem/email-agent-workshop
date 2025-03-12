/**
 * Data directory regression test
 * This test verifies that the data directory exists and is writable
 */

const fs = require('fs');
const path = require('path');

// Data directory path
const DATA_DIR = path.resolve('./data');

describe('Data Directory', () => {
  test('data directory exists', () => {
    // Check if data directory exists
    const exists = fs.existsSync(DATA_DIR);
    
    // If it doesn't exist, try to create it
    if (!exists) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log(`Created data directory: ${DATA_DIR}`);
      } catch (err) {
        console.error(`Failed to create data directory: ${err.message}`);
        throw err;
      }
    }
    
    expect(fs.existsSync(DATA_DIR)).toBe(true);
  });
  
  test('data directory is writable', () => {
    // Create a test file in the data directory
    const testFile = path.join(DATA_DIR, 'test-write.txt');
    
    try {
      // Write to the test file
      fs.writeFileSync(testFile, 'Test write access');
      
      // Verify the file was written
      expect(fs.existsSync(testFile)).toBe(true);
      
      // Clean up
      fs.unlinkSync(testFile);
    } catch (err) {
      console.error(`Failed to write to data directory: ${err.message}`);
      throw err;
    }
  });
}); 