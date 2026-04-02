import bcrypt from "bcryptjs";
import { DateTime } from "luxon";
import { prisma } from "../lib/prisma.js";
import { v4 as uuidv4 } from "uuid";
import { isPastTime } from "../utils/time.js";

export async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { role: "USER" },
      select: { id: true, name: true, email: true, timezone: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  } catch (e) {
    next(e);
  }
}

export async function listMentors(req, res, next) {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      select: { id: true, name: true, email: true, timezone: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(mentors);
  } catch (e) {
    next(e);
  }
}

export async function createUser(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!role || !["USER", "MENTOR"].includes(role)) {
      return res.status(400).json({ error: "Role must be USER or MENTOR" });
    }
    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const displayName = name?.trim() || email.trim().split("@")[0] || "User";
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: displayName,
        email: email.trim().toLowerCase(),
        password: hashed,
        role,
        timezone: "UTC",
      },
      select: { id: true, name: true, email: true, role: true, timezone: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
}

export async function getAvailabilityForUser(req, res, next) {
  try {
    const { userId } = req.params;
    const { weekStart } = req.query;
    const weekStartDate = weekStart ? new Date(weekStart) : getWeekStart(new Date());
    weekStartDate.setUTCHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate);
      d.setUTCDate(weekStartDate.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const slots = await prisma.availability.findMany({
      where: {
        OR: [
          { userId, role: "USER" },
          { mentorId: userId, role: "MENTOR" },
        ],
        date: { gte: weekStartDate, lt: new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const byDate = {};
    dates.forEach((d) => (byDate[d] = []));
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
      weekStart: weekStartDate.toISOString().slice(0, 10),
      dates,
      availability: byDate,
    });
  } catch (e) {
    next(e);
  }
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export async function getOverlappingSlots(req, res, next) {
  try {
    const { userId } = req.params;
    const { startTime, endTime } = req.query;
    if (!startTime || !endTime) {
      return res.status(400).json({ error: "startTime and endTime required" });
    }
    const start = new Date(startTime);
    const end = new Date(endTime);

    const slots = await prisma.availability.findMany({
      where: {
        OR: [
          { userId, role: "USER" },
          { mentorId: userId, role: "MENTOR" },
        ],
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const overlapping = slots.filter((s) =>
      rangesOverlap(start, end, s.startTime, s.endTime)
    );

    res.json(overlapping);
  } catch (e) {
    next(e);
  }
}

export async function scheduleMeeting(req, res, next) {
  try {
    const adminId = req.userId;
    const { title, startTime, endTime, date, timezone, participantEmails } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: "title is required" });
    }

    let start;
    let end;
    // IANA timezone (e.g. "Asia/Kolkata" or "UTC"). DB always stores UTC.
    let requestTimezone = "UTC";

    if (date && timezone && typeof startTime === "string" && typeof endTime === "string" && /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime)) {
      const startDt = DateTime.fromFormat(`${date} ${startTime}`, "dd-MM-yyyy HH:mm", { zone: timezone });
      const endDt = DateTime.fromFormat(`${date} ${endTime}`, "dd-MM-yyyy HH:mm", { zone: timezone });
      if (!startDt.isValid || !endDt.isValid) {
        return res.status(400).json({ error: "Invalid date or time. Use dd-MM-yyyy and HH:mm in the selected timezone." });
      }
      start = startDt.toJSDate();
      end = endDt.toJSDate();
      requestTimezone = timezone;
    } else if (startTime && endTime) {
      start = new Date(startTime);
      end = new Date(endTime);
    } else {
      return res.status(400).json({ error: "startTime and endTime are required (or date, startTime, endTime, timezone)." });
    }

    if (start >= end) {
      return res.status(400).json({ error: "endTime must be after startTime" });
    }
    if (isPastTime(start)) {
      return res.status(400).json({ error: "Cannot schedule meeting in the past" });
    }

    const emails = Array.isArray(participantEmails)
      ? participantEmails.map((e) => (typeof e === "string" ? e.trim() : "")).filter(Boolean)
      : [];

    // Create call in DB
    const call = await prisma.call.create({
      data: {
        id: uuidv4(),
        adminId,
        title: title.trim(),
        startTime: start,
        endTime: end,
      },
    });

    if (emails.length > 0) {
      await prisma.callParticipant.createMany({
        data: emails.map((email) => ({
          id: uuidv4(),
          callId: call.id,
          email,
        })),
        skipDuplicates: true,
      });
    }

    const withParticipants = await prisma.call.findUnique({
      where: { id: call.id },
      include: { participants: true },
    });

    res.status(201).json(withParticipants);
  } catch (e) {
    next(e);
  }
}

// Alias for new API endpoint
export const bookCall = scheduleMeeting;
