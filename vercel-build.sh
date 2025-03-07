#!/bin/bash

# Create necessary directories
mkdir -p /tmp/data
touch /tmp/data/email_agent.db

# Initialize SQLite database with minimal structure
echo "Creating minimal database structure for production..."
sqlite3 /tmp/data/email_agent.db <<EOF
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domains TEXT NOT NULL,
  emails TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
EOF

# Set environment variables to disable problematic features
export USE_DYNAMIC_MODEL_LIMITS=false
export NEXT_PUBLIC_DISABLE_VECTOR_SEARCH=true

# Run the build
npm run build 