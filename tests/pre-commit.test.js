// Tests for the pre-commit hook functionality
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Helper function to create a temporary file with content
function createTempFile(filename, content) {
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Helper function to clean up temporary files
function cleanupTempFiles() {
  const tempDir = path.join(__dirname, 'temp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Create a mock pre-commit hook for testing
function createMockPreCommitHook() {
  const tempDir = path.join(__dirname, 'temp');
  const hooksDir = path.join(tempDir, '.husky');
  
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }
  
  // Create a simplified version of the pre-commit hook for testing
  const preCommitContent = `#!/bin/sh

# Check for potentially sensitive files
STAGED_FILES=\${STAGED_FILES:-$(git diff --cached --name-only)}
SENSITIVE_PATTERNS='.env|.key|password|token|secret|credential|.pem'

echo "🔍 Checking for sensitive files..."

for file in $STAGED_FILES; do
  if echo "$file" | grep -E "$SENSITIVE_PATTERNS" > /dev/null; then
    echo "⚠️  Warning: Potential sensitive file detected: $file"
    
    # If the file contains actual secrets, block the commit
    if grep -E "(API_KEY|SECRET|PASSWORD|TOKEN).*='[A-Za-z0-9_\-]{8,}'" "$file" > /dev/null; then
      echo "❌ Error: Blocking commit due to potential secret in: $file"
      exit 1
    fi
  fi
done

# Success
exit 0
`;
  
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  fs.writeFileSync(preCommitPath, preCommitContent);
  fs.chmodSync(preCommitPath, '755'); // Make executable
  
  return preCommitPath;
}

describe('Pre-commit Hook', () => {
  let preCommitHookPath;
  
  beforeAll(() => {
    // Create a mock pre-commit hook for testing
    preCommitHookPath = createMockPreCommitHook();
    
    // Create temp directory for test files
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
  });
  
  afterAll(() => {
    // Clean up temporary files
    cleanupTempFiles();
  });
  
  test('should detect sensitive files with secrets', () => {
    // Create a temporary .env file with secrets
    const envFilePath = createTempFile('.env', `
      OPENAI_API_KEY='sk-1234567890abcdefghijklmnopqrstuvwxyz'
      SECRET_TOKEN='1234567890abcdefghijklmnopqrstuvwxyz'
    `);
    
    // Run the pre-commit hook with our file
    try {
      execSync(`sh ${preCommitHookPath}`, {
        env: {
          ...process.env,
          STAGED_FILES: envFilePath
        }
      });
      // If we get here, the hook didn't exit with an error as expected
      fail('Pre-commit hook should have detected sensitive files and exited with an error');
    } catch (error) {
      // Expected behavior - hook should exit with error
      expect(error.status).toBe(1);
      expect(error.stderr.toString() + error.stdout.toString()).toContain('Error: Blocking commit due to potential secret');
    }
  });
  
  test('should allow files without secrets', () => {
    // Create a temporary file without secrets
    const safeFilePath = createTempFile('safe-file.js', `
      // This is a safe file with no secrets
      const message = 'Hello, world!';
      console.log(message);
    `);
    
    // Run the pre-commit hook with our file
    try {
      const output = execSync(`sh ${preCommitHookPath}`, {
        env: {
          ...process.env,
          STAGED_FILES: safeFilePath
        }
      }).toString();
      
      // Hook should not exit with an error
      expect(output).toContain('Checking for sensitive files');
    } catch (error) {
      // Unexpected error
      fail(`Pre-commit hook should not have exited with an error: ${error.message}`);
    }
  });
  
  test('should warn about sensitive filenames but allow if no secrets inside', () => {
    // Create a temporary .env file without actual secrets
    const envFilePath = createTempFile('.env.example', `
      # Example environment variables
      OPENAI_API_KEY=your_api_key_here
      SECRET_TOKEN=your_secret_token_here
    `);
    
    // Run the pre-commit hook with our file
    try {
      const output = execSync(`sh ${preCommitHookPath}`, {
        env: {
          ...process.env,
          STAGED_FILES: envFilePath
        }
      }).toString();
      
      // Hook should output a warning but not exit with an error
      expect(output).toContain('Warning: Potential sensitive file detected');
    } catch (error) {
      // Unexpected error
      fail(`Pre-commit hook should not have exited with an error: ${error.message}`);
    }
  });
}); 