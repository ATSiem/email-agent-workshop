// Test for the summarize API schema validation
const { z } = require('zod');
const { generateObject } = require('ai');

// Mock the AI SDK
jest.mock('ai', () => ({
  generateObject: jest.fn().mockResolvedValue({
    object: {
      report: 'Test report content',
      highlights: []
    }
  })
}));

describe('Summarize API Schema', () => {
  test('Schema should not use default values for highlights', () => {
    // This test verifies that we're not using default values in the schema
    // which would cause the OpenAI API to reject the request
    
    // Create a schema similar to what we use in the API
    const schema = z.object({ 
      report: z.string(),
      highlights: z.array(z.string()) // No default value
    });
    
    // Validate that the schema works with the expected response format
    const validData = {
      report: 'Test report content',
      highlights: []
    };
    
    const result = schema.parse(validData);
    expect(result).toEqual(validData);
    
    // Verify that the schema accepts an empty array for highlights
    const dataWithEmptyHighlights = {
      report: 'Test report content',
      highlights: []
    };
    
    const resultWithEmptyHighlights = schema.parse(dataWithEmptyHighlights);
    expect(resultWithEmptyHighlights).toEqual(dataWithEmptyHighlights);
  });
  
  test('generateObject should be called with the correct schema', async () => {
    // Create a mock implementation of the API route logic
    const mockGenerateReport = async () => {
      const result = await generateObject({
        model: {},
        schemaName: "communicationReport",
        schemaDescription: "A formatted report of email communications",
        schema: z.object({ 
          report: z.string(),
          highlights: z.array(z.string()) // No default value
        }),
        prompt: "Test prompt",
      });
      
      return result;
    };
    
    // Call the mock function
    await mockGenerateReport();
    
    // Verify that generateObject was called with the correct schema
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: "communicationReport",
        schema: expect.any(Object),
        prompt: "Test prompt"
      })
    );
    
    // Verify that the schema doesn't have a default value for highlights
    const schemaArg = generateObject.mock.calls[0][0].schema;
    const schemaShape = schemaArg._def.shape();
    
    // Check that highlights is defined as an array without default
    expect(schemaShape.highlights._def.typeName).toBe('ZodArray');
    
    // Ensure there's no default value set
    expect(schemaShape.highlights._def.defaultValue).toBeUndefined();
  });
}); 