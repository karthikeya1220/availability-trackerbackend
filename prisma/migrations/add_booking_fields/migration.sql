-- Add booking fields to availabilities table
ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS is_booked BOOLEAN DEFAULT false;
ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS booked_at TIMESTAMP;
