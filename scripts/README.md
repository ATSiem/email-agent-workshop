# Database Scripts

This directory contains scripts for managing the database and performing maintenance tasks.

## Available Scripts

### `add-user-id-column.js`

Adds the `user_id` column to the `clients` table if it doesn't already exist. This is a prerequisite for the update-existing-clients script.

```bash
node scripts/add-user-id-column.js
```

### `update-existing-clients.js`

Updates all existing clients that don't have a `user_id` with a default value. By default, it uses `dev@example.com` as the user ID, but this can be customized using the `DEFAULT_USER_ID` environment variable.

```bash
# Using default user ID (dev@example.com)
node scripts/update-existing-clients.js

# Using a custom user ID
DEFAULT_USER_ID=custom@example.com node scripts/update-existing-clients.js
```

### `run-update-clients.js`

A wrapper script that runs the `update-existing-clients.js` script with proper error handling. This is the recommended way to run the update script.

```bash
# Using default user ID (dev@example.com)
node scripts/run-update-clients.js

# Using a custom user ID
DEFAULT_USER_ID=custom@example.com node scripts/run-update-clients.js
```

### `verify-client-updates.js`

Verifies that all clients have a `user_id` value and provides statistics about the distribution of user IDs in the database.

```bash
node scripts/verify-client-updates.js
```

### `ensure-client-user-ids.js`

A comprehensive script that combines all the necessary steps to ensure clients have user IDs:
1. Adds the `user_id` column if it doesn't exist
2. Updates existing clients with the default user ID
3. Verifies that all clients have a user_id

```bash
# Using default user ID (dev@example.com)
node scripts/ensure-client-user-ids.js

# Using a custom user ID
DEFAULT_USER_ID=custom@example.com node scripts/ensure-client-user-ids.js
```

### `run-migration.js`

Runs the TypeScript migration to add the `user_id` column to the `clients` table using the TypeScript migration file.

```bash
node scripts/run-migration.js
```

## NPM Scripts

For convenience, these scripts are also available as npm scripts:

```bash
# Run the client update script
npm run db:update-clients

# Run with a custom user ID
DEFAULT_USER_ID=custom@example.com npm run db:update-clients

# Verify client updates
npm run db:verify-clients

# Run the comprehensive client update process
npm run db:ensure-client-ids

# Run with a custom user ID
DEFAULT_USER_ID=custom@example.com npm run db:ensure-client-ids
``` 