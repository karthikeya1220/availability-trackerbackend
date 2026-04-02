/*
  Warnings:

  - You are about to drop the `Meeting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `meeting_participants` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "meeting_participants" DROP CONSTRAINT "meeting_participants_meeting_id_fkey";

-- DropTable
DROP TABLE "Meeting";

-- DropTable
DROP TABLE "meeting_participants";

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_participants" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_participants_call_id_email_key" ON "call_participants"("call_id", "email");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
