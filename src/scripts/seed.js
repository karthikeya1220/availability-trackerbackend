/**
 * Full seed script — creates:
 *   1 Admin
 *   5 Mentors (with full metadata for recommendation engine)
 *   10 Users (with tags and descriptions)
 *   Availability slots for all mentors and users (next 2 weeks)
 *
 * Run: node src/scripts/seed.js
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function hash(pw) {
  return bcrypt.hash(pw, 12);
}

/** Returns UTC midnight Date for a date string YYYY-MM-DD */
function utcDate(str) {
  return new Date(str + "T00:00:00.000Z");
}

/** Returns next Monday from today */
function nextMonday() {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Build N consecutive hourly slot pairs starting at UTC hour H on dateStr */
function buildSlots(dateStr, hours) {
  return hours.map((h) => {
    const start = new Date(`${dateStr}T${String(h).padStart(2, "0")}:00:00.000Z`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  });
}

/** Get YYYY-MM-DD string for a date offset by N days from base */
function dateStr(base, offsetDays) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// ─── Data ────────────────────────────────────────────────────────────────────

const ADMIN = {
  name: process.env.ADMIN_NAME || "Admin User",
  email: (process.env.ADMIN_EMAIL || "admin@mentorque.com").toLowerCase(),
  password: process.env.ADMIN_PASSWORD || "admin123456",
};

const MENTORS = [
  {
    name: "Arjun Sharma",
    email: "arjun.sharma@mentorque.com",
    password: "mentor123",
    timezone: "Asia/Kolkata",
    tags: ["tech", "big_tech", "backend", "india", "senior_developer"],
    domain: "backend",
    description:
      "Senior Software Engineer at Google with 8 years of experience in distributed systems, Java, and Go. Strong track record helping candidates crack FAANG interviews.",
    companyType: "big_tech",
    communicationScore: 4.5,
    // Availability: Mon–Fri 9–12 UTC (next 2 weeks)
    availHours: [9, 10, 11],
    availDays: [0, 1, 2, 3, 4, 7, 8, 9, 10, 11], // offset from base Monday
  },
  {
    name: "Priya Nair",
    email: "priya.nair@mentorque.com",
    password: "mentor123",
    timezone: "Asia/Kolkata",
    tags: ["tech", "big_tech", "frontend", "india", "good_communication"],
    domain: "frontend",
    description:
      "Staff Engineer at Meta specialising in React, TypeScript, and design systems. Known for her exceptional communication and coaching style.",
    companyType: "big_tech",
    communicationScore: 4.8,
    availHours: [10, 11, 14],
    availDays: [0, 1, 2, 3, 4, 7, 8, 9, 10, 11],
  },
  {
    name: "Rahul Verma",
    email: "rahul.verma@mentorque.com",
    password: "mentor123",
    timezone: "Asia/Kolkata",
    tags: ["tech", "startup", "fullstack", "india", "good_communication"],
    domain: "fullstack",
    description:
      "CTO of an early-stage SaaS startup. Deep expertise in product strategy, startup recruitment, and job market trends in India. Great communicator — students consistently rate him 4.9/5.",
    companyType: "startup",
    communicationScore: 4.9,
    availHours: [8, 9, 15],
    availDays: [0, 2, 4, 7, 9, 11],
  },
  {
    name: "Sneha Iyer",
    email: "sneha.iyer@mentorque.com",
    password: "mentor123",
    timezone: "Europe/Dublin",
    tags: ["tech", "big_tech", "ml", "ireland", "senior_developer"],
    domain: "ml",
    description:
      "Machine Learning Engineer at Amazon Dublin. Specialises in NLP and recommendation systems. Has helped 30+ candidates prepare for ML roles at top companies.",
    companyType: "big_tech",
    communicationScore: 4.2,
    availHours: [9, 13, 14],
    availDays: [1, 3, 5, 8, 10],
  },
  {
    name: "Kiran Reddy",
    email: "kiran.reddy@mentorque.com",
    password: "mentor123",
    timezone: "Asia/Kolkata",
    tags: ["tech", "mid_size", "devops", "india", "good_communication"],
    domain: "devops",
    description:
      "DevOps Lead at Infosys Digital with expertise in Kubernetes, CI/CD pipelines, and cloud infrastructure. Excellent communicator with strong interview coaching skills.",
    companyType: "mid_size",
    communicationScore: 4.6,
    availHours: [10, 11, 16],
    availDays: [0, 1, 2, 3, 4, 7, 8, 9, 10, 11],
  },
];

const USERS = [
  {
    name: "Aditya Kumar",
    email: "aditya.kumar@example.com",
    password: "user123456",
    timezone: "Asia/Kolkata",
    tags: ["tech", "backend", "india"],
    domain: "backend",
    description:
      "3 years of experience in Python and Django. Looking to crack a backend role at a big tech company. Needs help with system design and resume revision.",
    availHours: [9, 10, 11, 14],
    availDays: [0, 1, 2, 3, 4, 7, 8, 9, 10, 11],
  },
  {
    name: "Meera Pillai",
    email: "meera.pillai@example.com",
    password: "user123456",
    timezone: "Asia/Kolkata",
    tags: ["tech", "frontend", "india", "asks_a_lot_of_questions"],
    domain: "frontend",
    description:
      "Junior frontend developer with React experience. Wants mock interviews for frontend roles at product companies. Very inquisitive.",
    availHours: [10, 11, 15],
    availDays: [0, 2, 4, 7, 9, 11],
  },
  {
    name: "Suresh Babu",
    email: "suresh.babu@example.com",
    password: "user123456",
    timezone: "Asia/Kolkata",
    tags: ["tech", "ml", "india"],
    domain: "ml",
    description:
      "Final year PhD student in deep learning. Looking for guidance on transitioning to industry ML roles. Particularly interested in NLP positions.",
    availHours: [8, 9, 13],
    availDays: [1, 3, 5, 8, 10],
  },
  {
    name: "Divya Menon",
    email: "divya.menon@example.com",
    password: "user123456",
    timezone: "Asia/Kolkata",
    tags: ["tech", "fullstack", "india", "good_communication"],
    domain: "fullstack",
    description:
      "2 years of startup experience. Looking for job market guidance on switching to larger companies. Good communicator.",
    availHours: [10, 14, 15],
    availDays: [0, 1, 2, 7, 8, 9],
  },
  {
    name: "Rohan Gupta",
    email: "rohan.gupta@example.com",
    password: "user123456",
    timezone: "Asia/Kolkata",
    tags: ["tech", "devops", "india", "asks_a_lot_of_questions"],
    domain: "devops",
    description:
      "SRE with 1 year experience. Wants mock interviews for senior DevOps roles. Has many questions about cloud architecture.",
    availHours: [9, 10, 16],
    availDays: [0, 1, 3, 7, 8, 10],
  },
  {
    name: "Ananya Singh",
    email: "ananya.singh@example.com",
    password: "user123456",
    timezone: "Asia/Kolkata",
    tags: ["tech", "backend", "india"],
    domain: "backend",
    description:
      "Recently laid off senior developer. Needs resume revamp and job market guidance. 6 years of Java backend experience.",
    availHours: [9, 11, 14],
    availDays: [0, 2, 4, 7, 9, 11],
  },
  {
    name: "Vikram Patel",
    email: "vikram.patel@example.com",
    password: "user123456",
    timezone: "Asia/Kolkata",
    tags: ["tech", "frontend", "india"],
    domain: "frontend",
    description:
      "3 years of Angular and Vue experience. Wants guidance on switching to React ecosystem and landing a job at a big tech company.",
    availHours: [10, 11, 13],
    availDays: [1, 2, 3, 8, 9, 10],
  },
  {
    name: "Nisha Kapoor",
    email: "nisha.kapoor@example.com",
    password: "user123456",
    timezone: "Asia/Kolkata",
    tags: ["tech", "ml", "india", "good_communication"],
    domain: "ml",
    description:
      "Data scientist with 4 years in banking sector. Looking to move to a product company ML role. Needs mock interviews and resume revamp.",
    availHours: [8, 10, 14],
    availDays: [0, 1, 4, 7, 8, 11],
  },
  {
    name: "Aryan Joshi",
    email: "aryan.joshi@example.com",
    password: "user123456",
    timezone: "Asia/Kolkata",
    tags: ["tech", "fullstack", "ireland"],
    domain: "fullstack",
    description:
      "Moved to Ireland recently. Needs job market guidance specifically for the Irish/European tech market. 5 years of full-stack experience.",
    availHours: [9, 13, 14],
    availDays: [2, 3, 5, 9, 10],
  },
  {
    name: "Lakshmi Rao",
    email: "lakshmi.rao@example.com",
    password: "user123456",
    timezone: "Asia/Kolkata",
    tags: ["tech", "devops", "india"],
    domain: "devops",
    description:
      "Cloud engineer with AWS certifications. Wants a resume revamp and mock interview prep for DevOps architect roles.",
    availHours: [10, 11, 15],
    availDays: [0, 1, 2, 7, 8, 9],
  },
];

// ─── Seed Functions ───────────────────────────────────────────────────────────

async function upsertUser(data) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return prisma.user.update({ where: { email: data.email }, data });
  }
  return prisma.user.create({ data: { ...data, id: uuidv4() } });
}

