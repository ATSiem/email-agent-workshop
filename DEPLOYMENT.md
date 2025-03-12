# Deployment Checklist for Client Reports Application

## Pre-Deployment

- [ ] Create a backup of the production database
  ```bash
  mkdir -p data/backups/$(date +%Y%m%d) && cp data/email_agent.db data/backups/$(date +%Y%m%d)/email_agent_pre_migration.db
  ```
- [ ] Verify all migration scripts are in the `scripts/` directory
- [ ] Confirm `package.json` has the correct script commands:
  - `db:init` - Database initialization script
  - `db:update-clients`
  - `db:verify-clients`
  - `db:ensure-client-ids`
- [ ] Ensure the start script in package.json includes database initialization:
  ```json
  "start": "node scripts/init-database.js && next start -p ${PORT:-3000}"
  ```

## Deployment to Render

### Option 1: Standard Build Command (Recommended)

Use the standard build command in Render:

```
npm install && npm run build
```

The application will automatically initialize the database on startup.

### Option 2: Custom Build Script

If you need to perform additional steps during the build process, use the custom build script:

```
chmod +x scripts/render-build.sh && ./scripts/render-build.sh
```

This script:
1. Builds the Next.js application
2. Initializes the database with the correct schema
3. Ensures all required tables and columns exist

## Post-Deployment Testing

- [ ] Test the client form with various domain formats:
  - Domain with @ prefix (e.g., "@example.com")
  - Domain without TLD (e.g., "example")
  - Normal domain (e.g., "example.com")
- [ ] Verify that domains are normalized correctly
- [ ] Check that existing clients are still accessible
- [ ] Verify that client user IDs are working correctly

## Monitoring

- [ ] Watch application logs for any errors
- [ ] Monitor database performance
- [ ] Check for any user-reported issues

## Rollback Plan (if needed)

- [ ] Restore database from backup:
  ```bash
  cp data/backups/YYYYMMDD/email_agent_pre_migration.db data/email_agent.db
  ```
- [ ] Revert code changes:
  ```bash
  git revert <commit-hash>
  ```
- [ ] Redeploy the application

## Changes Summary

1. **Domain Normalization**
   - Added domain normalization in the client form
   - Domains with @ prefix have it removed
   - Domains without TLD get .com appended

2. **Client User ID Migration**
   - Added user_id column to clients table
   - Updated existing clients with default user ID
   - Added scripts for verification and maintenance 

3. **Port Configuration**
   - Updated start script to use Render's PORT environment variable
   - Ensures proper routing for API requests in production
   - Fallback to port 3000 for local development 