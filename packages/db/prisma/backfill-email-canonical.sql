-- Run if upgrading an existing database where `emailCanonical` is null (after optional column add).
-- Example:  psql "$DATABASE_URL" -f prisma/backfill-email-canonical.sql
UPDATE User
SET emailCanonical = lower(trim(email))
WHERE emailCanonical IS NULL;
