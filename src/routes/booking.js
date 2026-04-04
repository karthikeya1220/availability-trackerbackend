/**
 * Booking Routes - Concurrency-safe booking endpoints
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  bookSingleSlot,
  bookMeetingSlotsPair,
  cancelSlotBooking,
  getSlotStatus,
  getUserBookings,
  checkAvailability
} from "../controllers/bookingController.js";

const bookingRoutes = Router();

// Apply authentication middleware to all booking routes
bookingRoutes.use(authenticate);

/**
 * POST /api/bookings/slot
 * Book a single availability slot
 * 
 * Concurrency Safety: Uses atomic UPDATE with WHERE is_booked = false
 * If slot is already booked, returns 409 Conflict
 * 
 * Request body: { slotId: string }
 * Response: { success: boolean, message: string, slotId?: string }
 */
bookingRoutes.post("/slot", bookSingleSlot);

/**
 * POST /api/bookings/meeting
 * Book both user and mentor slots atomically
 * 
 * Concurrency Safety: Uses database transaction
 * Either both slots are booked, or neither is booked
 * No partial bookings possible
 * 
 * Request body: { userSlotId: string, mentorSlotId: string }
 * Response: { success: boolean, data: { userSlot, mentorSlot } }
 */
bookingRoutes.post("/meeting", bookMeetingSlotsPair);

/**
 * GET /api/bookings/:slotId/status
 * Check booking status of a specific slot
 * 
 * Response includes:
 * - id, date, startTime, endTime
 * - isBooked (boolean)
 * - bookedAt (timestamp when booked, or null)
 */
bookingRoutes.get("/:slotId/status", getSlotStatus);

/**
 * GET /api/bookings?entityId=...&entityType=...&startDate=...&endDate=...
 * Get all bookings for a user/mentor within a date range
 * 
 * Query params:
 * - entityId: user or mentor UUID
 * - entityType: 'user' or 'mentor'
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 */
bookingRoutes.get("/", getUserBookings);

/**
 * POST /api/bookings/check-availability
 * Check if multiple slots are available (not booked)
 * 
 * Request body: { slotIds: string[] }
 * Response: { success: boolean, data: { [slotId]: { available, isBooked, bookedAt } } }
 */
bookingRoutes.post("/check-availability", checkAvailability);

/**
 * DELETE /api/bookings/:slotId
 * Cancel a booking (unbook a slot)
 * 
 * Returns booking to available status
 * Response: { success: boolean, message: string, slotId: string }
 */
bookingRoutes.delete("/:slotId", cancelSlotBooking);

export default bookingRoutes;
