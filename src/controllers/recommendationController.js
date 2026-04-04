/**
 * Mentor Recommendation Controller
 * 
 * Handles API endpoints for mentor recommendations
 */

import { prisma } from "../lib/prisma.js";
import {
  recommendMentors,
  getRecommendationReport as generateRecommendationReport,
} from "../services/mentorRecommendation.js";

/**
 * Get mentor recommendations for a user
 * 
 * Query params:
 * - userId: User to get recommendations for (or uses authenticated user)
 * - limit: Max number of recommendations (default: 5)
 * - callType: Type of call (resume_revamp, job_market_guidance, mock_interview)
 */
export async function getRecommendations(req, res, next) {
  try {
    const { userId, limit = 5, callType } = req.query;
    const limitNum = Math.min(parseInt(limit) || 5, 20);
    const callerId = req.userId;

    // Determine which user to get recommendations for
    let targetUserId = userId || callerId;

    // Authorization: users can only get recommendations for themselves
    // Admins can get recommendations for any user
    if (req.userRole !== "ADMIN" && targetUserId !== callerId) {
      return res
        .status(403)
        .json({ error: "Cannot get recommendations for other users" });
    }

    // Fetch user profile
    const userRecord = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { userProfile: true },
    });

    if (!userRecord) {
      return res.status(404).json({ error: "User not found" });
    }

    // User must have a profile for recommendations
    if (!userRecord.userProfile) {
      return res.status(400).json({
        error: "User profile not set up. Please complete your profile first.",
      });
    }

    // Fetch all mentors with their profiles
    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      include: { mentorProfile: true },
    });

    if (mentors.length === 0) {
      return res.status(200).json({
        recommendations: [],
        message: "No mentors available",
      });
    }

    // Build mentor objects for scoring (excluding null profiles)
    const mentorProfiles = mentors
      .filter((m) => m.mentorProfile)
      .map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        ...m.mentorProfile,
      }));

    // Get recommendations
    const recommendations = recommendMentors(
      userRecord.userProfile,
      mentorProfiles,
      callType,
      limitNum
    );

    res.json({
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
      requestedCallType: callType || "general",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get detailed recommendation report (for debugging/transparency)
 */
export async function getRecommendationReport(req, res, next) {
  try {
    const { userId, callType } = req.query;
    const callerId = req.userId;

    // Determine which user to get report for
    let targetUserId = userId || callerId;

    // Authorization
    if (req.userRole !== "ADMIN" && targetUserId !== callerId) {
      return res
        .status(403)
        .json({ error: "Cannot get report for other users" });
    }

    // Fetch user profile
    const userRecord = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { userProfile: true },
    });

    if (!userRecord) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!userRecord.userProfile) {
      return res.status(400).json({
        error: "User profile not set up",
      });
    }

    // Fetch all mentors
    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      include: { mentorProfile: true },
    });

    const mentorProfiles = mentors
      .filter((m) => m.mentorProfile)
      .map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        ...m.mentorProfile,
      }));

    // Get full report
    const report = generateRecommendationReport(
      userRecord.userProfile,
      mentorProfiles,
      callType
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update mentor profile (for mentors to complete their profile)
 */
export async function updateMentorProfile(req, res, next) {
  try {
    const mentorId = req.userId;
    const { expertise, description, company, companySize, communicationScore, rating, yearsOfExperience } = req.body;

    // Only mentors can update their profile
    if (req.userRole !== "MENTOR") {
      return res
        .status(403)
        .json({ error: "Only mentors can update mentor profiles" });
    }

    // Find or create profile
    let profile = await prisma.mentorProfile.findUnique({
      where: { mentorId },
    });

    if (!profile) {
      profile = await prisma.mentorProfile.create({
        data: {
          mentorId,
          expertise: expertise || [],
          description: description || "",
          company: company || "",
          companySize: companySize || "",
          communicationScore: communicationScore || 3.0,
          rating: rating || 4.0,
          yearsOfExperience: yearsOfExperience || 0,
        },
      });
    } else {
      profile = await prisma.mentorProfile.update({
        where: { mentorId },
        data: {
          ...(expertise && { expertise }),
          ...(description && { description }),
          ...(company && { company }),
          ...(companySize && { companySize }),
          ...(communicationScore && { communicationScore }),
          ...(rating && { rating }),
          ...(yearsOfExperience !== undefined && { yearsOfExperience }),
        },
      });
    }

    res.json({
      message: "Mentor profile updated",
      profile,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update user profile (for users to set their interests and goals)
 */
export async function updateUserProfile(req, res, next) {
  try {
    const userId = req.userId;
    const { interests, goal, domain, description } = req.body;

    // Find or create profile
    let profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId,
          interests: interests || [],
          goal: goal || "",
          domain: domain || "",
          description: description || "",
        },
      });
    } else {
      profile = await prisma.userProfile.update({
        where: { userId },
        data: {
          ...(interests && { interests }),
          ...(goal && { goal }),
          ...(domain && { domain }),
          ...(description && { description }),
        },
      });
    }

    res.json({
      message: "User profile updated",
      profile,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get user's own profile
 */
export async function getUserProfile(req, res, next) {
  try {
    const userId = req.userId;

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.json({
        profile: null,
        message: "User profile not set up yet",
      });
    }

    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

/**
 * Get mentor profile
 */
export async function getMentorProfile(req, res, next) {
  try {
    const mentorId = req.userId;

    const profile = await prisma.mentorProfile.findUnique({
      where: { mentorId },
    });

    if (!profile) {
      return res.json({
        profile: null,
        message: "Mentor profile not set up yet",
      });
    }

    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin-only endpoint: Get mentor recommendations for a specific user
 * 
 * Query params:
 * - user_id (required): User to get recommendations for
 * - call_type (optional): Type of call (resume_revamp, job_market_guidance, mock_interview)
 * - limit (optional): Max number of recommendations (default: 5, max: 20)
 * 
 * Authorization: Admin only
 */
export async function getRecommendationsAdmin(req, res, next) {
  try {
    // Admin authorization check
    if (req.userRole !== "ADMIN") {
      return res.status(403).json({
        error: "Only admins can access this endpoint",
      });
    }

    // Input validation
    const { user_id, call_type, limit } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: "user_id query parameter is required",
      });
    }

    // Validate limit parameter
    const limitNum = Math.min(Math.max(parseInt(limit) || 5, 1), 20);

    // Validate call_type if provided
    const validCallTypes = ["resume_revamp", "job_market_guidance", "mock_interview", "general"];
    const callType = call_type && validCallTypes.includes(call_type) ? call_type : null;

    // Fetch user profile
    const userRecord = await prisma.user.findUnique({
      where: { id: user_id },
      include: { userProfile: true },
    });

    if (!userRecord) {
      return res.status(404).json({
        error: `User with ID "${user_id}" not found`,
      });
    }

    // Check if user has a profile
    if (!userRecord.userProfile) {
      return res.status(400).json({
        error: `User "${userRecord.name}" does not have a profile set up`,
        userId: user_id,
        userName: userRecord.name,
      });
    }

    // Fetch all active mentors with their profiles
    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      include: { mentorProfile: true },
    });

    if (mentors.length === 0) {
      return res.status(200).json({
        userId: user_id,
        userName: userRecord.name,
        recommendations: [],
        callType: callType || "general",
        message: "No mentors available",
      });
    }

    // Build mentor objects for scoring (filter out mentors without profiles)
    const mentorProfiles = mentors
      .filter((m) => m.mentorProfile)
      .map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        ...m.mentorProfile,
      }));

    if (mentorProfiles.length === 0) {
      return res.status(200).json({
        userId: user_id,
        userName: userRecord.name,
        recommendations: [],
        callType: callType || "general",
        message: "No mentors with complete profiles available",
      });
    }

    // Run recommendation engine
    const recommendations = recommendMentors(
      userRecord.userProfile,
      mentorProfiles,
      callType,
      limitNum
    );

    res.json({
      userId: user_id,
      userName: userRecord.name,
      userProfile: {
        interests: userRecord.userProfile.interests,
        goal: userRecord.userProfile.goal,
        domain: userRecord.userProfile.domain,
      },
      callType: callType || "general",
      requestedLimit: limitNum,
      returnedCount: recommendations.length,
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
    });
  } catch (err) {
    next(err);
  }
}
