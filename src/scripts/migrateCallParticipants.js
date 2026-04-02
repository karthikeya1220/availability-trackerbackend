#!/usr/bin/env node

/**
 * Data Migration Script: Email-Based to ID-Based Participants
 * 
 * This script migrates call_participants from email-only storage to
 * proper foreign key relationships with user_id and mentor_id.
 * 
 * Usage: node src/scripts/migrateCallParticipants.js [--dry-run]
 * 
 * The script:
 * 1. Finds all participants with email but no user_id/mentor_id
 * 2. Looks up the user by email
 * 3. Updates the participant record with user_id or mentor_id (based on role)
 * 4. Optionally removes the email field
 */

import { prisma } from "../lib/prisma.js";

const isDryRun = process.argv.includes("--dry-run");

async function migrateCallParticipants() {
  console.log(`\n📋 Call Participant Email-to-ID Migration`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}\n`);

  try {
    // Find all participants that need migration
    const emailBasedParticipants = await prisma.callParticipant.findMany({
      where: {
        email: {
          not: null,
        },
        userId: null,
        mentorId: null,
      },
      include: {
        call: true,
      },
    });

    console.log(`Found ${emailBasedParticipants.length} participants to migrate\n`);

    if (emailBasedParticipants.length === 0) {
      console.log("✅ All participants are already migrated!");
      return;
    }

    let migrated = 0;
    let failed = 0;
    let notFound = 0;

    for (const participant of emailBasedParticipants) {
      try {
        console.log(`\nProcessing: ${participant.email}`);
        console.log(`  Participant ID: ${participant.id}`);
        console.log(`  Call ID: ${participant.callId}`);

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email: participant.email.toLowerCase() },
        });

        if (!user) {
          console.log(`  ⚠️  No user found with email: ${participant.email}`);
          notFound++;
          continue;
        }

        console.log(`  ✓ Found user: ${user.name} (ID: ${user.id}, Role: ${user.role})`);

        // Update participant with appropriate field based on user role
        const updateData = {
          email: null, // Clear email after migration
        };

        if (user.role === "MENTOR") {
          updateData.mentorId = user.id;
          console.log(`  → Setting mentorId: ${user.id}`);
        } else {
          updateData.userId = user.id;
          console.log(`  → Setting userId: ${user.id}`);
        }

        if (!isDryRun) {
          await prisma.callParticipant.update({
            where: { id: participant.id },
            data: updateData,
          });
          console.log(`  ✅ Updated in database`);
        } else {
          console.log(`  [DRY RUN] Would update with:`, updateData);
        }

        migrated++;
      } catch (error) {
        console.error(`  ❌ Error migrating participant ${participant.id}:`, error.message);
        failed++;
      }
    }

    // Summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total participants found: ${emailBasedParticipants.length}`);
    console.log(`   Successfully migrated: ${migrated}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Users not found: ${notFound}`);
    console.log(`   Mode: ${isDryRun ? "DRY RUN (no changes made)" : "LIVE (changes applied)"}\n`);

    if (isDryRun && migrated > 0) {
      console.log(
        "Run without --dry-run to apply changes:\n  node src/scripts/migrateCallParticipants.js\n"
      );
    }

    // Validate migration
    console.log("🔍 Validating migration...\n");
    const remainingEmailOnly = await prisma.callParticipant.findMany({
      where: {
        email: {
          not: null,
        },
        userId: null,
        mentorId: null,
      },
    });

    if (remainingEmailOnly.length === 0) {
      console.log("✅ All participants have been properly migrated!\n");
    } else {
      console.log(
        `⚠️  ${remainingEmailOnly.length} participants still have email-only entries\n`
      );
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateCallParticipants();
