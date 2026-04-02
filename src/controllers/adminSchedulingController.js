/**
 * Admin Scheduling Controller
 * 
 * Manages the complete admin scheduling workflow:
 * 1. Get recommendations for a user
 * 2. Find overlapping availability between user and mentor
 * 3. Book a call on a selected slot
 */

import { prisma } from "../lib/prisma.js";
import { v4 as uuidv4 } from "uuid";
import { recommendMentors } from "../services/mentorRecommendation.js";
import { findOverlappingSlots } from "./availabilityController.js";

/**
 * Step 1: Admin selects user and gets recommendations
 * 
 * GET /api/admin/schedule/recommendations
 * Query params:
 * - user_id (required): User to get recommendations for
 * - call_type (optional): resume_revamp | job_market_guidance | mock_interview
 * - limit (optional): Number of recommendations (default: 5, max: 20)
 */
export async function getSchedulingRecommendations(req, res, next) {
  try {
    // Admin-only check
    if (req.userRole !== "ADMIN") {
      return res.status(403).json({
        error: "Only admins can access this endpoint",
      });
    }

    const { user_id, call_type, limit } = req.query;

    // Validate required parameter
    if (!user_id) {
      return res.status(400).json({
        error: "user_id query parameter is required",
      });
    }

    // Validate and parse limit
    const limitNum = Math.min(Math.max(parseInt(limit) || 5, 1), 20);

    // Validate call_type if provided
    const validCallTypes = [
      "resume_revamp",
      "job_market_guidance",
      "mock_interview",
      "general",
    ];
    const callType =
      call_type && validCallTypes.includes(call_type) ? call_type : null;

    // Fetch user and profile
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      include: { userProfile: true },
    });

    if (!user) {
      return res.status(404).json({
        error: `User with ID "${user_id}" not found`,
      });
    }

    if (!user.userProfile) {
      return res.status(400).json({
        error: `User "${user.name}" does not have a profile set up`,
        userId: user_id,
        userName: user.name,
      });
    }

    // Fetch all active mentors with profiles
    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      include: { mentorProfile: true },
    });

    const mentorProfiles = mentors
      .filter((m) => m.mentorProfile)
      .map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        ...m.mentorProfile,
      }));

    if (mentorProfiles.length === 0) {
      return res.json({
        userId: user_id,
        userName: user.name,
        recommendations: [],
        callType: callType || "general",
        message: "No mentors with complete profiles available",
      });
    }

    // Run recommendation engine
    const recommendations = recommendMentors(
      user.userProfile,
      mentorProfiles,
      callType,
      limitNum
    );

    res.json({
      step: 1,
      userId: user_id,
      userName: user.name,
      userProfile: {
        interests: user.userProfile.interests,
        goal: user.userProfile.goal,
        domain: user.userProfile.domain,
      },
      callType: callType || "general",
      requestedLimit: limitNum,
      returnedCount: recommendations.length,
      recommendations: recommendations.map((rec) => ({
        mentorId: rec.id,
        mentorName: rec.name,
        mentorEmail: rec.email,
        company: rec.company,
        expertise: rec.expertise,
        communicationScore: rec.communicationScore,
        rating: rec.rating,
        yearsOfExperience: rec.yearsOfExperience,
        score: Math.round(rec.score * 100) / 100,
        matchPercentage: Math.round(rec.matchPercentage),
        reasoning: rec.reasoning,
      })),
      nextStep:
        "POST /api/admin/schedule/overlaps to find available slots",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Step 2: Admin selects mentor and finds overlapping availability
 * 
 * POST /api/admin/schedule/overlaps
 * Body:
 * {
 *   user_id: string (required)
 *   mentor_id: string (required)
 *   date_start: string (optional, YYYY-MM-DD format)
 *   date_end: string (optional, YYYY-MM-DD format)
 * }
 */
export async function getSchedulingOverlaps(req, res, next) {
  try {
    // Admin-only check
    if (req.userRole !== "ADMIN") {
      return res.status(403).json({
        error: "Only admins can access this endpoint",
      });
    }

    const { user_id, mentor_id, date_start, date_end } = req.body;

    // Validate required parameters
    if (!user_id || !mentor_id) {
      return res.status(400).json({
        error: "user_id and mentor_id are required",
      });
    }

    // Verify both users exist
    const [user, mentor] = await Promise.all([
      prisma.user.findUnique({ where: { id: user_id } }),
      prisma.user.findUnique({ where: { id: mentor_id } }),
    ]);

    if (!user) {
      return res.status(404).json({
        error: `User with ID "${user_id}" not found`,
      });
    }

    if (!mentor) {
      return res.status(404).json({
        error: `Mentor with ID "${mentor_id}" not found`,
      });
    }

    if (mentor.role !== "MENTOR") {
      return res.status(400).json({
        error: `User "${mentor.name}" is not a mentor (role: ${mentor.role})`,
      });
    }

    // Parse and validate dates
    let parsedDateStart = null;
    let parsedDateEnd = null;

    if (date_start) {
      const dateObj = new Date(date_start);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          error: "date_start must be valid ISO date (YYYY-MM-DD)",
        });
      }
      parsedDateStart = dateObj;
    }

    if (date_end) {
      const dateObj = new Date(date_end);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          error: "date_end must be valid ISO date (YYYY-MM-DD)",
        });
      }
      parsedDateEnd = dateObj;
    }

    // Find overlapping slots
    const overlaps = await findOverlappingSlots(
      user_id,
      mentor_id,
      parsedDateStart,
      parsedDateEnd
    );

    // Check which overlaps are already booked
    const slotIds = new Set();
    overlaps.forEach((overlap) => {
      slotIds.add(overlap.userSlot.id);
      slotIds.add(overlap.mentorSlot.id);
    });

    const bookedSlots = await prisma.availability.findMany({
      where: {
        id: { in: Array.from(slotIds) },
        isBooked: true,
      },
      select: { id: true },
    });

    const bookedSlotIds = new Set(bookedSlots.map((s) => s.id));

    // Filter out overlaps where either slot is already booked
    const availableOverlaps = overlaps.filter(
      (overlap) =>
        !bookedSlotIds.has(overlap.userSlot.id) &&
        !bookedSlotIds.has(overlap.mentorSlot.id)
    );

    res.json({
      step: 2,
      userId: user_id,
      userName: user.name,
      mentorId: mentor_id,
      mentorName: mentor.name,
      dateRange: {
        startDate: date_start || null,
        endDate: date_end || null,
      },
      totalOverlaps: overlaps.length,
      bookedOverlaps: overlaps.length - availableOverlaps.length,
      availableOverlaps: availableOverlaps.length,
      overlaps: availableOverlaps.map((overlap) => ({
        overlapId: `${overlap.userSlot.id}-${overlap.mentorSlot.id}`,
        date: overlap.date,
        userSlot: {
          id: overlap.userSlot.id,
          startTime: overlap.userSlot.startTime,
          endTime: overlap.userSlot.endTime,
        },
        mentorSlot: {
          id: overlap.mentorSlot.id,
          startTime: overlap.mentorSlot.startTime,
          endTime: overlap.mentorSlot.endTime,
        },
        overlapPeriod: overlap.overlapPeriod,
      })),
      nextStep:
        "POST /api/admin/schedule/book to book a call on selected slot",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Step 3: Admin selects slot and books a call
 * 
 * POST /api/admin/schedule/book
 * Body:
 * {
 *   user_id: string (required)
 *   mentor_id: string (required)
 *   user_slot_id: string (required) - Availability slot ID for user
 *   mentor_slot_id: string (required) - Availability slot ID for mentor
 *   title: string (optional) - Call title
 *   start_time: string (ISO format, required) - Call start time
 *   end_time: string (ISO format, required) - Call end time
 * }
 */
export async function bookScheduledCall(req, res, next) {
  try {
    // Admin-only check
    if (req.userRole !== "ADMIN") {
      return res.status(403).json({
        error: "Only admins can access this endpoint",
      });
    }

    const {
      user_id,
      mentor_id,
      user_slot_id,
      mentor_slot_id,
      title,
      start_time,
      end_time,
    } = req.body;

    // Validate required parameters
    if (
      !user_id ||
      !mentor_id ||
      !user_slot_id ||
      !mentor_slot_id ||
      !start_time ||
      !end_time
    ) {
      return res.status(400).json({
        error:
          "user_id, mentor_id, user_slot_id, mentor_slot_id, start_time, and end_time are required",
      });
    }

    // Parse times
    const startTime = new Date(start_time);
    const endTime = new Date(end_time);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return res.status(400).json({
        error: "start_time and end_time must be valid ISO dates",
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        error: "start_time must be before end_time",
      });
    }

    // Verify both users exist
    const [user, mentor] = await Promise.all([
      prisma.user.findUnique({ where: { id: user_id } }),
      prisma.user.findUnique({ where: { id: mentor_id } }),
    ]);

    if (!user) {
      return res.status(404).json({
        error: `User with ID "${user_id}" not found`,
      });
    }

    if (!mentor) {
      return res.status(404).json({
        error: `Mentor with ID "${mentor_id}" not found`,
      });
    }

    // Fetch both availability slots
    const [userSlot, mentorSlot] = await Promise.all([
      prisma.availability.findUnique({
        where: { id: user_slot_id },
      }),
      prisma.availability.findUnique({
        where: { id: mentor_slot_id },
      }),
    ]);

    // Validate slots exist
    if (!userSlot) {
      return res.status(404).json({
        error: `User availability slot "${user_slot_id}" not found`,
      });
    }

    if (!mentorSlot) {
      return res.status(404).json({
        error: `Mentor availability slot "${mentor_slot_id}" not found`,
      });
    }

    // Validate slot ownership
    if (
      userSlot.entityId !== user_id ||
      userSlot.entityType !== "user"
    ) {
      return res.status(400).json({
        error: `Slot "${user_slot_id}" does not belong to user "${user_id}"`,
      });
    }

    if (
      mentorSlot.entityId !== mentor_id ||
      mentorSlot.entityType !== "mentor"
    ) {
      return res.status(400).json({
        error: `Slot "${mentor_slot_id}" does not belong to mentor "${mentor_id}"`,
      });
    }

    // Validate slots are not already booked
    if (userSlot.isBooked) {
      return res.status(409).json({
        error: `User availability slot "${user_slot_id}" is already booked`,
      });
    }

    if (mentorSlot.isBooked) {
      return res.status(409).json({
        error: `Mentor availability slot "${mentor_slot_id}" is already booked`,
      });
    }

    // Validate requested call time is within both availability slots
    const userSlotStart = new Date(userSlot.startTime);
    const userSlotEnd = new Date(userSlot.endTime);
    const mentorSlotStart = new Date(mentorSlot.startTime);
    const mentorSlotEnd = new Date(mentorSlot.endTime);

    if (
      startTime < userSlotStart ||
      endTime > userSlotEnd ||
      startTime < mentorSlotStart ||
      endTime > mentorSlotEnd
    ) {
      return res.status(400).json({
        error:
          "Call time must be within both user and mentor availability slots",
        userSlotWindow: {
          startTime: userSlot.startTime,
          endTime: userSlot.endTime,
        },
        mentorSlotWindow: {
          startTime: mentorSlot.startTime,
          endTime: mentorSlot.endTime,
        },
        requestedCallTime: {
          startTime: start_time,
          endTime: end_time,
        },
      });
    }

    // Start transaction: create call and mark slots as booked
    const result = await prisma.$transaction(async (tx) => {
      // Create call
      const call = await tx.call.create({
        data: {
          id: uuidv4(),
          adminId: req.userId,
          title: title || `Call between ${user.name} and ${mentor.name}`,
          startTime: startTime,
          endTime: endTime,
        },
      });

      // Add participants
      await Promise.all([
        tx.callParticipant.create({
          data: {
            id: uuidv4(),
            callId: call.id,
            userId: user_id,
          },
        }),
        tx.callParticipant.create({
          data: {
            id: uuidv4(),
            callId: call.id,
            mentorId: mentor_id,
          },
        }),
      ]);

      // Mark slots as booked
      const now = new Date();
      await Promise.all([
        tx.availability.update({
          where: { id: user_slot_id },
          data: {
            isBooked: true,
            bookedAt: now,
          },
        }),
        tx.availability.update({
          where: { id: mentor_slot_id },
          data: {
            isBooked: true,
            bookedAt: now,
          },
        }),
      ]);

      return call;
    });

    res.status(201).json({
      step: 3,
      success: true,
      message: "Call booked successfully",
      call: {
        id: result.id,
        title: result.title,
        startTime: result.startTime,
        endTime: result.endTime,
        durationMinutes: Math.round(
          (result.endTime.getTime() - result.startTime.getTime()) / (1000 * 60)
        ),
        admin: {
          id: req.userId,
          role: "ADMIN",
        },
        participants: [
          {
            id: user_id,
            name: user.name,
            email: user.email,
            role: "USER",
          },
          {
            id: mentor_id,
            name: mentor.name,
            email: mentor.email,
            role: "MENTOR",
          },
        ],
      },
      bookingDetails: {
        userSlot: {
          id: user_slot_id,
          availability: {
            startTime: userSlot.startTime,
            endTime: userSlot.endTime,
          },
          marked: "BOOKED",
        },
        mentorSlot: {
          id: mentor_slot_id,
          availability: {
            startTime: mentorSlot.startTime,
            endTime: mentorSlot.endTime,
          },
          marked: "BOOKED",
        },
      },
      workflow: {
        step1: "✅ Recommendations fetched",
        step2: "✅ Overlapping slots identified",
        step3: "✅ Call booked",
      },
    });
  } catch (err) {
    next(err);
  }
}
