-- Run if upgrading an existing database where `emailCanonical` is null (after optional column add).
-- Example:  sqlite3 your.db < prisma/backfill-email-canonical.sql
UPDATE User
SET emailCanonical = lower(trim(email))
WHERE emailCanonical IS NULL;
