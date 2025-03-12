/**
 * Test for SQLite warning filtering
 * 
 * This test verifies that our changes to filter SQLite warnings work correctly.
 */

describe('SQLite Warning Filtering', () => {
  // Mock the console.warn function
  const originalConsoleWarn = console.warn;
  let warnMock;
  
  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();
    
    // Mock environment variables
    process.env.RENDER = 'true';
    process.env.RENDER_SERVICE_ID = 'test-service';
    process.env.SQLITE_DB_PATH = './data/test-db.sqlite';
    
    // Mock console.warn
    warnMock = jest.fn();
    console.warn = warnMock;
  });
  
  afterEach(() => {
    // Restore console.warn
    console.warn = originalConsoleWarn;
    
    // Clean up environment
    delete process.env.RENDER;
    delete process.env.RENDER_SERVICE_ID;
    delete process.env.SQLITE_DB_PATH;
  });
  
  test('next-build.js should filter SQLite warnings', () => {
    // Load the next-build.js script
    const nextBuildScript = require('../scripts/next-build');
    
    // Create a mock output with SQLite warnings
    const mockOutput = `
⚠️ SQLite create_function method not available on Render free tier
⚠️ Vector search (AI search) functionality is disabled
⚠️ To enable this feature, upgrade to Render paid tier ($7/mo or higher)
⚠️ Add a persistent disk and set RENDER_DISK_MOUNTED environment variable
    `.trim();
    
    // Get the filterOutput function from the script
    const filterOutput = nextBuildScript.__test__.filterOutput;
    
    // Call the filterOutput function with the mock output
    filterOutput(Buffer.from(mockOutput));
    
    // Verify that the warnings were filtered out
    expect(console.warn).not.toHaveBeenCalled();
  });
  
  test('render-build.sh includes note about filtered warnings', () => {
    // Read the render-build.sh file
    const fs = require('fs');
    const path = require('path');
    const renderBuildScript = fs.readFileSync(
      path.join(__dirname, '../scripts/render-build.sh'), 
      'utf8'
    );
    
    // Check if the script includes a note about filtered warnings
    expect(renderBuildScript).toContain('SQLite warnings about vector search functionality are filtered');
  });
}); 