import { prisma } from "../lib/prisma.js";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/calls
 * Admin books a call between a user and mentor.
 * Body: { userId, mentorId, callType, startTime, endTime, notes? }
 */
export async function bookCall(req, res, next) {
  try {
    const adminId = req.userId;
    const { userId, mentorId, callType, startTime, endTime, notes, title } = req.body;
    
    // Generate a mock meet link for product demonstration
    const mockMeetLink = `https://meet.google.com/${uuidv4().slice(0, 3)}-${uuidv4().slice(0, 4)}-${uuidv4().slice(0, 3)}`;
    
    console.log("DEBUG: bookCall payload:", JSON.stringify(req.body, null, 2));

    // Validate required fields
    const missing = [];
    if (!userId) missing.push("userId");
    if (!mentorId) missing.push("mentorId");
    if (!callType) missing.push("callType");
    if (!startTime) missing.push("startTime");
    if (!endTime) missing.push("endTime");

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(", ")}`,
        payload: req.body
      });
    }

    const VALID_CALL_TYPES = ["RESUME_REVAMP", "JOB_MARKET_GUIDANCE", "MOCK_INTERVIEW"];
    const normalizedCallType = callType.toUpperCase().replace(/ /g, "_");
    if (!VALID_CALL_TYPES.includes(normalizedCallType)) {
      return res.status(400).json({
        error: `callType must be one of: ${VALID_CALL_TYPES.join(", ")}`,
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid startTime or endTime" });
    }
    if (start >= end) {
      return res.status(400).json({ error: "endTime must be after startTime" });
    }
    if (start <= new Date()) {
      return res.status(400).json({ error: "Cannot book a call in the past" });
    }

    // Verify user and mentor exist with correct roles
    const [user, mentor] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, name: true } }),
      prisma.user.findUnique({ where: { id: mentorId }, select: { id: true, role: true, name: true } }),
    ]);

    if (!user || user.role !== "USER") {
      return res.status(404).json({ error: "User not found" });
    }
    if (!mentor || mentor.role !== "MENTOR") {
      return res.status(404).json({ error: "Mentor not found" });
    }

    // Check for existing conflicting calls (same user or mentor in this time window)
    const conflict = await prisma.call.findFirst({
      where: {
        status: "SCHEDULED",
        OR: [
          {
            userId,
            startTime: { lt: end },
            endTime: { gt: start },
          },
          {
            mentorId,
            startTime: { lt: end },
            endTime: { gt: start },
          },
        ],
      },
    });

    if (conflict) {
      return res.status(409).json({
        error: "Time slot conflict — either the user or mentor already has a call booked in this window",
        code: "SLOT_CONFLICT",
      });
    }

    const call = await prisma.call.create({
      data: {
        id: uuidv4(),
        userId,
        mentorId,
        adminId,
        callType: normalizedCallType,
        title: title?.trim() || `Mentoring: ${normalizedCallType.replace(/_/g, " ")}`,
        startTime: start,
        endTime: end,
        status: "SCHEDULED",
        meetLink: req.body.meetLink || mockMeetLink,
        notes: notes?.trim() || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
        admin: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(call);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/calls
 * List calls. Admin sees all; users/mentors see their own.
 * Query: ?status=SCHEDULED&userId=&mentorId=&from=&to=
 */
export async function listCalls(req, res, next) {
  try {
    const { status, userId, mentorId, from, to } = req.query;
    const callerId = req.userId;
    const callerRole = req.userRole;

    const where = {};

    // Non-admins can only see their own calls
    if (callerRole === "USER") {
      where.userId = callerId;
    } else if (callerRole === "MENTOR") {
      where.mentorId = callerId;
    } else {
      // ADMIN — can filter by any user/mentor
      if (userId) where.userId = userId;
      if (mentorId) where.mentorId = mentorId;
    }

    if (status) where.status = status.toUpperCase();
    if (from) where.startTime = { ...where.startTime, gte: new Date(from) };
    if (to) where.endTime = { ...where.endTime, lte: new Date(to) };

    const calls = await prisma.call.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
        admin: { select: { id: true, name: true } },
      },
      orderBy: { startTime: "asc" },
    });

    res.json(calls);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/calls/:callId
 * Get a single call by ID.
 */
export async function getCall(req, res, next) {
  try {
    const { callId } = req.params;
    const callerId = req.userId;
    const callerRole = req.userRole;

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
        admin: { select: { id: true, name: true } },
      },
    });

    if (!call) return res.status(404).json({ error: "Call not found" });

    // Access control
    if (
      callerRole !== "ADMIN" &&
      call.userId !== callerId &&
      call.mentorId !== callerId
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(call);
  } catch (e) {
    next(e);
  }
}

/**
 * PATCH /api/calls/:callId/status
 * Update call status (admin only).
 * Body: { status: "COMPLETED" | "CANCELLED" }
 */
export async function updateCallStatus(req, res, next) {
  try {
    const { callId } = req.params;
    const { status } = req.body;

    const VALID_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"];
    if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({
        error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) return res.status(404).json({ error: "Call not found" });

    const updated = await prisma.call.update({
      where: { id: callId },
      data: { status: status.toUpperCase() },
      include: {
        user: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
        admin: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
}

/**
 * DELETE /api/calls/:callId
 * Cancel / delete a call (admin only).
 */
export async function deleteCall(req, res, next) {
  try {
    const { callId } = req.params;

    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) return res.status(404).json({ error: "Call not found" });

    // Soft cancel rather than hard delete — preserves history
    const updated = await prisma.call.update({
      where: { id: callId },
      data: { status: "CANCELLED" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({ ok: true, call: updated });
  } catch (e) {
    next(e);
  }
}
