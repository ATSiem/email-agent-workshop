# Email Summarization Fix

## Issues Identified

1. **OpenAI API Error**: The email summarizer was using `structuredOutputs: true` with the `gpt-3.5-turbo` model, which doesn't support structured outputs with JSON schema.

2. **Schema Definition Issue**: For models that do support structured outputs (like GPT-4), the schema definition was incorrect. Optional fields were defined with `.optional()` but not included in the 'required' array that OpenAI expects.

## Solutions Implemented

### 1. Fixed Email Summarizer Implementation

Updated `src/lib/client-reports/email-summarizer.ts` to:

- Check if the model supports structured outputs (only GPT-4 models do)
- Use different API approaches based on model capabilities:
  - For GPT-4 models: Use `generateObject` with structured outputs
  - For GPT-3.5-turbo: Use `generateText` without structured outputs
- Added error handling to fall back to non-structured approach if structured output fails

```typescript
// Check if we're using a model that supports structured outputs
const modelName = env.OPENAI_SUMMARY_MODEL || "gpt-3.5-turbo";
let useStructuredOutput = modelName.includes("gpt-4");

// Use appropriate API based on model capabilities
if (useStructuredOutput) {
  // Use structured output for GPT-4 models
  // ...
} else {
  // Fallback for models that don't support structured outputs
  // ...
}
```

### 2. Created API Endpoint for Processing Summaries

Added a new API endpoint at `src/app/api/system/process-summaries/route.ts` to trigger the background processing of email summaries:

```typescript
// Queue a task to process pending summaries
const taskId = queueBackgroundTask('summarize_emails', { limit });
```

### 3. Created Test Script

Created a test script (`test-email-summary.js`) to verify:
- That GPT-3.5-turbo works correctly with non-structured outputs
- That GPT-4 works correctly with structured outputs
- That the model detection logic works correctly

## How to Use

### Process Email Summaries

```bash
curl -X POST http://localhost:3000/api/system/process-summaries
```

This will queue a background task to process pending email summaries.

### Optional Parameters

- `limit`: Number of emails to process (default: 20)

```bash
curl -X POST "http://localhost:3000/api/system/process-summaries?limit=50"
```

## Testing

Run the test script to verify the fix:

```bash
node test-email-summary.js
``` 