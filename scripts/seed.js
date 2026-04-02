#!/usr/bin/env node

/**
 * Database Seed Script
 * 
 * Populates the database with test data:
 * - 1 Admin user
 * - 5 Mentors with realistic profiles
 * - 10 Users with realistic profiles
 * - Availability slots for next 7 days
 * 
 * Usage:
 *   npm run seed
 *   node scripts/seed.js
 */

import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Mentor profiles with expertise and descriptions
 */
const MENTOR_PROFILES = [
  {
    name: "Dr. Sarah Chen",
    email: "sarah.chen@tech.com",
    expertise: ["React", "Node.js", "System Design"],
    description: "Senior Software Engineer with 12+ years of experience in full-stack development and architectural design.",
    company: "Google",
    company_size: "50000+",
    rating: 4.8,
  },
  {
    name: "James Wilson",
    email: "james.wilson@startup.com",
    expertise: ["Product Management", "Growth Hacking", "Analytics"],
    description: "Product Manager at fast-growing EdTech startup. Passionate about building products that scale.",
    company: "TechFlow AI",
    company_size: "100-500",
    rating: 4.6,
  },
  {
    name: "Priya Sharma",
    email: "priya.sharma@finance.com",
    expertise: ["Data Science", "Python", "Machine Learning"],
    description: "ML Engineer specializing in recommendation systems and data analytics. PhD in Computer Science.",
    company: "JPMorgan Chase",
    company_size: "50000+",
    rating: 4.9,
  },
  {
    name: "Marcus Johnson",
    email: "marcus.johnson@consulting.com",
    expertise: ["Business Strategy", "Entrepreneurship", "Leadership"],
    description: "Founder of 2 successful startups. Now advising next-gen entrepreneurs and helping them scale.",
    company: "Founder Institute",
    company_size: "200-1000",
    rating: 4.7,
  },
  {
    name: "Elena Rodriguez",
    email: "elena.rodriguez@design.com",
    expertise: ["UX Design", "Figma", "Design Systems"],
    description: "Lead Product Designer at a design-forward company. Expert in creating scalable design systems.",
    company: "Stripe",
    company_size: "10000+",
    rating: 4.85,
  },
];

/**
 * User profiles with interests and goals
 */
const USER_PROFILES = [
  {
    name: "Alex Kumar",
    email: "alex.kumar@student.com",
    interests: ["Web Development", "React", "JavaScript"],
    goal: "Transition to tech from finance",
  },
  {
    name: "Jordan Taylor",
    email: "jordan.taylor@college.edu",
    interests: ["Backend Development", "System Design", "DevOps"],
    goal: "Prepare for senior engineering interviews",
  },
  {
    name: "Casey O'Brien",
    email: "casey.obrien@bootcamp.io",
    interests: ["Full Stack", "Node.js", "MongoDB"],
    goal: "Secure first tech job",
  },
  {
    name: "Morgan Lee",
    email: "morgan.lee@startup.io",
    interests: ["Product Management", "Analytics", "SQL"],
    goal: "Transition from engineering to product",
  },
  {
    name: "Riley Chen",
    email: "riley.chen@works.com",
    interests: ["Machine Learning", "Python", "Data Science"],
    goal: "Build AI/ML skills for current role",
  },
  {
    name: "Dakota Smith",
    email: "dakota.smith@company.com",
    interests: ["Leadership", "Management", "Strategy"],
    goal: "Prepare for team lead role",
  },
  {
    name: "Sam Patel",
    email: "sam.patel@business.com",
    interests: ["Design", "UX", "Figma"],
    goal: "Transition from graphic to product design",
  },
  {
    name: "Avery Johnson",
    email: "avery.johnson@creative.com",
    interests: ["Startup Ideas", "Fundraising", "Entrepreneurship"],
    goal: "Launch first startup",
  },
  {
    name: "Quinn Martinez",
    email: "quinn.martinez@tech.io",
    interests: ["Data Engineering", "BigQuery", "Cloud Architecture"],
    goal: "Specialize in data infrastructure",
  },
  {
    name: "Taylor Brown",
    email: "taylor.brown@student.edu",
    interests: ["Web Design", "Frontend", "CSS"],
    goal: "Build portfolio projects",
  },
];

