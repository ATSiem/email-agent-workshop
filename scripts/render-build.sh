#!/bin/bash

# Render build script
echo "🚀 Starting Render build process..."

# Create data directory
mkdir -p data 2>/dev/null

# Install system dependencies required for better-sqlite3
echo "📦 Installing system dependencies..."
apt-get update -qq >/dev/null 2>&1 || true
apt-get install -y -qq build-essential python3 >/dev/null 2>&1 || true

# Set environment variables for native module compilation
export npm_config_build_from_source=true
export CFLAGS="-fPIC"
export CXXFLAGS="-fPIC"
export LDFLAGS="-fPIC"

# Install dependencies with specific flags for native modules
echo "📦 Installing dependencies..."
npm install --build-from-source --no-fund --no-audit --loglevel=error

# Verify better-sqlite3 installation
if [ -d "node_modules/better-sqlite3" ]; then
  echo "✅ better-sqlite3 module installed"
else
  echo "⚠️ WARNING: better-sqlite3 module not found"
fi

# Build the Next.js application with reduced output
echo "🏗️ Building Next.js application..."
npm run build:ci

# Initialize the database with the correct schema
echo "🗃️ Initializing database schema..."
rm -f data/email_agent.db 2>/dev/null
npm run db:init

echo "✅ Build process completed!" 