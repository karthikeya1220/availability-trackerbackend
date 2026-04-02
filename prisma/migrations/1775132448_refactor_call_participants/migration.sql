-- Refactor CallParticipant to use user_id and mentor_id FKs instead of email-only storage
-- This ensures referential integrity and proper relationships between scheduled_calls → users → mentors

-- Step 1: Add new columns to call_participants
ALTER TABLE "call_participants" ADD COLUMN "user_id" UUID;
ALTER TABLE "call_participants" ADD COLUMN "mentor_id" UUID;

-- Step 2: Make email nullable (for backward compatibility during transition)
ALTER TABLE "call_participants" ALTER COLUMN "email" DROP NOT NULL;

-- Step 3: Add foreign key constraints
ALTER TABLE "call_participants" 
ADD CONSTRAINT "call_participants_user_id_fkey" 
FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "call_participants" 
ADD CONSTRAINT "call_participants_mentor_id_fkey" 
FOREIGN KEY ("mentor_id") REFERENCES "User"("id") ON DELETE SET NULL;

-- Step 4: Create unique indexes for referential integrity
-- Ensure each call can only have a specific user/mentor once
ALTER TABLE "call_participants" 
ADD CONSTRAINT "call_participants_call_user_idx" UNIQUE ("call_id", "user_id");

ALTER TABLE "call_participants" 
ADD CONSTRAINT "call_participants_call_mentor_idx" UNIQUE ("call_id", "mentor_id");

-- Step 5: Create indexes for query performance
CREATE INDEX "call_participants_user_id_idx" ON "call_participants"("user_id");
CREATE INDEX "call_participants_mentor_id_idx" ON "call_participants"("mentor_id");

-- Note: Existing email-based data remains in the email column and can be migrated
-- using a separate data migration script if needed