/**
 * Generate availability slots for a user/mentor
 * Creates 2-3 slots per day for the next 7 days
 */
function generateAvailabilitySlots(userId, role, entityType) {
  const slots = [];
  let now = new Date();
  now.setDate(now.getDate() + 1); // Start from tomorrow
  now.setHours(0, 0, 0, 0); // Reset to start of day

  // Time slots in 24-hour format
  const TIME_SLOTS = [
    { start: "09:00", end: "10:00" },
    { start: "10:00", end: "11:00" },
    { start: "14:00", end: "15:00" },
    { start: "15:00", end: "16:00" },
    { start: "16:00", end: "17:00" },
    { start: "18:00", end: "19:00" },
  ];

  // Generate slots for next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);

    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

    // Skip weekends for mentors, include weekends for users
    if (role === "MENTOR" && (dayOfWeek === 0 || dayOfWeek === 6)) {
      continue;
    }

    // Randomly select 2-3 time slots per day
    const shuffled = TIME_SLOTS.sort(() => Math.random() - 0.5);
    const slotsForDay = shuffled.slice(0, Math.random() > 0.5 ? 2 : 3);

    slotsForDay.forEach((slot) => {
      const [startHour, startMin] = slot.start.split(":").map(Number);
      const [endHour, endMin] = slot.end.split(":").map(Number);

      const startTime = new Date(date);
      startTime.setHours(startHour, startMin, 0, 0);

      const endTime = new Date(date);
      endTime.setHours(endHour, endMin, 0, 0);

    // Create a date object with just the date part (no time)
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);

      slots.push({
        entityId: userId,
        entityType,
        role,
        date: dateOnly,
        startTime,
        endTime,
      });
    });
  }

  return slots;
}

/**
 * Hash password using bcrypt
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Create admin user
 */
async function createAdmin() {
  console.log("\n👤 Creating admin user...");

  const hashedPassword = await hashPassword("Admin@12345");

  let admin = await prisma.user.findUnique({
    where: { email: "admin@mentorque.com" },
  });

  if (admin) {
    // Admin already exists, just update password
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashedPassword },
    });
  } else {
    admin = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: "Admin User",
        email: "admin@mentorque.com",
        password: hashedPassword,
        role: "ADMIN",
        timezone: "UTC",
      },
    });
  }

  console.log(`   ✅ Admin created/updated: ${admin.email}`);
  return admin;
}

/**
 * Create mentor users with availability
 */
async function createMentors() {
  console.log("\n🎓 Creating mentors...");

  const mentors = [];

  for (const profile of MENTOR_PROFILES) {
    const hashedPassword = await hashPassword("Mentor@12345");

    const mentor = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: profile.name,
        email: profile.email,
        password: hashedPassword,
        role: "MENTOR",
        timezone: "UTC",
      },
    });

    // Create mentor profile with expertise and metadata
    await prisma.mentorProfile.create({
      data: {
        mentorId: mentor.id,
        expertise: profile.expertise,
        description: profile.description,
        company: profile.company,
        companySize: profile.company_size,
        rating: profile.rating,
        communicationScore: 4.0, // Mentors have high communication by default
        yearsOfExperience: 8,
      },
    });

    // Generate availability slots for this mentor
    const availabilitySlots = generateAvailabilitySlots(
      mentor.id,
      "MENTOR",
      "mentor"
    );

    // Create availability slots one at a time to avoid validation issues
    for (const slot of availabilitySlots) {
      await prisma.availability.create({
        data: slot,
      });
    }

    console.log(
      `   ✅ ${profile.name} (${profile.company}) - ${profile.expertise.join(", ")}`
    );
    console.log(
      `      📅 ${availabilitySlots.length} availability slots created`
    );

    mentors.push({
      ...mentor,
      profile,
    });
  }

  return mentors;
}