async function seedAvailability(userId, role, availDays, availHours, baseMonday) {
  // Clear existing future availability for this user/role
  if (role === "MENTOR") {
    await prisma.availability.deleteMany({ where: { mentorId: userId, role: "MENTOR" } });
  } else {
    await prisma.availability.deleteMany({ where: { userId, role: "USER" } });
  }

  for (const dayOffset of availDays) {
    const ds = dateStr(baseMonday, dayOffset);
    const slots = buildSlots(ds, availHours);
    for (const slot of slots) {
      await prisma.availability.create({
        data: {
          id: uuidv4(),
          userId: role === "USER" ? userId : null,
          mentorId: role === "MENTOR" ? userId : null,
          role,
          date: utcDate(ds),
          startTime: slot.start,
          endTime: slot.end,
        },
      });
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const base = nextMonday();
  console.log(`\n🌱 Seeding database... (base week: ${base.toISOString().slice(0, 10)})\n`);

  // ── Admin ──
  const adminUser = await upsertUser({
    name: ADMIN.name,
    email: ADMIN.email,
    password: await hash(ADMIN.password),
    role: "ADMIN",
    timezone: "UTC",
    tags: [],
  });
  console.log(`✅ Admin: ${adminUser.email}`);

  // ── Mentors ──
  for (const m of MENTORS) {
    const { availHours, availDays, password, ...profile } = m;
    const mentor = await upsertUser({
      ...profile,
      email: profile.email.toLowerCase(),
      password: await hash(password),
      role: "MENTOR",
    });
    await seedAvailability(mentor.id, "MENTOR", availDays, availHours, base);
    console.log(`✅ Mentor: ${mentor.email} (${availDays.length} days × ${availHours.length} slots)`);
  }

  // ── Users ──
  for (const u of USERS) {
    const { availHours, availDays, password, ...profile } = u;
    const user = await upsertUser({
      ...profile,
      email: profile.email.toLowerCase(),
      password: await hash(password),
      role: "USER",
    });
    await seedAvailability(user.id, "USER", availDays, availHours, base);
    console.log(`✅ User: ${user.email} (${availDays.length} days × ${availHours.length} slots)`);
  }

  console.log("\n✨ Seed complete!\n");
  console.log("─── Login credentials ─────────────────────────");
  console.log(`Admin:   ${ADMIN.email} / ${ADMIN.password}`);
  console.log(`Mentors: *@mentorque.com / mentor123`);
  console.log(`Users:   *@example.com  / user123456`);
  console.log("───────────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
