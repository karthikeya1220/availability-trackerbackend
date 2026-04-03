/**
 * Seed script to create test credentials
 * Run: node src/scripts/seedTestUsers.js
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

const TEST_USERS = [
  {
    name: "Admin User",
    email: "admin@test.com",
    password: "admin123456",
    role: "ADMIN",
    timezone: "UTC",
  },
  {
    name: "Sarah Mentor",
    email: "mentor@test.com",
    password: "mentor123456",
    role: "MENTOR",
    timezone: "UTC",
  },
  {
    name: "John User",
    email: "user@test.com",
    password: "user123456",
    role: "USER",
    timezone: "UTC",
  },
];

async function main() {
  console.log("🌱 Seeding test users...\n");

  for (const testUser of TEST_USERS) {
    try {
      // Check if user already exists
      const existing = await prisma.user.findUnique({
        where: { email: testUser.email.toLowerCase() },
      });

      if (existing) {
        console.log(`⏭️  User already exists: ${testUser.email}`);
        continue;
      }

      // Hash password
      const hash = await bcrypt.hash(testUser.password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          id: uuidv4(),
          name: testUser.name,
          email: testUser.email.toLowerCase(),
          password: hash,
          role: testUser.role,
          timezone: testUser.timezone,
        },
      });

      console.log(`✅ Created ${testUser.role}: ${testUser.email}`);

      // Create profile for MENTOR
      if (testUser.role === "MENTOR") {
        await prisma.mentorProfile.create({
          data: {
            mentorId: user.id,
            expertise: ["JavaScript", "React", "Node.js", "System Design"],
            description: "Experienced software engineer with 10+ years experience",
            company: "Tech Company",
            communicationScore: 4.5,
            rating: 4.8,
            yearsOfExperience: 10,
          },
        });
        console.log(`   └─ Created mentor profile`);
      }

      // Create profile for USER
      if (testUser.role === "USER") {
        await prisma.userProfile.create({
          data: {
            userId: user.id,
            interests: ["Web Development", "Backend", "Career Growth"],
            goal: "Become a senior engineer",
            domain: "Software Engineering",
            description: "Aspiring developer looking to grow",
          },
        });
        console.log(`   └─ Created user profile`);
      }
    } catch (error) {
      console.error(`❌ Error creating ${testUser.email}:`, error.message);
    }
  }

  console.log("\n✅ Seeding complete!\n");
  console.log("📝 Test Credentials:");
  console.log("─".repeat(50));
  for (const user of TEST_USERS) {
    console.log(`\n${user.role}:`);
    console.log(`  Email:    ${user.email}`);
    console.log(`  Password: ${user.password}`);
  }
  console.log("\n" + "─".repeat(50));
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
