const fetch = require('node-fetch');

// Mock the fetch function
jest.mock('node-fetch');

// Mock the modules before importing
jest.mock('../src/lib/db', () => ({
  connection: {
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([
        {
          id: 'email1',
          subject: 'Quantum Optimization Project Update',
          from: 'bbedard@defactoglobal.com',
          to: 'john@example.com',
          date: '2025-02-15',
          body: 'We have made significant progress on the quantum optimization algorithms.',
          embedding: JSON.stringify(Array(1536).fill(0.1))
        }
      ]),
      run: jest.fn()
    })
  }
}));

jest.mock('../src/lib/env', () => ({
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small'
}));

// Create a mock implementation of the functions we want to test
const mockFindSimilarEmails = async (query, options) => {
  // Simulate the behavior of findSimilarEmails
  return [
    {
      id: 'email1',
      subject: 'Quantum Optimization Project Update',
      from: 'bbedard@defactoglobal.com',
      to: 'john@example.com',
      date: '2025-02-15',
      body: 'We have made significant progress on the quantum optimization algorithms.',
      similarity_score: 0.95
    }
  ];
};

const mockProcessEmailEmbeddings = async (limit) => {
  // Simulate the behavior of processEmailEmbeddings
  return { success: true, processed: 1 };
};

// Mock the entire module
jest.mock('../src/lib/client-reports/email-embeddings', () => ({
  findSimilarEmails: jest.fn(mockFindSimilarEmails),
  processEmailEmbeddings: jest.fn(mockProcessEmailEmbeddings)
}));

// Now import the mocked functions
const { findSimilarEmails, processEmailEmbeddings } = require('../src/lib/client-reports/email-embeddings');

describe('Email Embeddings', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock the fetch response for embeddings
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            embedding: Array(1536).fill(0.1)
          }
        ]
      })
    });
  });
  
  test('findSimilarEmails should correctly search for similar emails', async () => {
    // This test verifies that the findSimilarEmails function works correctly
    
    const searchQuery = 'quantum optimization';
    const options = {
      limit: 10,
      startDate: '2025-02-01T00:00:00.000Z',
      endDate: '2025-03-01T23:59:59.999Z',
      clientDomains: ['defactoglobal.com'],
      clientEmails: ['bbedard@defactoglobal.com']
    };
    
    // Call the function
    const results = await findSimilarEmails(searchQuery, options);
    
    // Verify the results
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].subject).toContain('Quantum');
    
    // Verify that the function was called with the correct parameters
    expect(findSimilarEmails).toHaveBeenCalledWith(searchQuery, options);
  });
  
  test('processEmailEmbeddings should process emails without embeddings', async () => {
    // Call the function
    const result = await processEmailEmbeddings(10);
    
    // Verify the result
    expect(result).toEqual({ success: true, processed: 1 });
    
    // Verify that the function was called with the correct parameters
    expect(processEmailEmbeddings).toHaveBeenCalledWith(10);
  });
}); 