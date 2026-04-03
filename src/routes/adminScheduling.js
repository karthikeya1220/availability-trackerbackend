/**
 * Admin Scheduling Routes
 * 
 * Complete workflow for admin booking calls:
 * 1. GET /api/admin/schedule/recommendations - Get mentor recommendations
 * 2. POST /api/admin/schedule/overlaps - Find overlapping availability
 * 3. POST /api/admin/schedule/book - Book a call
 */

import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getSchedulingRecommendations,
  getSchedulingOverlaps,
  bookScheduledCall,
} from "../controllers/adminSchedulingController.js";

const router = express.Router();

// All admin scheduling routes require authentication
router.use(authenticate);

/**
 * Step 1: Get mentor recommendations for a user
 * GET /api/admin/schedule/recommendations?user_id=xxx&call_type=resume_revamp&limit=5
 */
router.get("/recommendations", getSchedulingRecommendations);

/**
 * Step 2: Find overlapping availability between user and mentor
 * POST /api/admin/schedule/overlaps
 * Body: { user_id, mentor_id, date_start?, date_end? }
 */
router.post("/overlaps", getSchedulingOverlaps);

/**
 * Step 3: Book a call on selected slot
 * POST /api/admin/schedule/book
 * Body: { user_id, mentor_id, user_slot_id, mentor_slot_id, title?, start_time, end_time }
 */
router.post("/book", bookScheduledCall);

export default router;
