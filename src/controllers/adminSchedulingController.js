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
        code: "UNAUTHORIZED_ADMIN_ONLY",
      });
    }

    const { user_id, call_type, limit } = req.query;

    // Validate required parameter
    if (!user_id) {
      return res.status(400).json({
        error: "user_id query parameter is required",
        code: "MISSING_USER_ID",
        hint: "Provide ?user_id=<uuid> in query parameters",
      });
    }

    // Validate user_id format (basic UUID check)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id)) {
      return res.status(400).json({
        error: "Invalid user_id format",
        code: "INVALID_USER_ID_FORMAT",
        hint: "user_id must be a valid UUID",
        received: user_id,
      });
    }

    // Validate and parse limit
    if (limit && isNaN(parseInt(limit))) {
      return res.status(400).json({
        error: "Invalid limit parameter",
        code: "INVALID_LIMIT_FORMAT",
        hint: "limit must be a number between 1 and 20",
        received: limit,
      });
    }

    const limitNum = Math.min(Math.max(parseInt(limit) || 5, 1), 20);

    // Validate call_type if provided
    const validCallTypes = [
      "resume_revamp",
      "job_market_guidance",
      "mock_interview",
      "general",
    ];
    if (call_type && !validCallTypes.includes(call_type)) {
      return res.status(400).json({
        error: "Invalid call_type",
        code: "INVALID_CALL_TYPE",
        hint: `call_type must be one of: ${validCallTypes.join(", ")}`,
        received: call_type,
      });
    }
    const callType = call_type && validCallTypes.includes(call_type) ? call_type : null;

    // Fetch user and profile
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      include: { userProfile: true },
    });

    if (!user) {
      return res.status(404).json({
        error: `User with ID "${user_id}" not found`,
        code: "USER_NOT_FOUND",
        userId: user_id,
      });
    }

    if (!user.userProfile) {
      return res.status(400).json({
        error: `User "${user.name}" does not have a profile set up`,
        code: "USER_PROFILE_NOT_SET_UP",
        userId: user_id,
        userName: user.name,
        hint: "Admin must set up user profile before getting recommendations",
      });
    }

    // Fetch all active mentors with profiles
    const allMentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      include: { mentorProfile: true },
    });

    // Check if any mentors exist
    if (allMentors.length === 0) {
      return res.status(400).json({
        step: 1,
        success: false,
        error: "No mentors found in system",
        code: "NO_MENTORS_AVAILABLE",
        userId: user_id,
        userName: user.name,
        totalMentors: 0,
        mentorsWithProfiles: 0,
        hint: "Admin must create mentor accounts before recommendations can be generated",
      });
    }

    const mentorProfiles = allMentors
      .filter((m) => m.mentorProfile)
      .map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        ...m.mentorProfile,
      }));

    // No mentors have complete profiles
    if (mentorProfiles.length === 0) {
      return res.status(400).json({
        step: 1,
        success: false,
        error: "No mentors with complete profiles available",
        code: "NO_MENTORS_WITH_PROFILES",
        userId: user_id,
        userName: user.name,
        totalMentors: allMentors.length,
        mentorsWithProfiles: 0,
        hint: "Mentors must have profiles set up before recommendations can be generated",
      });
    }

    // Run recommendation engine
    const recommendations = recommendMentors(
      user.userProfile,
      mentorProfiles,
      callType,
      limitNum
    );

    // All mentors exist but no recommendations match
    if (recommendations.length === 0) {
      return res.status(400).json({
        step: 1,
        success: false,
        error: "No suitable mentor recommendations found",
        code: "NO_RECOMMENDATIONS_FOUND",
        userId: user_id,
        userName: user.name,
        callType: callType || "general",
        totalMentors: mentorProfiles.length,
        hint: "User profile does not match any mentor expertise/domain. Consider expanding user interests or availability.",
      });
    }

    res.status(200).json({
      step: 1,
      success: true,
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
      totalAvailable: mentorProfiles.length,
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
        code: "UNAUTHORIZED_ADMIN_ONLY",
      });
    }

    const { user_id, mentor_id, date_start, date_end } = req.body;

    // Validate required parameters
    if (!user_id || !mentor_id) {
      return res.status(400).json({
        error: "user_id and mentor_id are required",
        code: "MISSING_REQUIRED_PARAMS",
        hint: "Request body must include { user_id, mentor_id }",
        provided: { user_id: !!user_id, mentor_id: !!mentor_id },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      return res.status(400).json({
        error: "Invalid user_id format",
        code: "INVALID_USER_ID_FORMAT",
        hint: "user_id must be a valid UUID",
        received: user_id,
      });
    }

    if (!uuidRegex.test(mentor_id)) {
      return res.status(400).json({
        error: "Invalid mentor_id format",
        code: "INVALID_MENTOR_ID_FORMAT",
        hint: "mentor_id must be a valid UUID",
        received: mentor_id,
      });
    }

    // Check for self-pairing
    if (user_id === mentor_id) {
      return res.status(400).json({
        error: "User and mentor cannot be the same person",
        code: "SELF_PAIRING_NOT_ALLOWED",
        hint: "Select a different mentor",
        userId: user_id,
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
        code: "USER_NOT_FOUND",
        userId: user_id,
      });
    }

    if (!mentor) {
      return res.status(404).json({
        error: `Mentor with ID "${mentor_id}" not found`,
        code: "MENTOR_NOT_FOUND",
        mentorId: mentor_id,
      });
    }

    if (mentor.role !== "MENTOR") {
      return res.status(400).json({
        error: `User "${mentor.name}" is not a mentor (role: ${mentor.role})`,
        code: "INVALID_MENTOR_ROLE",
        hint: "Select a user with MENTOR role",
        userId: mentor_id,
        role: mentor.role,
      });
    }

    // Parse and validate dates
    let parsedDateStart = null;
    let parsedDateEnd = null;

    if (date_start) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date_start)) {
        return res.status(400).json({
          error: "date_start must be in YYYY-MM-DD format",
          code: "INVALID_DATE_FORMAT",
          hint: "Use format: 2026-04-05",
          received: date_start,
        });
      }
      const dateObj = new Date(date_start);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          error: "date_start is not a valid date",
          code: "INVALID_DATE_VALUE",
          received: date_start,
        });
      }
      parsedDateStart = dateObj;
    }

    if (date_end) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date_end)) {
        return res.status(400).json({
          error: "date_end must be in YYYY-MM-DD format",
          code: "INVALID_DATE_FORMAT",
          hint: "Use format: 2026-04-05",
          received: date_end,
        });
      }
      const dateObj = new Date(date_end);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          error: "date_end is not a valid date",
          code: "INVALID_DATE_VALUE",
          received: date_end,
        });
      }
      parsedDateEnd = dateObj;
    }

    // Validate date range
    if (parsedDateStart && parsedDateEnd && parsedDateStart > parsedDateEnd) {
      return res.status(400).json({
        error: "date_start must be before date_end",
        code: "INVALID_DATE_RANGE",
        dateStart: date_start,
        dateEnd: date_end,
      });
    }

    // Find overlapping slots
    const overlaps = await findOverlappingSlots(
      user_id,
      mentor_id,
      parsedDateStart,
      parsedDateEnd
    );

    // No overlaps found at all
    if (overlaps.length === 0) {
      return res.status(400).json({
        step: 2,
        success: false,
        error: "No overlapping availability found",
        code: "NO_OVERLAPPING_SLOTS",
        userId: user_id,
        userName: user.name,
        mentorId: mentor_id,
        mentorName: mentor.name,
        dateRange: {
          startDate: date_start || null,
          endDate: date_end || null,
        },
        hint: "User and mentor have no common availability. Ask them to add more availability slots.",
      });
    }

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

    // All overlaps are already booked
    if (availableOverlaps.length === 0) {
      return res.status(400).json({
        step: 2,
        success: false,
        error: "All overlapping slots are already booked",
        code: "ALL_SLOTS_BOOKED",
        userId: user_id,
        userName: user.name,
        mentorId: mentor_id,
        mentorName: mentor.name,
        totalOverlaps: overlaps.length,
        bookedOverlaps: overlaps.length,
        availableOverlaps: 0,
        hint: "All time windows where both are available are already reserved. Try a different date range or mentor.",
      });
    }

    res.status(200).json({
      step: 2,
      success: true,
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
        code: "UNAUTHORIZED_ADMIN_ONLY",
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
    const missingParams = [];
    if (!user_id) missingParams.push("user_id");
    if (!mentor_id) missingParams.push("mentor_id");
    if (!user_slot_id) missingParams.push("user_slot_id");
    if (!mentor_slot_id) missingParams.push("mentor_slot_id");
    if (!start_time) missingParams.push("start_time");
    if (!end_time) missingParams.push("end_time");

    if (missingParams.length > 0) {
      return res.status(400).json({
        error: `Missing required parameters: ${missingParams.join(", ")}`,
        code: "MISSING_REQUIRED_PARAMS",
        hint: "Request body must include all required fields",
        missing: missingParams,
      });
    }

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(user_id)) {
      return res.status(400).json({
        error: "Invalid user_id format",
        code: "INVALID_USER_ID_FORMAT",
        hint: "user_id must be a valid UUID",
        received: user_id,
      });
    }

    if (!uuidRegex.test(mentor_id)) {
      return res.status(400).json({
        error: "Invalid mentor_id format",
        code: "INVALID_MENTOR_ID_FORMAT",
        hint: "mentor_id must be a valid UUID",
        received: mentor_id,
      });
    }

    if (!uuidRegex.test(user_slot_id)) {
      return res.status(400).json({
        error: "Invalid user_slot_id format",
        code: "INVALID_SLOT_ID_FORMAT",
        hint: "user_slot_id must be a valid UUID",
        received: user_slot_id,
      });
    }

    if (!uuidRegex.test(mentor_slot_id)) {
      return res.status(400).json({
        error: "Invalid mentor_slot_id format",
        code: "INVALID_SLOT_ID_FORMAT",
        hint: "mentor_slot_id must be a valid UUID",
        received: mentor_slot_id,
      });
    }

    // Parse and validate times
    const startTime = new Date(start_time);
    const endTime = new Date(end_time);

    if (isNaN(startTime.getTime())) {
      return res.status(400).json({
        error: "start_time is not a valid ISO date",
        code: "INVALID_START_TIME_FORMAT",
        hint: "Use ISO format: 2026-04-05T14:00:00Z",
        received: start_time,
      });
    }

    if (isNaN(endTime.getTime())) {
      return res.status(400).json({
        error: "end_time is not a valid ISO date",
        code: "INVALID_END_TIME_FORMAT",
        hint: "Use ISO format: 2026-04-05T15:00:00Z",
        received: end_time,
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        error: "start_time must be before end_time",
        code: "INVALID_TIME_RANGE",
        startTime: start_time,
        endTime: end_time,
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
        code: "USER_NOT_FOUND",
        userId: user_id,
      });
    }

    if (!mentor) {
      return res.status(404).json({
        error: `Mentor with ID "${mentor_id}" not found`,
        code: "MENTOR_NOT_FOUND",
        mentorId: mentor_id,
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
        code: "SLOT_NOT_FOUND",
        hint: "Ensure the slot ID is correct and still exists in the system",
        slotId: user_slot_id,
        slotType: "user",
      });
    }

    if (!mentorSlot) {
      return res.status(404).json({
        error: `Mentor availability slot "${mentor_slot_id}" not found`,
        code: "SLOT_NOT_FOUND",
        hint: "Ensure the slot ID is correct and still exists in the system",
        slotId: mentor_slot_id,
        slotType: "mentor",
      });
    }

    // Validate slot ownership
    if (userSlot.entityId !== user_id || userSlot.entityType !== "user") {
      return res.status(400).json({
        error: `Slot "${user_slot_id}" does not belong to user "${user_id}"`,
        code: "SLOT_OWNERSHIP_MISMATCH",
        hint: "Select a slot that belongs to the specified user",
        slotId: user_slot_id,
        slotOwnerId: userSlot.entityId,
        requestedUserId: user_id,
      });
    }

    if (mentorSlot.entityId !== mentor_id || mentorSlot.entityType !== "mentor") {
      return res.status(400).json({
        error: `Slot "${mentor_slot_id}" does not belong to mentor "${mentor_id}"`,
        code: "SLOT_OWNERSHIP_MISMATCH",
        hint: "Select a slot that belongs to the specified mentor",
        slotId: mentor_slot_id,
        slotOwnerId: mentorSlot.entityId,
        requestedMentorId: mentor_id,
      });
    }

    // Validate slots are not already booked
    if (userSlot.isBooked) {
      return res.status(409).json({
        error: `User availability slot "${user_slot_id}" is already booked`,
        code: "SLOT_ALREADY_BOOKED",
        hint: "Select a different unbooked slot",
        slotId: user_slot_id,
        slotType: "user",
        bookedAt: userSlot.bookedAt,
      });
    }

    if (mentorSlot.isBooked) {
      return res.status(409).json({
        error: `Mentor availability slot "${mentor_slot_id}" is already booked`,
        code: "SLOT_ALREADY_BOOKED",
        hint: "Select a different unbooked slot",
        slotId: mentor_slot_id,
        slotType: "mentor",
        bookedAt: mentorSlot.bookedAt,
      });
    }

    // Validate requested call time is within both availability slots
    const userSlotStart = new Date(userSlot.startTime);
    const userSlotEnd = new Date(userSlot.endTime);
    const mentorSlotStart = new Date(mentorSlot.startTime);
    const mentorSlotEnd = new Date(mentorSlot.endTime);

    if (startTime < userSlotStart || endTime > userSlotEnd) {
      return res.status(400).json({
        error: "Call time must be within user availability slot",
        code: "TIME_OUTSIDE_USER_WINDOW",
        hint: "Adjust call time to fit within user's available slot",
        userSlotWindow: {
          startTime: userSlot.startTime,
          endTime: userSlot.endTime,
        },
        requestedCallTime: {
          startTime: start_time,
          endTime: end_time,
        },
      });
    }

    if (startTime < mentorSlotStart || endTime > mentorSlotEnd) {
      return res.status(400).json({
        error: "Call time must be within mentor availability slot",
        code: "TIME_OUTSIDE_MENTOR_WINDOW",
        hint: "Adjust call time to fit within mentor's available slot",
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
