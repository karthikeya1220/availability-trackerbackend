/**
 * Test Mentor Recommendation Engine
 * 
 * Quick test script to verify scoring logic
 */

import { recommendMentors, getRecommendationReport, scoreMentor } from "./src/services/mentorRecommendation.js";

// Sample user profile
const user = {
  interests: ["React", "Node.js", "Web Development"],
  goal: "Transition to tech from finance",
  domain: "Web Development",
  description: "Finance professional looking to build full-stack skills",
};

// Sample mentors
const mentors = [
  {
    id: "1",
    name: "Dr. Sarah Chen",
    email: "sarah@google.com",
    expertise: ["React", "Node.js", "System Design"],
    description: "Senior Software Engineer at Google with 12+ years building scalable web systems",
    company: "Google",
    companySize: "50000+",
    communicationScore: 4.2,
    rating: 4.8,
    yearsOfExperience: 12,
  },
  {
    id: "2",
    name: "James Wilson",
    email: "james@techflow.com",
    expertise: ["Product Management", "Growth Hacking", "Analytics"],
    description: "Product leader at TechFlow AI, experienced in B2B SaaS",
    company: "TechFlow AI",
    companySize: "100-500",
    communicationScore: 4.0,
    rating: 4.6,
    yearsOfExperience: 8,
  },
  {
    id: "3",
    name: "Priya Sharma",
    email: "priya@jpmorgan.com",
    expertise: ["Data Science", "Python", "Machine Learning"],
    description: "Data Scientist at JPMorgan Chase with finance background",
    company: "JPMorgan Chase",
    companySize: "50000+",
    communicationScore: 3.5,
    rating: 4.9,
    yearsOfExperience: 10,
  },
];

console.log("═══════════════════════════════════════════════════════════════════");
console.log("MENTOR RECOMMENDATION ENGINE TEST");
console.log("═══════════════════════════════════════════════════════════════════\n");

console.log("👤 USER PROFILE:");
console.log(JSON.stringify(user, null, 2));
console.log("\n");

// Test 1: Individual scoring
console.log("📊 INDIVIDUAL MENTOR SCORES:");
console.log("───────────────────────────────────────────────────────────────────");

mentors.forEach((mentor) => {
  const score = scoreMentor(user, mentor, null);
  console.log(`\n${mentor.name} (${mentor.company})`);
  console.log(`Expertise: ${mentor.expertise.join(", ")}`);
  console.log(`Score: ${score.score.toFixed(2)}`);
  console.log(`Match %: ${score.matchPercentage.toFixed(0)}%`);
  console.log(`Breakdown:`, score.breakdown);
  console.log(`Reasoning:`);
  score.reasoning.forEach((r) => console.log(`  • ${r}`));
});

// Test 2: General recommendations
console.log("\n\n🎯 GENERAL RECOMMENDATIONS (top 5):");
console.log("───────────────────────────────────────────────────────────────────");
const generalRecs = recommendMentors(user, mentors, null, 5);
generalRecs.forEach((rec, idx) => {
  console.log(`\n${idx + 1}. ${rec.name} - ${rec.score.toFixed(2)} points (${rec.matchPercentage.toFixed(0)}%)`);
  console.log(`   Company: ${rec.company} | Rating: ${rec.rating} ⭐`);
});

// Test 3: Resume revamp recommendations
console.log("\n\n📄 RESUME REVAMP RECOMMENDATIONS:");
console.log("───────────────────────────────────────────────────────────────────");
const resumeRecs = recommendMentors(user, mentors, "resume_revamp", 5);
resumeRecs.forEach((rec, idx) => {
  console.log(`\n${idx + 1}. ${rec.name} - ${rec.score.toFixed(2)} points (${rec.matchPercentage.toFixed(0)}%)`);
  console.log(`   Company: ${rec.company}`);
  if (rec.reasoning) {
    rec.reasoning.forEach((r) => console.log(`   • ${r}`));
  }
});

// Test 4: Detailed report
console.log("\n\n📋 DETAILED REPORT:");
console.log("───────────────────────────────────────────────────────────────────");
const report = getRecommendationReport(user, mentors, "resume_revamp");
console.log(JSON.stringify(report, null, 2));

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("✅ TEST COMPLETE");
console.log("═══════════════════════════════════════════════════════════════════\n");
