# Email Agent Tests

This directory contains tests for the Email Agent application. The tests are organized by feature and use Jest as the testing framework.

## Test Structure

- `email-summarizer.test.js`: Tests for the email summarization functionality
- `process-summaries-api.test.js`: Tests for the process-summaries API endpoint
- `run-tests.js`: A custom test runner script that runs all tests

## Running Tests

You can run the tests using the following npm scripts:

```bash
# Run all tests
npm test

# Run tests in watch mode (automatically re-run when files change)
npm run test:watch

# Run only the API tests
npm run test:api

# Run only the email summarizer tests
npm run test:summarizer
```

## Test Environment

The tests are designed to be resilient to different environments:

- If running in a CI environment without API keys, the OpenAI API tests will be skipped
- If the server is not running, the API tests will be skipped
- Tests have appropriate timeouts for API calls

## Adding New Tests

To add a new test file:

1. Create a new file in the `tests` directory with the `.test.js` extension
2. Use the Jest testing framework (`describe`, `test`, `expect`, etc.)
3. Run the tests to make sure they work

## Best Practices

- Keep tests focused on a single feature or component
- Use descriptive test names that explain what is being tested
- Mock external dependencies when possible
- Handle API keys and other secrets securely
- Add appropriate error handling and skipping logic for different environments 