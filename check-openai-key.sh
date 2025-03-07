#!/bin/bash

# This script checks if the OpenAI API key is valid
# It can be used to verify that the key is working properly

# Load the API key from .env file if it exists
if [ -f .env ]; then
  source <(grep -v '^#' .env | sed -E 's/(.*)=(.*)$/export \1="\2"/g')
fi

# Check if an API key was provided as an argument or in the environment
API_KEY=${1:-$OPENAI_API_KEY}

if [ -z "$API_KEY" ]; then
  echo "Error: No OpenAI API key found."
  echo "Usage: ./check-openai-key.sh YOUR_OPENAI_API_KEY"
  echo "Or set OPENAI_API_KEY in your .env file."
  exit 1
fi

echo "Checking OpenAI API key..."
echo "API Key: ${API_KEY:0:5}...${API_KEY: -5}"

# Make a request to the OpenAI API to check if the key is valid
response=$(curl -s -o response.txt -w "%{http_code}" https://api.openai.com/v1/models \
  -H "Authorization: Bearer $API_KEY")

# Check the response code
if [ "$response" -eq 200 ]; then
  echo "✅ API key is valid!"
  echo "Available models:"
  grep -o '"id": "[^"]*"' response.txt | head -5 | sed 's/"id": "\(.*\)"/  - \1/'
  rm response.txt
  exit 0
else
  echo "❌ API key is invalid or has issues."
  echo "Response code: $response"
  echo "Error message:"
  cat response.txt
  rm response.txt
  exit 1
fi 