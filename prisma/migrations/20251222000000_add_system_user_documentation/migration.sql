-- Migration: Add System User Documentation
-- Purpose: Document the special UUID reserved for system operations
-- This UUID (00000000-0000-0000-0000-000000000000) is used for automated
-- processes like validations, cron jobs, and other system operations
-- where no real user is involved.

-- No changes to the database schema are needed, but we document this
-- for clarity and to prevent future conflicts.

-- IMPORTANT: The UUID 00000000-0000-0000-0000-000000000000 is reserved
-- for system operations and should not be used for real users.

-- Note: We do NOT create a user record for this UUID as it represents
-- system operations, not an actual user account.
