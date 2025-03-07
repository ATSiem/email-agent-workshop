#!/bin/bash

# This script updates the OpenAI API key in the Vercel environment
# Make sure you have the Vercel CLI installed and are logged in
# npm install -g vercel
# vercel login

# Check if an API key was provided as an argument
if [ -z "$1" ]; then
  echo "Usage: ./update-openai-key.sh YOUR_OPENAI_API_KEY"
  echo "Please provide your OpenAI API key as an argument."
  exit 1
fi

OPENAI_API_KEY=$1

# Confirm the action
echo "This will update the OpenAI API key in your Vercel environment."
echo "Project: client-reports"
echo "API Key: ${OPENAI_API_KEY:0:5}...${OPENAI_API_KEY: -5}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Operation cancelled."
  exit 1
fi

# Update the OpenAI API key in Vercel
echo "Updating OpenAI API key in Vercel environment..."
vercel env rm OPENAI_API_KEY production -y || true
echo $OPENAI_API_KEY | vercel env add OPENAI_API_KEY production

# Redeploy the project to apply the changes
echo "Redeploying the project to apply changes..."
vercel --prod

echo "Done! The OpenAI API key has been updated and the project has been redeployed." 