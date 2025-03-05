#!/bin/bash

# Stop any running Next.js server
echo "Stopping any running Next.js server..."
pkill -f "node.*next"

# Comment out the ALLOWED_EMAIL_DOMAIN in .env for development
echo "Temporarily commenting out ALLOWED_EMAIL_DOMAIN for development..."
sed -i.bak 's/^ALLOWED_EMAIL_DOMAIN=/#ALLOWED_EMAIL_DOMAIN=/' .env

# Start the server
echo "Starting the server..."
npm run dev
