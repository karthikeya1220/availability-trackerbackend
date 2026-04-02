/**
 * Call Participant Service
 * Handles call/meeting participant management with proper referential integrity
 * Ensures relationships: scheduled_calls → users → mentors
 */

import { prisma } from "../lib/prisma.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Add a user participant to a call
 * @param {string} callId - ID of the call
 * @param {string} userId - ID of the user
 * @returns {Object} Created call participant
 */
export async function addUserParticipant(callId, userId) {
  // Verify call exists
  const call = await prisma.call.findUnique({
    where: { id: callId },
  });

  if (!call) {
    throw new Error(`Call not found: ${callId}`);
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Create participant
  const participant = await prisma.callParticipant.create({
    data: {
      id: uuidv4(),
      callId,
      userId,
      mentorId: null,
      email: null,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
      mentor: true,
    },
  });

  return participant;
}

/**
 * Add a mentor participant to a call
 * @param {string} callId - ID of the call
 * @param {string} mentorId - ID of the mentor (User with role MENTOR)
 * @returns {Object} Created call participant
 */
export async function addMentorParticipant(callId, mentorId) {
  // Verify call exists
  const call = await prisma.call.findUnique({
    where: { id: callId },
  });

  if (!call) {
    throw new Error(`Call not found: ${callId}`);
  }

  // Verify mentor exists and has MENTOR role
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
  });

  if (!mentor) {
    throw new Error(`Mentor not found: ${mentorId}`);
  }

  if (mentor.role !== "MENTOR") {
    throw new Error(`User ${mentorId} is not a mentor (role: ${mentor.role})`);
  }

  // Create participant
  const participant = await prisma.callParticipant.create({
    data: {
      id: uuidv4(),
      callId,
      userId: null,
      mentorId,
      email: null,
    },
    include: {
      user: true,
      mentor: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  return participant;
}

/**
 * Remove a participant from a call
 * @param {string} participantId - ID of the call participant
 * @returns {Object} Deleted participant
 */
export async function removeParticipant(participantId) {
  const participant = await prisma.callParticipant.delete({
    where: { id: participantId },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
      mentor: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  return participant;
}

/**
 * Get all participants for a call
 * @param {string} callId - ID of the call
 * @returns {Array} Array of participants with user/mentor details
 */
export async function getCallParticipants(callId) {
  const participants = await prisma.callParticipant.findMany({
    where: { callId },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, timezone: true },
      },
      mentor: {
        select: { id: true, name: true, email: true, role: true, timezone: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return participants;
}

/**
 * Get detailed call information with all participants
 * @param {string} callId - ID of the call
 * @returns {Object} Call with full participant details
 */
export async function getCallWithParticipants(callId) {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      admin: {
        select: { id: true, name: true, email: true, role: true },
      },
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true, timezone: true },
          },
          mentor: {
            select: { id: true, name: true, email: true, role: true, timezone: true },
          },
        },
      },
    },
  });

  return call;
}

/**
 * Update a participant (replace user/mentor)
 * @param {string} participantId - ID of the call participant
 * @param {Object} data - Update data { userId?, mentorId? }
 * @returns {Object} Updated participant
 */
export async function updateParticipant(participantId, data) {
  const { userId, mentorId } = data;

  // Validate at least one ID provided
  if (!userId && !mentorId) {
    throw new Error("Either userId or mentorId must be provided");
  }

  // If updating userId, verify user exists
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
  }

  // If updating mentorId, verify mentor exists and has MENTOR role
  if (mentorId) {
    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
    });
    if (!mentor) {
      throw new Error(`Mentor not found: ${mentorId}`);
    }
    if (mentor.role !== "MENTOR") {
      throw new Error(`User ${mentorId} is not a mentor (role: ${mentor.role})`);
    }
  }

  // Update participant
  const participant = await prisma.callParticipant.update({
    where: { id: participantId },
    data: {
      userId: userId || null,
      mentorId: mentorId || null,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
      mentor: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  return participant;
}

/**
 * Check if a user is already a participant in a call
 * @param {string} callId - ID of the call
 * @param {string} userId - ID of the user
 * @returns {boolean} True if user is already a participant
 */
export async function isUserParticipant(callId, userId) {
  const participant = await prisma.callParticipant.findFirst({
    where: {
      callId,
      userId,
    },
  });

  return !!participant;
}

/**
 * Check if a mentor is already a participant in a call
 * @param {string} callId - ID of the call
 * @param {string} mentorId - ID of the mentor
 * @returns {boolean} True if mentor is already a participant
 */
export async function isMentorParticipant(callId, mentorId) {
  const participant = await prisma.callParticipant.findFirst({
    where: {
      callId,
      mentorId,
    },
  });

  return !!participant;
}

/**
 * Get all calls for a specific user
 * @param {string} userId - ID of the user
 * @param {Object} options - Query options { from?, to? }
 * @returns {Array} Array of calls user is participating in
 */
export async function getUserCalls(userId, options = {}) {
  const { from, to } = options;

  const where = {
    participants: {
      some: {
        userId,
      },
    },
  };

  if (from || to) {
    where.startTime = {};
    if (from) where.startTime.gte = new Date(from);
    if (to) where.startTime.lte = new Date(to);
  }

  const calls = await prisma.call.findMany({
    where,
    include: {
      admin: {
        select: { id: true, name: true, email: true },
      },
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          mentor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  return calls;
}

/**
 * Get all calls for a specific mentor
 * @param {string} mentorId - ID of the mentor
 * @param {Object} options - Query options { from?, to? }
 * @returns {Array} Array of calls mentor is participating in
 */
export async function getMentorCalls(mentorId, options = {}) {
  const { from, to } = options;

  const where = {
    participants: {
      some: {
        mentorId,
      },
    },
  };

  if (from || to) {
    where.startTime = {};
    if (from) where.startTime.gte = new Date(from);
    if (to) where.startTime.lte = new Date(to);
  }

  const calls = await prisma.call.findMany({
    where,
    include: {
      admin: {
        select: { id: true, name: true, email: true },
      },
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          mentor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  return calls;
}

/**
 * Validate call participant relationships exist
 * Useful for verifying referential integrity after migration
 * @param {string} callId - ID of the call
 * @returns {Object} Validation result { valid, errors }
 */
export async function validateCallParticipants(callId) {
  const errors = [];

  const participants = await prisma.callParticipant.findMany({
    where: { callId },
  });

  for (const p of participants) {
    // At least one of userId or mentorId must exist
    if (!p.userId && !p.mentorId) {
      errors.push(`Participant ${p.id} has neither userId nor mentorId`);
    }

    // If userId exists, user must exist
    if (p.userId) {
      const user = await prisma.user.findUnique({
        where: { id: p.userId },
      });
      if (!user) {
        errors.push(`Participant ${p.id} references non-existent user ${p.userId}`);
      }
    }

    // If mentorId exists, mentor must exist
    if (p.mentorId) {
      const mentor = await prisma.user.findUnique({
        where: { id: p.mentorId },
      });
      if (!mentor) {
        errors.push(`Participant ${p.id} references non-existent mentor ${p.mentorId}`);
      } else if (mentor.role !== "MENTOR") {
        errors.push(`Participant ${p.id} references user ${p.mentorId} who is not a MENTOR`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    participantCount: participants.length,
  };
}
