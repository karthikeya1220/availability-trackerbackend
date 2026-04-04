/*
  Warnings:

  - You are about to drop the column `calendar_event_id` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `google_event_id` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `meet_link` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `google_refresh_token` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Meeting" DROP COLUMN "calendar_event_id",
DROP COLUMN "google_event_id",
DROP COLUMN "meet_link";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "google_refresh_token";

-- CreateIndex
CREATE INDEX "availabilities_user_id_idx" ON "availabilities"("user_id");

-- CreateIndex
CREATE INDEX "availabilities_mentor_id_idx" ON "availabilities"("mentor_id");

-- CreateIndex
CREATE INDEX "availabilities_role_idx" ON "availabilities"("role");

-- CreateIndex
CREATE INDEX "availabilities_date_idx" ON "availabilities"("date");

-- CreateIndex
CREATE INDEX "availabilities_user_id_date_idx" ON "availabilities"("user_id", "date");

-- CreateIndex
CREATE INDEX "availabilities_mentor_id_date_idx" ON "availabilities"("mentor_id", "date");

-- CreateIndex
CREATE INDEX "availabilities_role_date_idx" ON "availabilities"("role", "date");
