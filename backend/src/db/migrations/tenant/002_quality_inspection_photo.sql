-- Add optional photo upload for roll quality inspection
ALTER TABLE quality_inspections ADD COLUMN IF NOT EXISTS photo_url text;
