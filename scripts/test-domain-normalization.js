/**
 * Test Domain Normalization Script
 * 
 * This script simulates the client form submission with domain normalization.
 * It creates a new client with various domain formats and checks if they are normalized correctly.
 */

const fetch = require('node-fetch');
const { execSync } = require('child_process');

// The normalizeDomain function from the client form component
function normalizeDomain(domain) {
  // Remove @ prefix if present
  let normalizedDomain = domain.startsWith('@') ? domain.substring(1) : domain;
  
  // Ensure domain has at least one dot (unless it's a simple name like 'localhost')
  if (!normalizedDomain.includes('.') && normalizedDomain !== 'localhost') {
    // If no dot, assume it's a TLD and add .com (e.g., "acme" becomes "acme.com")
    normalizedDomain = `${normalizedDomain}.com`;
  }
  
  return normalizedDomain.toLowerCase();
}

// Test cases
const testCases = [
  { input: '@example.com', expected: 'example.com' },
  { input: 'test', expected: 'test.com' },
  { input: 'Example.Com', expected: 'example.com' },
  { input: 'sub.domain.co.uk', expected: 'sub.domain.co.uk' },
  { input: 'localhost', expected: 'localhost' },
];

// Main function
async function main() {
  console.log('Testing domain normalization...');
  
  // Test the normalizeDomain function
  console.log('\nTesting normalizeDomain function:');
  testCases.forEach(({ input, expected }) => {
    const result = normalizeDomain(input);
    const passed = result === expected;
    console.log(`  ${passed ? '✅' : '❌'} ${input} -> ${result} ${passed ? '' : `(expected: ${expected})`}`);
  });
  
  // Create a client with normalized domains
  console.log('\nCreating a client with normalized domains...');
  
  // Raw domains to be normalized
  const rawDomains = ['@example.com', 'test', 'Example.Com', 'sub.domain.co.uk', 'localhost'];
  
  // Normalize domains
  const normalizedDomains = rawDomains.map(normalizeDomain);
  
  console.log('\nDomain normalization results:');
  rawDomains.forEach((raw, index) => {
    console.log(`  ${raw} -> ${normalizedDomains[index]}`);
  });
  
  // Create the client using the API
  try {
    const response = await fetch('http://localhost:3000/api/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token'
      },
      body: JSON.stringify({
        name: 'Domain Normalization Test',
        domains: normalizedDomains,
        emails: ['test@example.com']
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('\nClient created successfully:');
    console.log(`  ID: ${data.id}`);
    console.log(`  Name: ${data.name}`);
    console.log(`  Domains: ${JSON.stringify(data.domains)}`);
    
    // Check the database
    console.log('\nVerifying in database...');
    const dbOutput = execSync(`sqlite3 data/email_agent.db "SELECT domains FROM clients WHERE id = '${data.id}';"`, { encoding: 'utf8' });
    console.log(`  Database domains: ${dbOutput.trim()}`);
    
    console.log('\n✅ Domain normalization test completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 