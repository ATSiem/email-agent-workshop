# Deployment Checklist for Client Reports Application

## Pre-Deployment

- [ ] Create a backup of the production database
  ```bash
  mkdir -p data/backups/$(date +%Y%m%d) && cp data/email_agent.db data/backups/$(date +%Y%m%d)/email_agent_pre_migration.db
  ```
- [ ] Verify all migration scripts are in the `scripts/` directory
- [ ] Confirm `package.json` has the correct script commands:
  - `db:update-clients`
  - `db:verify-clients`
  - `db:ensure-client-ids`

## Deployment

- [ ] Push changes to the main branch
- [ ] Wait for Render to deploy the changes
- [ ] Connect to the production server
- [ ] Run the migration script:
  ```bash
  npm run db:ensure-client-ids
  ```
- [ ] Verify the migration:
  ```bash
  npm run db:verify-clients
  ```

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