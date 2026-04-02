-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('user', 'mentor');

-- DropForeignKey
ALTER TABLE "availabilities" DROP CONSTRAINT "availabilities_mentor_id_fkey";

-- DropForeignKey
ALTER TABLE "availabilities" DROP CONSTRAINT "availabilities_user_id_fkey";

-- DropIndex
DROP INDEX "availabilities_mentor_id_date_idx";

-- DropIndex
DROP INDEX "availabilities_mentor_id_date_start_time_key";

-- DropIndex
DROP INDEX "availabilities_mentor_id_idx";

-- DropIndex
DROP INDEX "availabilities_user_id_date_idx";

-- DropIndex
DROP INDEX "availabilities_user_id_date_start_time_key";

-- DropIndex
DROP INDEX "availabilities_user_id_idx";

-- AlterTable: Add new columns first
ALTER TABLE "availabilities" ADD COLUMN "entity_id" TEXT,
ADD COLUMN "entity_type" "EntityType";

-- Migrate data: Convert existing userId/mentorId to entity_id/entity_type
UPDATE "availabilities"
SET "entity_id" = COALESCE("user_id", "mentor_id"),
    "entity_type" = CASE
      WHEN "user_id" IS NOT NULL THEN 'user'::"EntityType"
      WHEN "mentor_id" IS NOT NULL THEN 'mentor'::"EntityType"
    END
WHERE "entity_id" IS NULL;

-- AlterTable: Make new columns NOT NULL after data migration
ALTER TABLE "availabilities" ALTER COLUMN "entity_id" SET NOT NULL,
ALTER COLUMN "entity_type" SET NOT NULL;

-- Drop old columns
ALTER TABLE "availabilities" DROP COLUMN "mentor_id",
DROP COLUMN "user_id";

-- CreateIndex
CREATE INDEX "availabilities_entity_id_idx" ON "availabilities"("entity_id");

-- CreateIndex
CREATE INDEX "availabilities_entity_type_idx" ON "availabilities"("entity_type");

-- CreateIndex
CREATE INDEX "availabilities_entity_id_type_idx" ON "availabilities"("entity_id", "entity_type");

-- CreateIndex
CREATE INDEX "availabilities_entity_id_date_idx" ON "availabilities"("entity_id", "date");

-- CreateIndex
CREATE INDEX "availabilities_entity_type_date_idx" ON "availabilities"("entity_type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "availabilities_entity_id_type_date_start_time_key" ON "availabilities"("entity_id", "entity_type", "date", "start_time");

-- AddForeignKey
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
