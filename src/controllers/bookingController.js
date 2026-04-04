/**
 * Booking Controller - Handles booking endpoints with concurrency safety
 * 
 * Endpoints:
 * POST /api/bookings/slot - Book a single slot
 * POST /api/bookings/meeting - Book both user and mentor slots for a meeting
 * DELETE /api/bookings/:slotId - Cancel a booking
 * GET /api/bookings/:slotId/status - Get booking status
 * GET /api/bookings/user/:userId - Get all bookings for a user
 */

import {
  bookSlot,
  bookMeetingSlots,
  cancelBooking,
  getSlotBookingStatus,
  getBookedSlots
} from "../services/bookingService.js";

/**
 * POST /api/bookings/slot
 * Book a single availability slot
 * 
 * Request body:
 * {
 *   slotId: string (UUID of availability slot to book)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   slotId?: string,
 *   error?: string
 * }
 */
export async function bookSingleSlot(req, res, next) {
  try {
    const { slotId } = req.body;

    // Validate input
    if (!slotId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "slotId is required"
      });
    }

    // Attempt to book slot
    const result = await bookSlot(slotId);

    if (!result.success) {
      // 409 Conflict if slot already booked
      if (result.error === "SLOT_ALREADY_BOOKED") {
        return res.status(409).json(result);
      }
      return res.status(500).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in bookSingleSlot:", error);
    next(error);
  }
}

/**
 * POST /api/bookings/meeting
 * Book both user and mentor slots atomically for a meeting
 * 
 * Request body:
 * {
 *   userSlotId: string (UUID of user's availability slot),
 *   mentorSlotId: string (UUID of mentor's availability slot)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   data?: {
 *     userSlot: { id, date, startTime, endTime, isBooked, bookedAt },
 *     mentorSlot: { id, date, startTime, endTime, isBooked, bookedAt }
 *   },
 *   error?: string
 * }
 * 
 * Transaction guarantees:
 * - Either both slots are booked, or neither is booked
 * - No partial bookings possible
 * - Atomic from database perspective
 */
export async function bookMeetingSlotsPair(req, res, next) {
  try {
    const { userSlotId, mentorSlotId } = req.body;

    // Validate input
    if (!userSlotId || !mentorSlotId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "userSlotId and mentorSlotId are required"
      });
    }

    // Verify IDs are different
    if (userSlotId === mentorSlotId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "userSlotId and mentorSlotId must be different"
      });
    }

    // Attempt to book both slots in a transaction
    const result = await bookMeetingSlots(userSlotId, mentorSlotId);

    if (!result.success) {
      // 409 Conflict for booking conflicts
      if (
        result.error === "SLOT_ALREADY_BOOKED" ||
        result.error === "SLOTS_DO_NOT_OVERLAP" ||
        result.error === "SLOTS_ON_DIFFERENT_DATES"
      ) {
        return res.status(409).json(result);
      }

      // 404 Not Found
      if (result.error === "SLOT_NOT_FOUND") {
        return res.status(404).json(result);
      }

      return res.status(500).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in bookMeetingSlotsPair:", error);
    next(error);
  }
}

/**
 * DELETE /api/bookings/:slotId
 * Cancel a booking (unbook a slot)
 * 
 * URL params:
 * - slotId: UUID of the booked slot
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   slotId: string
 * }
 */
export async function cancelSlotBooking(req, res, next) {
  try {
    const { slotId } = req.params;

    // Validate input
    if (!slotId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "slotId is required"
      });
    }

    // Attempt to cancel booking
    const result = await cancelBooking(slotId);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in cancelSlotBooking:", error);
    next(error);
  }
}

/**
 * GET /api/bookings/:slotId/status
 * Get booking status of a specific slot
 * 
 * URL params:
 * - slotId: UUID of the availability slot
 * 
 * Response:
 * {
 *   success: boolean,
 *   data?: {
 *     id: string,
 *     date: Date,
 *     startTime: DateTime,
 *     endTime: DateTime,
 *     isBooked: boolean,
 *     bookedAt: DateTime | null,
 *     entityId: string,
 *     entityType: 'user' | 'mentor'
 *   },
 *   error?: string,
 *   message?: string
 * }
 */
export async function getSlotStatus(req, res, next) {
  try {
    const { slotId } = req.params;

    // Validate input
    if (!slotId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "slotId is required"
      });
    }

    // Get slot status
    const result = await getSlotBookingStatus(slotId);

    if (!result.success) {
      if (result.error === "SLOT_NOT_FOUND") {
        return res.status(404).json(result);
      }
      return res.status(500).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getSlotStatus:", error);
    next(error);
  }
}

/**
 * GET /api/bookings?entityId=...&entityType=...&startDate=...&endDate=...
 * Get all bookings for a user/mentor within a date range
 * 
 * Query params:
 * - entityId: UUID of user or mentor
 * - entityType: 'user' or 'mentor'
 * - startDate: ISO date (YYYY-MM-DD)
 * - endDate: ISO date (YYYY-MM-DD)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data?: Array of {
 *     id: string,
 *     date: Date,
 *     startTime: DateTime,
 *     endTime: DateTime,
 *     bookedAt: DateTime
 *   },
 *   count?: number,
 *   error?: string,
 *   message?: string
 * }
 */
export async function getUserBookings(req, res, next) {
  try {
    const { entityId, entityType, startDate, endDate } = req.query;

    // Validate input
    if (!entityId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "entityId is required"
      });
    }

    if (!entityType || !["user", "mentor"].includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "entityType must be 'user' or 'mentor'"
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "startDate and endDate are required (YYYY-MM-DD format)"
      });
    }

    // Validate date formats
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "startDate and endDate must be valid dates (YYYY-MM-DD format)"
      });
    }

    // Get bookings
    const result = await getBookedSlots(entityId, entityType, start, end);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getUserBookings:", error);
    next(error);
  }
}

/**
 * POST /api/bookings/check-availability
 * Check if specific slots are still available (not booked)
 * 
 * Request body:
 * {
 *   slotIds: string[] (array of slot IDs to check)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     slotId: {
 *       available: boolean,
 *       isBooked: boolean,
 *       bookedAt: DateTime | null
 *     }
 *   }
 * }
 */
export async function checkAvailability(req, res, next) {
  try {
    const { slotIds } = req.body;

    // Validate input
    if (!slotIds || !Array.isArray(slotIds) || slotIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "slotIds must be a non-empty array"
      });
    }

    if (slotIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "Maximum 100 slots can be checked at once"
      });
    }

    // Get all slot statuses
    const slots = await Promise.all(
      slotIds.map(slotId => getSlotBookingStatus(slotId))
    );

    const availability = {};
    slotIds.forEach((slotId, index) => {
      const slotResult = slots[index];
      if (slotResult.success) {
        availability[slotId] = {
          available: !slotResult.data.isBooked,
          isBooked: slotResult.data.isBooked,
          bookedAt: slotResult.data.bookedAt
        };
      } else {
        availability[slotId] = {
          available: false,
          error: "SLOT_NOT_FOUND"
        };
      }
    });

    res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error) {
    console.error("Error in checkAvailability:", error);
    next(error);
  }
}

export default {
  bookSingleSlot,
  bookMeetingSlotsPair,
  cancelSlotBooking,
  getSlotStatus,
  getUserBookings,
  checkAvailability
};
