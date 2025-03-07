#!/bin/bash

# Set environment variables to disable problematic features
export USE_DYNAMIC_MODEL_LIMITS=false
export NEXT_PUBLIC_DISABLE_VECTOR_SEARCH=true
export DATABASE_TYPE=postgres

# Create a simple script to initialize the Postgres database
cat > pg-init.js << EOF
// Simple script to initialize Postgres database
import { initializePostgresSchema } from './src/lib/db/pg-init.js';

async function main() {
  console.log('Running Postgres schema initialization...');
  await initializePostgresSchema();
  console.log('Schema initialization complete');
}

main().catch(err => {
  console.error('Error in initialization script:', err);
  process.exit(1);
});
EOF

# Run the build
npm run build

# Note: We don't need to manually initialize the database anymore
# as it will be handled by the application on startup 