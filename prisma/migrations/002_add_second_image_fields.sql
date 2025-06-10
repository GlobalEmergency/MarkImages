-- Migration: Add second image fields to verification_sessions table
-- Date: 2025-01-09

ALTER TABLE verification_sessions 
ADD COLUMN second_image_url TEXT,
ADD COLUMN second_cropped_image_url TEXT,
ADD COLUMN second_processed_image_url TEXT;
