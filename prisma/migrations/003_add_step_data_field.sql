-- Migration: Add step_data field to verification_sessions table
-- This field will store the step-by-step validation progress as JSON

ALTER TABLE verification_sessions ADD COLUMN step_data JSONB;

-- Add index for better performance on step_data queries
CREATE INDEX idx_verification_sessions_step_data ON verification_sessions USING GIN (step_data);

-- Add comment for documentation
COMMENT ON COLUMN verification_sessions.step_data IS 'JSON data containing step-by-step validation progress and results';
