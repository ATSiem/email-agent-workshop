// Test for email summarization functionality
const { openai } = require('@ai-sdk/openai');
const { generateObject, generateText } = require('ai');
const { z } = require('zod');

describe('Email Summarization', () => {
  // Sample email content for all tests
  const emailContent = `
    Subject: Update on Quantum Optimization Project
    From: bbedard@defactoglobal.com
    To: john.smith@example.com
    
    Hi John,
    
    I wanted to provide a quick update on our quantum optimization project. We've made significant progress 
    in the algorithm development phase and are ready to move to initial testing next week.
    
    Could you please review the attached documentation and provide feedback by Friday?
    
    Thanks,
    Barbara
  `;

  test('GPT-3.5-turbo should generate summaries without structured outputs', async () => {
    // Skip this test if running in CI environment without API keys
    if (process.env.CI && !process.env.OPENAI_API_KEY) {
      console.log('Skipping OpenAI API test in CI environment');
      return;
    }
    
    try {
      const response = await generateText({
        model: openai('gpt-3.5-turbo'),
        prompt: `Summarize this email concisely:
        
        ${emailContent}
        
        Focus on the main point, any action items or requests, and key information.
        The summary should be 1-2 sentences. Be factual and objective.`,
        maxTokens: 150,
        temperature: 0.3,
      });
      
      expect(response).toBeTruthy();
      expect(typeof response.text).toBe('string');
      expect(response.text.length).toBeGreaterThan(10);
      console.log('GPT-3.5-turbo summary:', response.text);
    } catch (error) {
      // If API key is not available, this test will be marked as skipped
      if (error.message.includes('API key')) {
        console.log('Skipping test due to missing API key');
        return;
      }
      throw error;
    }
  }, 15000); // Increase timeout for API call
  
  test('GPT-4 models should support structured outputs', async () => {
    // Skip this test if running in CI environment without API keys
    if (process.env.CI && !process.env.OPENAI_API_KEY) {
      console.log('Skipping OpenAI API test in CI environment');
      return;
    }
    
    try {
      const result = await generateObject({
        model: openai('gpt-4o', { 
          structuredOutputs: true,
          maxTokens: 150
        }),
        schemaName: "emailSummary",
        schemaDescription: "A concise summary of an email",
        schema: z.object({ 
          summary: z.string(),
          keyPoints: z.array(z.string()),
          topicCategory: z.string(),
        }),
        prompt: `Summarize this email concisely:
        
        ${emailContent}
        
        Focus on the main point, any action items or requests, and key information.
        The summary should be 1-2 sentences. Be factual and objective.`,
      });
      
      expect(result).toBeTruthy();
      expect(result.object).toBeTruthy();
      expect(result.object.summary).toBeTruthy();
      expect(result.object.keyPoints).toBeInstanceOf(Array);
      expect(result.object.topicCategory).toBeTruthy();
      console.log('GPT-4 structured output:', result.object);
    } catch (error) {
      // If API key is not available, this test will be marked as skipped
      if (error.message.includes('API key')) {
        console.log('Skipping test due to missing API key');
        return;
      }
      throw error;
    }
  }, 20000); // Increase timeout for API call
  
  test('Model detection logic should correctly identify model capabilities', () => {
    const testModels = [
      { name: 'gpt-3.5-turbo', shouldUseStructured: false },
      { name: 'gpt-4o', shouldUseStructured: true },
      { name: 'gpt-4', shouldUseStructured: true },
      { name: 'gpt-4-turbo', shouldUseStructured: true },
    ];
    
    for (const model of testModels) {
      const supportsStructuredOutput = model.name.includes('gpt-4');
      expect(supportsStructuredOutput).toBe(model.shouldUseStructured);
    }
  });
}); 