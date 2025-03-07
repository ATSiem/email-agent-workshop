#!/bin/bash

# This script updates the Vercel environment variables for the client-reports project

# Make sure you have the Vercel CLI installed and are logged in
# npm install -g vercel
# vercel login

# Set the environment variables
echo "Updating Vercel environment variables..."

# Microsoft Graph API (OAuth setup)
vercel env add NEXT_PUBLIC_AZURE_CLIENT_ID
vercel env add NEXT_PUBLIC_AZURE_TENANT_ID
vercel env add NEXT_PUBLIC_AZURE_REDIRECT_URI

# Domain restriction
vercel env add ALLOWED_EMAIL_DOMAINS

# Redeploy the project
echo "Redeploying the project..."
vercel --prod

echo "Done!" 