/**
 * Booking Service - Concurrency-Safe Booking Implementation
 * 
 * This service handles booking of availability slots with:
 * - Database transactions for atomicity
 * - Pessimistic locking to prevent double-booking
 * - Atomic conditional updates (CAS pattern)
 */

import { prisma } from "../lib/prisma.js";

/**
 * Atomically book an availability slot
 * 
 * Uses conditional update pattern: UPDATE ... WHERE is_booked = false
 * If no rows updated, it means the slot was already booked by another request
 * 
 * @param {string} slotId - The availability slot ID to book
 * @param {string} userId - User ID booking the slot
 * @param {string} mentorId - Mentor ID for the booking
 * @returns {object} Booking result with success status and slot data
 */
export async function bookSlot(slotId, userId, mentorId) {
  try {
    // Use raw SQL for atomic conditional update
    // This ensures no double-booking is possible
    const result = await prisma.$executeRawUnsafe(`
      UPDATE availabilities 
      SET is_booked = true, booked_at = NOW()
      WHERE id = $1 AND is_booked = false
      RETURNING *
    `, slotId);

    // If no rows were updated, the slot was already booked
    if (!result || result === 0) {
      return {
        success: false,
        error: "SLOT_ALREADY_BOOKED",
        message: "This slot has already been booked by another user"
      };
    }

    return {
      success: true,
      slotId,
      message: "Slot booked successfully"
    };
  } catch (error) {
    console.error("Error booking slot:", error);
    return {
      success: false,
      error: "BOOKING_ERROR",
      message: "Failed to book slot"
    };
  }
}

/**
 * Atomically book both user and mentor slots in a transaction
 * 
 * Both slots must be successfully booked or neither is booked
 * This prevents partial bookings (both sides must agree)
 * 
 * @param {string} userSlotId - User's availability slot ID
 * @param {string} mentorSlotId - Mentor's availability slot ID
 * @returns {object} Transaction result
 */
export async function bookMeetingSlots(userSlotId, mentorSlotId) {
  try {
    // Begin transaction
    const result = await prisma.$transaction(async (tx) => {
      // Verify both slots exist and are not booked
      const userSlot = await tx.availability.findUnique({
        where: { id: userSlotId }
      });

      const mentorSlot = await tx.availability.findUnique({
        where: { id: mentorSlotId }
      });

      // Check if slots exist
      if (!userSlot || !mentorSlot) {
        throw new Error("SLOT_NOT_FOUND");
      }

      // Check if already booked
      if (userSlot.is_booked || mentorSlot.is_booked) {
        throw new Error("SLOT_ALREADY_BOOKED");
      }

      // Verify slots have same date and times overlap
      if (new Date(userSlot.date).getTime() !== new Date(mentorSlot.date).getTime()) {
        throw new Error("SLOTS_ON_DIFFERENT_DATES");
      }

      if (
        new Date(userSlot.startTime) >= new Date(mentorSlot.endTime) ||
        new Date(userSlot.endTime) <= new Date(mentorSlot.startTime)
      ) {
        throw new Error("SLOTS_DO_NOT_OVERLAP");
      }

      // Book user slot
      const bookedUserSlot = await tx.availability.update({
        where: { id: userSlotId },
        data: {
          isBooked: true,
          bookedAt: new Date()
        }
      });

      // Book mentor slot
      const bookedMentorSlot = await tx.availability.update({
        where: { id: mentorSlotId },
        data: {
          isBooked: true,
          bookedAt: new Date()
        }
      });

      return {
        userSlot: bookedUserSlot,
        mentorSlot: bookedMentorSlot
      };
    });

    return {
      success: true,
      data: result,
      message: "Both slots booked successfully"
    };
  } catch (error) {
    console.error("Error booking meeting slots:", error);

    // Handle specific errors
    if (error.message === "SLOT_NOT_FOUND") {
      return {
        success: false,
        error: "SLOT_NOT_FOUND",
        message: "One or both slots do not exist"
      };
    }

    if (error.message === "SLOT_ALREADY_BOOKED") {
      return {
        success: false,
        error: "SLOT_ALREADY_BOOKED",
        message: "One or both slots have already been booked"
      };
    }

    if (error.message === "SLOTS_ON_DIFFERENT_DATES") {
      return {
        success: false,
        error: "SLOTS_ON_DIFFERENT_DATES",
        message: "Slots must be on the same date"
      };
    }

    if (error.message === "SLOTS_DO_NOT_OVERLAP") {
      return {
        success: false,
        error: "SLOTS_DO_NOT_OVERLAP",
        message: "Slots must have overlapping times"
      };
    }

    return {
      success: false,
      error: "TRANSACTION_ERROR",
      message: "Failed to book slots due to transaction error"
    };
  }
}

