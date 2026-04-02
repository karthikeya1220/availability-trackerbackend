import { prisma } from "../lib/prisma.js";
import { v4 as uuidv4 } from "uuid";
import {
  isPastDateOnly,
  isPastTime,
  normalizeSlot,
  getWeekStart,
  getWeekDates,
  getSlotsForDate,
  parseDateUTC,
} from "../utils/time.js";

export async function getWeekly(req, res, next) {
  try {
    const { entityId, entityType, weekStart } = req.query;
    const callerId = req.userId;
    const callerRole = req.userRole;

    let where = {};
    let requestedEntityId = null;
    let requestedEntityType = null;

    // If no entity specified, use caller's own entity
    if (!entityId && !entityType) {
      if (callerRole === "MENTOR") {
        where.entityId = callerId;
        where.entityType = "mentor";
        where.role = "MENTOR";
        requestedEntityId = callerId;
        requestedEntityType = "mentor";
      } else {
        where.entityId = callerId;
        where.entityType = "user";
        where.role = "USER";
        requestedEntityId = callerId;
        requestedEntityType = "user";
      }
    } else if (entityId && entityType) {
      // Admin can query other entities with explicit entityId and entityType
      if (callerRole !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can query other entities" });
      }
      where.entityId = String(entityId).trim();
      where.entityType = String(entityType).trim();
      where.role = String(entityType).toUpperCase() === "MENTOR" ? "MENTOR" : "USER";
      requestedEntityId = where.entityId;
      requestedEntityType = where.entityType;
    } else {
      return res.status(400).json({ error: "Must provide both entityId and entityType, or neither" });
    }

    let start;
    if (weekStart) {
      start = new Date(weekStart);
      start.setUTCHours(0, 0, 0, 0);
    } else {
      start = getWeekStart(new Date());
    }

    const weekDates = getWeekDates(start);
    const dateStrs = weekDates.map((d) => d.toISOString().slice(0, 10));
    where.date = { in: weekDates.map((d) => new Date(d.toISOString().slice(0, 10))) };

    const slots = await prisma.availability.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const byDate = {};
    dateStrs.forEach((d) => (byDate[d] = []));
    slots.forEach((s) => {
      const d = s.date.toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({
        id: s.id,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
      });
    });

    res.json({
      weekStart: start.toISOString().slice(0, 10),
      dates: dateStrs,
      availability: byDate,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Find overlapping availability slots between two entities
 * 
 * Overlap conditions:
 * - Same date
 * - start_time < other.end_time AND end_time > other.start_time
 * - Neither slot is already booked
 * 
 * @param {String} userId - First entity ID (user)
 * @param {String} mentorId - Second entity ID (mentor)
 * @param {Date} dateStart - Start date for range filter (optional)
 * @param {Date} dateEnd - End date for range filter (optional)
 * @returns {Array} Overlapping slots with both user and mentor availability
 */
export async function findOverlappingSlots(userId, mentorId, dateStart = null, dateEnd = null) {
  try {
    // Build date filter
    const dateFilter = {};
    if (dateStart) {
      const start = new Date(dateStart);
      start.setUTCHours(0, 0, 0, 0);
      dateFilter.gte = start;
    }
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // Fetch user's availability slots
    const userSlots = await prisma.availability.findMany({
      where: {
        entityId: userId,
        entityType: "user",
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        entityId: true,
        entityType: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    if (userSlots.length === 0) {
      return [];
    }

    // Fetch mentor's availability slots for same dates
    const userDates = [...new Set(userSlots.map((s) => s.date.toISOString().split("T")[0]))];
    const mentorSlots = await prisma.availability.findMany({
      where: {
        entityId: mentorId,
        entityType: "mentor",
        date: {
          in: userDates.map((d) => new Date(d)),
        },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        entityId: true,
        entityType: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    if (mentorSlots.length === 0) {
      return [];
    }

    // Find overlaps: start_time < other.end_time AND end_time > other.start_time
    const overlaps = [];
    for (const userSlot of userSlots) {
      for (const mentorSlot of mentorSlots) {
        // Check if same date
        const userDateStr = userSlot.date.toISOString().split("T")[0];
        const mentorDateStr = mentorSlot.date.toISOString().split("T")[0];

        if (userDateStr !== mentorDateStr) {
          continue; // Different dates, no overlap
        }

        // Check time overlap: start_time < other.end_time AND end_time > other.start_time
        const userStart = new Date(userSlot.startTime);
        const userEnd = new Date(userSlot.endTime);
        const mentorStart = new Date(mentorSlot.startTime);
        const mentorEnd = new Date(mentorSlot.endTime);

        const hasOverlap =
          userStart < mentorEnd && userEnd > mentorStart;

        if (hasOverlap) {
          // Calculate overlap period
          const overlapStart = userStart > mentorStart ? userStart : mentorStart;
          const overlapEnd = userEnd < mentorEnd ? userEnd : mentorEnd;

          overlaps.push({
            date: userDateStr,
            userSlot: {
              id: userSlot.id,
              startTime: userSlot.startTime.toISOString(),
              endTime: userSlot.endTime.toISOString(),
            },
            mentorSlot: {
              id: mentorSlot.id,
              startTime: mentorSlot.startTime.toISOString(),
              endTime: mentorSlot.endTime.toISOString(),
            },
            overlapPeriod: {
              startTime: overlapStart.toISOString(),
              endTime: overlapEnd.toISOString(),
              durationMinutes: Math.round(
                (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60)
              ),
            },
          });
        }
      }
    }

    return overlaps;
  } catch (error) {
    console.error("Error finding overlapping slots:", error);
    throw error;
  }
}

export async function saveBatch(req, res, next) {
  try {
    const { slots, entityId: overrideEntityId, entityType: overrideEntityType } = req.body;
    const callerId = req.userId;
    const role = req.userRole;
    
    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: "slots array required" });
    }

    // Determine entity context
    let contextEntityId = null;
    let contextEntityType = null;
    let contextRole = null;

    if (overrideEntityId && overrideEntityType) {
      // Admin can specify entity for another person
      if (role !== "ADMIN") {
        return res.status(403).json({ error: "Only admins can set availability for other entities" });
      }
      contextEntityId = String(overrideEntityId).trim();
      contextEntityType = String(overrideEntityType).trim().toLowerCase();
      contextRole = contextEntityType === "mentor" ? "MENTOR" : "USER";
    } else if (!overrideEntityId && !overrideEntityType) {
      // Non-admin always operates on their own entity
      contextEntityId = callerId;
      if (role === "MENTOR") {
        contextEntityType = "mentor";
        contextRole = "MENTOR";
      } else {
        contextEntityType = "user";
        contextRole = "USER";
      }
    } else {
      return res.status(400).json({ error: "Must provide both entityId and entityType for override, or neither" });
    }

    const toCreate = [];
    const toDelete = [];

    for (const slot of slots) {
      const { date, startTime, endTime, enabled } = slot;

      const dateObj = typeof date === "string" ? parseDateUTC(date) : new Date(date);
      const dateStr = dateObj.toISOString().slice(0, 10);
      if (isPastDateOnly(dateStr)) {
        return res.status(400).json({ error: "Cannot set availability in the past" });
      }

      const start = new Date(startTime);
      const end = new Date(endTime);
      const { start: normStart, end: normEnd } = normalizeSlot(start, end);
      if (isPastTime(normStart)) {
        return res.status(400).json({ error: "Cannot set availability for past time" });
      }

      if (enabled) {
        toCreate.push({
          entityId: contextEntityId,
          entityType: contextEntityType,
          role: contextRole,
          date: dateObj,
          startTime: normStart,
          endTime: normEnd,
        });
      } else {
        toDelete.push({
          entityId: contextEntityId,
          entityType: contextEntityType,
          date: dateObj,
          startTime: normStart,
        });
      }
    }

    for (const d of toDelete) {
      await prisma.availability.deleteMany({
        where: {
          entityId: d.entityId,
          entityType: d.entityType,
          date: d.date,
          startTime: d.startTime,
        },
      });
    }

    for (const c of toCreate) {
      await prisma.availability.upsert({
        where: {
          availabilities_entity_id_type_date_start_time_key: {
            entityId: c.entityId,
            entityType: c.entityType,
            date: c.date,
            startTime: c.startTime,
          },
        },
        create: {
          id: uuidv4(),
          entityId: c.entityId,
          entityType: c.entityType,
          role: c.role,
          date: c.date,
          startTime: c.startTime,
          endTime: c.endTime,
        },
        update: { endTime: c.endTime },
      });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

/**
 * API Handler: Find overlapping availability slots between user and mentor
 * 
 * Query Parameters:
 * - userId: User ID (required)
 * - mentorId: Mentor ID (required)
 * - dateStart: Start date in YYYY-MM-DD format (optional)
 * - dateEnd: End date in YYYY-MM-DD format (optional)
 * 
 * Returns: Array of overlapping slots with structured data
 */
export async function findOverlaps(req, res, next) {
  try {
    const { userId, mentorId, dateStart, dateEnd } = req.query;

    // Validate required parameters
    if (!userId || !mentorId) {
      return res.status(400).json({
        error: "userId and mentorId are required",
      });
    }

    // Validate date format if provided
    let parsedDateStart = null;
    let parsedDateEnd = null;

    if (dateStart) {
      const dateObj = new Date(dateStart);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          error: "dateStart must be valid ISO date (YYYY-MM-DD)",
        });
      }
      parsedDateStart = dateObj;
    }

    if (dateEnd) {
      const dateObj = new Date(dateEnd);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          error: "dateEnd must be valid ISO date (YYYY-MM-DD)",
        });
      }
      parsedDateEnd = dateObj;
    }

    // Find overlaps
    const overlaps = await findOverlappingSlots(
      String(userId).trim(),
      String(mentorId).trim(),
      parsedDateStart,
      parsedDateEnd
    );

    // Structure response
    res.json({
      userId: String(userId).trim(),
      mentorId: String(mentorId).trim(),
      dateRange: {
        startDate: dateStart || null,
        endDate: dateEnd || null,
      },
      totalOverlaps: overlaps.length,
      overlaps: overlaps,
    });
  } catch (error) {
    next(error);
  }
}
