/**
 * Domain Normalization Tests
 * 
 * This file contains tests for the domain normalization function
 * used in the client form component.
 */

// Import the normalization function
// Note: Since this is in a React component, we're recreating it here for testing
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
describe('Domain Normalization', () => {
  test('should remove @ prefix from domains', () => {
    expect(normalizeDomain('@example.com')).toBe('example.com');
    expect(normalizeDomain('@test.org')).toBe('test.org');
  });
  
  test('should add .com TLD to domains without a dot', () => {
    expect(normalizeDomain('example')).toBe('example.com');
    expect(normalizeDomain('test')).toBe('test.com');
  });
  
  test('should not modify domains with TLD', () => {
    expect(normalizeDomain('example.com')).toBe('example.com');
    expect(normalizeDomain('test.org')).toBe('test.org');
    expect(normalizeDomain('sub.domain.co.uk')).toBe('sub.domain.co.uk');
  });
  
  test('should convert domains to lowercase', () => {
    expect(normalizeDomain('Example.Com')).toBe('example.com');
    expect(normalizeDomain('@Test.Org')).toBe('test.org');
  });
  
  test('should handle special cases', () => {
    expect(normalizeDomain('localhost')).toBe('localhost');
    expect(normalizeDomain('')).toBe('.com'); // Edge case - empty string
  });
  
  test('should handle domains with @ in the middle', () => {
    expect(normalizeDomain('test@example.com')).toBe('test@example.com');
  });
}); 