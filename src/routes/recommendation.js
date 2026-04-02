/**
 * Recommendation Routes
 * 
 * Endpoints for mentor recommendations and profile management
 */

import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getRecommendations,
  getRecommendationReport,
  updateMentorProfile,
  updateUserProfile,
  getUserProfile,
  getMentorProfile,
} from "../controllers/recommendationController.js";

const router = express.Router();

// All recommendation routes require authentication
router.use(authenticateToken);

// Get recommendations for a user
// GET /recommendations?userId=xxx&limit=5&callType=resume_revamp
router.get("/", getRecommendations);

// Get detailed recommendation report
// GET /recommendations/report?userId=xxx&callType=resume_revamp
router.get("/report", getRecommendationReport);

// User profile management
// GET /recommendations/profile/user
router.get("/profile/user", getUserProfile);

// PUT /recommendations/profile/user
router.put("/profile/user", updateUserProfile);

// Mentor profile management
// GET /recommendations/profile/mentor
router.get("/profile/mentor", getMentorProfile);

// PUT /recommendations/profile/mentor
router.put("/profile/mentor", updateMentorProfile);

export default router;
