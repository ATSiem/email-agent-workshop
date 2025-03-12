#!/bin/bash

# Render build script
# This script is designed to be run during the build phase on Render

echo "Starting Render build process..."

# Create data directory if it doesn't exist
echo "Creating data directory..."
mkdir -p data

# Build the Next.js application
echo "Building Next.js application..."
npm run build

# Initialize the database with the correct schema
echo "Initializing database schema..."
# Remove existing database if it exists
rm -f data/email_agent.db
# Run the initialization script
npm run db:init

echo "Build process completed successfully!" 