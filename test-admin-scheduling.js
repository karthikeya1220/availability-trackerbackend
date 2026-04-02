#!/usr/bin/env node

/**
 * Admin Scheduling Flow - Test Script
 * 
 * Demonstrates the complete 3-step workflow:
 * 1. Get recommendations for a user
 * 2. Find overlapping availability
 * 3. Book a call
 * 
 * Run with: node test-admin-scheduling.js
 */

import { prisma } from "./src/lib/prisma.js";
import { recommendMentors } from "./src/services/mentorRecommendation.js";
import { findOverlappingSlots } from "./src/controllers/availabilityController.js";

async function testAdminSchedulingFlow() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║          ADMIN SCHEDULING FLOW - TEST SCENARIO            ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    // Get test users
    const users = await prisma.user.findMany({
      where: { role: "USER" },
      include: { userProfile: true },
      take: 1,
    });

    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      include: { mentorProfile: true },
      take: 5,
    });

    if (!users[0]) {
      console.log("❌ No test user found. Run seed script first.\n");
      return;
    }

    if (mentors.length === 0) {
      console.log("❌ No test mentors found. Run seed script first.\n");
      return;
    }

    const testUser = users[0];
    console.log("👤 TEST USER:");
    console.log(`   Name: ${testUser.name}`);
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Profile: ${testUser.userProfile ? "✅ Set up" : "❌ Not set up"}`);

    if (!testUser.userProfile) {
      console.log("\n❌ Test user has no profile. Skipping workflow.\n");
      return;
    }

    console.log(`   Interests: ${testUser.userProfile.interests.join(", ")}`);
    console.log(`   Goal: ${testUser.userProfile.goal}`);
    console.log(`   Domain: ${testUser.userProfile.domain}\n`);

    // ============================================
    // STEP 1: GET RECOMMENDATIONS
    // ============================================
    console.log("┌─ STEP 1: GET RECOMMENDATIONS ─────────────────────────────┐");

    const mentorProfiles = mentors
      .filter((m) => m.mentorProfile)
      .map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        ...m.mentorProfile,
      }));

    console.log(`\n🔍 Analyzing ${mentorProfiles.length} mentors...\n`);

    const recommendations = recommendMentors(
      testUser.userProfile,
      mentorProfiles,
      "general",
      3
    );

    console.log(`✅ Found ${recommendations.length} recommendations:\n`);

    recommendations.forEach((rec, idx) => {
      console.log(`   ${idx + 1}. ${rec.name}`);
      console.log(`      Company: ${rec.company}`);
      console.log(`      Expertise: ${rec.expertise.join(", ")}`);
      console.log(`      Score: ${Math.round(rec.score * 100) / 100}`);
      console.log(`      Match: ${Math.round(rec.matchPercentage)}%`);
      console.log(`      Reasoning: ${rec.reasoning.join(" | ")}\n`);
    });

    const selectedMentor = recommendations[0];
    console.log(
      `✅ Selected: ${selectedMentor.name} (${Math.round(selectedMentor.matchPercentage)}% match)\n`
    );
    console.log("└──────────────────────────────────────────────────────────\n");

    // ============================================
    // STEP 2: FIND OVERLAPPING SLOTS
    // ============================================
    console.log("┌─ STEP 2: FIND OVERLAPPING SLOTS ──────────────────────────┐");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStart = tomorrow.toISOString().split("T")[0];

    const nextWeek = new Date(tomorrow);
    nextWeek.setDate(nextWeek.getDate() + 6);
    const dateEnd = nextWeek.toISOString().split("T")[0];

    console.log(
      `\n📅 Searching for overlaps between ${dateStart} and ${dateEnd}...\n`
    );

    const overlaps = await findOverlappingSlots(
      testUser.id,
      selectedMentor.id,
      new Date(dateStart),
      new Date(dateEnd)
    );

    console.log(
      `✅ Found ${overlaps.length} overlapping slots available:\n`
    );

    if (overlaps.length > 0) {
      overlaps.slice(0, 3).forEach((overlap, idx) => {
        console.log(`   ${idx + 1}. ${overlap.date}`);
        const userStart = new Date(overlap.userSlot.startTime);
        const userEnd = new Date(overlap.userSlot.endTime);
        console.log(
          `      User availability: ${userStart.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })} - ${userEnd.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })} UTC`
        );

        const mentorStart = new Date(overlap.mentorSlot.startTime);
        const mentorEnd = new Date(overlap.mentorSlot.endTime);
        console.log(
          `      Mentor availability: ${mentorStart.toLocaleTimeString(
            "en-US",
            { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }
          )} - ${mentorEnd.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })} UTC`
        );

        const overlapStart = new Date(overlap.overlapPeriod.startTime);
        const overlapEnd = new Date(overlap.overlapPeriod.endTime);
        console.log(
          `      ✅ Overlap: ${overlapStart.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })} - ${overlapEnd.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })} UTC (${overlap.overlapPeriod.durationMinutes} min)\n`
        );
      });

      if (overlaps.length > 3) {
        console.log(`   ... and ${overlaps.length - 3} more overlapping slots\n`);
      }

      const selectedOverlap = overlaps[0];
      console.log(
        `✅ Selected: ${selectedOverlap.date} at ${new Date(selectedOverlap.overlapPeriod.startTime).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        })} UTC\n`
      );

      console.log("└──────────────────────────────────────────────────────────\n");

      // ============================================
      // STEP 3: BOOKING CONFIRMATION
      // ============================================
      console.log("┌─ STEP 3: BOOKING CONFIRMATION ─────────────────────────┐");

      const overlapStart = new Date(selectedOverlap.overlapPeriod.startTime);
      const overlapEnd = new Date(selectedOverlap.overlapPeriod.endTime);

      // Reduce end time by 30 min for a realistic meeting
      overlapEnd.setMinutes(overlapEnd.getMinutes() - 30);

      console.log(`\n📞 Booking details:\n`);
      console.log(`   User: ${testUser.name}`);
      console.log(`   Mentor: ${selectedMentor.name}`);
      console.log(`   Date: ${selectedOverlap.date}`);
      console.log(
        `   Time: ${overlapStart.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        })} - ${overlapEnd.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        })} UTC`
      );
      console.log(
        `   Duration: ${Math.round((overlapEnd - overlapStart) / (1000 * 60))} minutes`
      );
      console.log(`\n   User Slot ID: ${selectedOverlap.userSlot.id}`);
      console.log(`   Mentor Slot ID: ${selectedOverlap.mentorSlot.id}\n`);

      console.log("⚠️  NOTE: Use above details with POST /api/admin/schedule/book\n");
      console.log("   Example curl:\n");
      console.log(
        `   curl -X POST "http://localhost:5001/api/admin/schedule/book" \\`
      );
      console.log(`     -H "Authorization: Bearer <admin-token>" \\`);
      console.log(`     -H "Content-Type: application/json" \\`);
      console.log(`     -d '{`);
      console.log(`       "user_id": "${testUser.id}",`);
      console.log(`       "mentor_id": "${selectedMentor.id}",`);
      console.log(`       "user_slot_id": "${selectedOverlap.userSlot.id}",`);
      console.log(`       "mentor_slot_id": "${selectedOverlap.mentorSlot.id}",`);
      console.log(`       "title": "Mentoring Session",`);
      console.log(`       "start_time": "${overlapStart.toISOString()}",`);
      console.log(`       "end_time": "${overlapEnd.toISOString()}"`);
      console.log(`     }'\n`);

      console.log("└──────────────────────────────────────────────────────────\n");
    } else {
      console.log("❌ No overlapping slots found for this week.\n");
      console.log("   Try a different mentor or adjust availability.\n");
      console.log("└──────────────────────────────────────────────────────────\n");
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║                       WORKFLOW SUMMARY                     ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("✅ STEP 1 - RECOMMENDATIONS");
    console.log(`   ${recommendations.length} mentors ranked by match score\n`);

    console.log("✅ STEP 2 - OVERLAPS");
    console.log(`   ${overlaps.length} overlapping slots found\n`);

    console.log("⏳ STEP 3 - BOOKING");
    console.log("   Ready for API call to POST /api/admin/schedule/book\n");

    console.log("📊 STATISTICS:");
    console.log(`   Test User: ${testUser.name}`);
    console.log(`   Selected Mentor: ${selectedMentor.name}`);
    console.log(
      `   Match Score: ${Math.round(selectedMentor.matchPercentage)}%`
    );
    console.log(`   Available Slots: ${overlaps.length}`);
    console.log(`   First Available: ${overlaps.length > 0 ? overlaps[0].date : "N/A"}\n`);
  } catch (error) {
    console.error("❌ Error during workflow:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testAdminSchedulingFlow();
