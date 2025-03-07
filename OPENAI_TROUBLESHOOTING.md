# OpenAI API Troubleshooting Guide

This guide will help you troubleshoot and fix issues with the OpenAI API integration in the client-reports application.

## Common Issues

### "Failed to read response from server" Error

This error typically occurs when:

1. The OpenAI API key is missing or invalid
2. The request to OpenAI times out
3. The response from OpenAI is too large

## Checking the OpenAI API Key

### Using the API Endpoint

You can check the status of your OpenAI API key by visiting:

```
https://client-reports.vercel.app/api/check-openai
```

This endpoint requires authentication. You must be logged in to access it.

### Using the Command Line Script

You can also check the API key using the provided script:

```bash
./check-openai-key.sh YOUR_OPENAI_API_KEY
```

If you don't provide an API key, the script will try to read it from the `.env` file.

## Updating the OpenAI API Key

If your OpenAI API key is invalid or has expired, you need to update it in the Vercel environment.

### Using the Command Line Script

1. Make sure you have the Vercel CLI installed:

```bash
npm install -g vercel
```

2. Log in to Vercel:

```bash
vercel login
```

3. Run the update script:

```bash
./update-openai-key.sh YOUR_NEW_OPENAI_API_KEY
```

This script will:
- Remove the old API key from the Vercel environment
- Add the new API key to the Vercel environment
- Redeploy the application to apply the changes

### Using the Vercel Dashboard

1. Go to the [Vercel Dashboard](https://vercel.com)
2. Select the `client-reports` project
3. Go to the "Settings" tab
4. Select "Environment Variables"
5. Find the `OPENAI_API_KEY` variable and click "Edit"
6. Enter your new API key and save
7. Redeploy the application to apply the changes

## Reducing Timeouts

If you're experiencing timeouts when generating reports, try:

1. Reducing the date range for your report
2. Selecting fewer emails
3. Using a simpler report template

## Code Changes

The following changes have been made to improve error handling:

1. Added explicit OpenAI API key validation
2. Implemented timeout handling for OpenAI API calls
3. Improved error messages for better troubleshooting
4. Added the `/api/check-openai` endpoint for API key validation

## Need More Help?

If you're still experiencing issues, please contact the administrator or open an issue on the repository. 