const crypto = require('crypto');

/**
 * Get comprehensive verification status for a scanned QR
 */
const getVerificationStatus = (bookingRow, qrType) => {
  if (!bookingRow) {
    return {
      status: 'invalid',
      reason: 'QR does not exist',
      message: 'This booking could not be found',
    };
  }

  const isPickup = qrType === 'pickup';

  if (isPickup) {
    // Check if pickup has already been verified
    if (bookingRow.pickup_verified_at) {
      return {
        status: 'already-used',
        reason: 'Pickup already verified',
        message: 'This QR has already been scanned for pickup verification',
        verifiedAt: bookingRow.pickup_verified_at,
        verifiedByAgentId: bookingRow.pickup_verified_by_agent_id,
      };
    }

    return {
      status: 'valid',
      type: 'pickup',
      message: 'Ready for pickup verification',
    };
  } else {
    // Destination QR
    // Check if destination is locked
    if (!bookingRow.destination_qr_unlocked_at) {
      return {
        status: 'locked',
        reason: 'Agent has not arrived',
        message: 'This QR cannot be used until the agent marks "Arrived at Destination"',
        currentStatus: bookingRow.status,
      };
    }

    // Check if delivery has already been verified
    if (bookingRow.delivery_verified_at) {
      return {
        status: 'already-used',
        reason: 'Delivery already completed',
        message: 'This booking has already been marked as delivered',
        verifiedAt: bookingRow.delivery_verified_at,
        verifiedByAgentId: bookingRow.delivery_verified_by_agent_id,
      };
    }

    return {
      status: 'valid',
      type: 'destination',
      message: 'Ready for delivery verification',
    };
  }
};

/**
 * Format booking details for verification display
 */
const formatBookingForVerification = (bookingRow, qrType) => {
  const isPickup = qrType === 'pickup';

  return {
    bookingId: bookingRow.id,
    customerName: bookingRow.username,
    customerPhone: bookingRow.phone,
    customerEmail: bookingRow.email,
    bookingDate: bookingRow.created_at,
    bookingStatus: bookingRow.status,
    pickupVerified: Boolean(bookingRow.pickup_verified),
    pickupVerifiedAt: bookingRow.pickup_verified_at,
    pickupVerifiedByAgentId: bookingRow.pickup_verified_by_agent_id,
    pickupVerifiedByAgentName: bookingRow.pickup_verified_by_agent_name,
    qrType: qrType,
    ...(isPickup && {
      pickupLocation: bookingRow.pickup_address,
      pickupTime: bookingRow.pickup_time,
      destinationLocation: bookingRow.drop_address || bookingRow.airport,
      bagCount: bookingRow.bag_count || bookingRow.luggage_count,
      airline: bookingRow.airline_name,
      flightNumber: bookingRow.flight_number,
      terminal: bookingRow.terminal,
    }),
    ...(!isPickup && {
      destinationLocation: bookingRow.drop_address || bookingRow.airport,
      pickupLocation: bookingRow.pickup_address,
      bagCount: bookingRow.bag_count || bookingRow.luggage_count,
    }),
  };
};

/**
 * Generate verification log entry
 */
const createVerificationLog = ({
  bookingId,
  qrType,
  agentId,
  agentName,
  ipAddress,
  verificationResult,
  errorMessage = null,
}) => {
  return {
    timestamp: new Date().toISOString(),
    bookingId,
    qrType,
    agentId,
    agentName,
    ipAddress,
    verificationResult, // 'success' or 'failed'
    errorMessage,
    userAgent: process.env.USER_AGENT || 'Unknown',
  };
};

module.exports = {
  getVerificationStatus,
  formatBookingForVerification,
  createVerificationLog,
};