/**
 * Cancel a booking (mark slot as not booked)
 * 
 * @param {string} slotId - The availability slot ID to cancel
 * @returns {object} Cancellation result
 */
export async function cancelBooking(slotId) {
  try {
    const result = await prisma.availability.update({
      where: { id: slotId },
      data: {
        isBooked: false,
        bookedAt: null
      }
    });

    return {
      success: true,
      slotId,
      message: "Booking cancelled successfully"
    };
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return {
      success: false,
      error: "CANCELLATION_ERROR",
      message: "Failed to cancel booking"
    };
  }
}

/**
 * Get booking status of a slot
 * 
 * @param {string} slotId - The availability slot ID
 * @returns {object} Slot with booking information
 */
export async function getSlotBookingStatus(slotId) {
  try {
    const slot = await prisma.availability.findUnique({
      where: { id: slotId },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        isBooked: true,
        bookedAt: true,
        entityId: true,
        entityType: true
      }
    });

    if (!slot) {
      return {
        success: false,
        error: "SLOT_NOT_FOUND",
        message: "Slot does not exist"
      };
    }

    return {
      success: true,
      data: slot
    };
  } catch (error) {
    console.error("Error getting slot status:", error);
    return {
      success: false,
      error: "QUERY_ERROR",
      message: "Failed to get slot status"
    };
  }
}

/**
 * Release a booking after a timeout (for implementing expiration)
 * 
 * @param {string} slotId - The availability slot ID
 * @param {number} expiryMinutes - Minutes before booking expires (default: 30)
 * @returns {object} Result of release attempt
 */
export async function releaseExpiredBooking(slotId, expiryMinutes = 30) {
  try {
    // Calculate expiry time
    const expiryTime = new Date(Date.now() - expiryMinutes * 60 * 1000);

    // Only release if booked_at is before expiry time
    const result = await prisma.availability.updateMany({
      where: {
        id: slotId,
        isBooked: true,
        bookedAt: {
          lt: expiryTime
        }
      },
      data: {
        isBooked: false,
        bookedAt: null
      }
    });

    if (result.count === 0) {
      return {
        success: false,
        message: "Booking was not expired or not found"
      };
    }

    return {
      success: true,
      message: "Expired booking released",
      count: result.count
    };
  } catch (error) {
    console.error("Error releasing expired booking:", error);
    return {
      success: false,
      error: "RELEASE_ERROR",
      message: "Failed to release expired booking"
    };
  }
}

/**
 * Get all booked slots for a user/mentor within a date range
 * 
 * @param {string} entityId - User or mentor ID
 * @param {string} entityType - 'user' or 'mentor'
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {object} Array of booked slots
 */
export async function getBookedSlots(entityId, entityType, startDate, endDate) {
  try {
    const slots = await prisma.availability.findMany({
      where: {
        entityId,
        entityType,
        isBooked: true,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        date: "asc"
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        bookedAt: true
      }
    });

    return {
      success: true,
      data: slots,
      count: slots.length
    };
  } catch (error) {
    console.error("Error getting booked slots:", error);
    return {
      success: false,
      error: "QUERY_ERROR",
      message: "Failed to get booked slots"
    };
  }
}

export default {
  bookSlot,
  bookMeetingSlots,
  cancelBooking,
  getSlotBookingStatus,
  releaseExpiredBooking,
  getBookedSlots
};
