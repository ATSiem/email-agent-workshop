# Render Deployment Guide

This guide provides instructions for deploying the Client Reports application to Render.

## Deployment Configuration

### Build Command

Use the following build command in your Render service configuration:

```
npm run render:build
```

This will:
1. Create the necessary data directory
2. Build the Next.js application
3. Initialize the database with the correct schema

### Start Command

Use the following start command:

```
npm start
```

This will:
1. Run the database initialization script to ensure the database is properly set up
2. Start the Next.js application

## Environment Variables

Set the following environment variables in your Render service:

- `NODE_ENV`: Set to `production`
- `PORT`: Set to `10000` (Render's default port)
- `DB_PATH`: Set to `/var/data/email_agent.db` (for persistent storage)

## Persistent Storage

To ensure your database persists between deployments:

1. Add a disk to your Render service
2. Mount it at `/var/data`
3. Set the `DB_PATH` environment variable to `/var/data/email_agent.db`

## Feature Limitations on Free Tier

### Vector Search (AI Search)

The free tier of Render does not support SQLite extensions, which are required for vector search functionality. As a result, the "AI search" feature is disabled on the free tier.

**TODO: Upgrade to Render's paid tier ($7/mo or higher) to enable vector search functionality.**

When running on the free tier:
- The "Use AI search" checkbox will be disabled
- A tooltip will explain why it's disabled
- Regular keyword search will still work

### Persistent Storage

The free tier does not support persistent disks, so data will be reset on each deployment. For a production environment, consider upgrading to a paid tier with persistent storage.

## Troubleshooting

### Database Issues

If you encounter database-related issues:

1. Check that the data directory exists and is writable
2. Verify that the database file exists at the specified path
3. Check the logs for any SQLite-related errors

### Test Failures

Some tests may fail during the build process due to the lack of a database. This is expected and won't prevent the deployment from succeeding.

### Node.js Version

The application requires Node.js v20. Render should automatically use this version based on the `.nvmrc` file.

## Manual Database Initialization

If needed, you can manually initialize the database by connecting to the Render shell and running:

```
npm run db:init
```

This will create the database file and set up the required tables and columns. 