/**
 * Create regular users with availability
 */
async function createUsers() {
  console.log("\n👥 Creating users...");

  const users = [];

  for (const profile of USER_PROFILES) {
    const hashedPassword = await hashPassword("User@12345");

    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: profile.name,
        email: profile.email,
        password: hashedPassword,
        role: "USER",
        timezone: "UTC",
      },
    });

    // Create user profile with interests and goals
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        interests: profile.interests,
        goal: profile.goal,
        domain: profile.interests[0] || "", // Use first interest as domain
        description: profile.goal,
      },
    });

    // Generate availability slots for this user
    const availabilitySlots = generateAvailabilitySlots(user.id, "USER", "user");

    // Create availability slots one at a time to avoid validation issues
    for (const slot of availabilitySlots) {
      await prisma.availability.create({
        data: slot,
      });
    }

    console.log(
      `   ✅ ${profile.name} (Goal: ${profile.goal})`
    );
    console.log(
      `      📚 Interests: ${profile.interests.join(", ")}`
    );
    console.log(
      `      📅 ${availabilitySlots.length} availability slots created`
    );

    users.push({
      ...user,
      profile,
    });
  }

  return users;
}

/**
 * Generate summary statistics
 */
async function printSummary() {
  console.log("\n" + "=".repeat(70));
  console.log("📊 SEED SUMMARY");
  console.log("=".repeat(70));

  const userCount = await prisma.user.count();
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  const mentorCount = await prisma.user.count({ where: { role: "MENTOR" } });
  const userCountRegular = await prisma.user.count({ where: { role: "USER" } });
  const availabilityCount = await prisma.availability.count();

  console.log(`\n👤 Users Created:`);
  console.log(`   • Total: ${userCount}`);
  console.log(`   • Admins: ${adminCount}`);
  console.log(`   • Mentors: ${mentorCount}`);
  console.log(`   • Regular Users: ${userCountRegular}`);

  console.log(`\n📅 Availability Slots Created:`);
  console.log(`   • Total: ${availabilityCount}`);

  const slotsByRole = await prisma.availability.groupBy({
    by: ["role"],
    _count: true,
  });

  slotsByRole.forEach((slot) => {
    console.log(`   • ${slot.role}s: ${slot._count}`);
  });

  console.log(`\n🎓 Mentors by Expertise:`);
  MENTOR_PROFILES.forEach((profile) => {
    console.log(`   • ${profile.name}: ${profile.expertise.join(", ")}`);
  });

  console.log(`\n🔐 Default Passwords:`);
  console.log(`   • Admin: Admin@12345`);
  console.log(`   • Mentors: Mentor@12345`);
  console.log(`   • Users: User@12345`);

  console.log(`\n📅 Availability: Next 7 days (2-3 slots per day)`);
  console.log(`   • Mentors: Weekdays only (Mon-Fri)`);
  console.log(`   • Users: All days (including weekends)`);

  console.log("\n" + "=".repeat(70));
  console.log("✅ Database seed completed successfully!");
  console.log("=".repeat(70) + "\n");
}

/**
 * Main seed function
 */
async function main() {
  console.log("\n🌱 Starting database seed...\n");

  try {
    // Clean up existing seed data to allow re-running
    console.log("🧹 Cleaning up existing seed data...");
    
    // Delete all mentors and users (except we'll recreate them)
    // Delete profiles first (foreign key constraint)
    await prisma.mentorProfile.deleteMany({});
    await prisma.userProfile.deleteMany({});
    
    // Delete availability slots
    await prisma.availability.deleteMany({});
    
    // Delete all non-admin users
    await prisma.user.deleteMany({
      where: { role: { in: ["MENTOR", "USER"] } },
    });

    console.log("   ✅ Cleanup complete\n");

    // Create admin
    await createAdmin();

    // Create mentors
    await createMentors();

    // Create users
    await createUsers();

    // Print summary
    await printSummary();
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
main();
