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
