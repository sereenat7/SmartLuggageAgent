import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';

/**
 * Booking Sync Service - Synchronizes booking status between agent and user
 * Handles real-time updates, caching, and polling
 */

const BOOKING_SYNC_KEY = 'booking_sync_';
const ACTIVE_BOOKING_KEY = 'activeTrackBookingId';

/**
 * Add cache-busting timestamp to avoid stale data
 */
const addCacheBust = (url) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_ts=${Date.now()}`;
};

/**
 * Fetch latest booking data from backend
 */
export const fetchLatestBooking = async (bookingId, token) => {
  if (!bookingId) return null;

  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const url = addCacheBust(`${API_BASE_URL}/api/bookings/${bookingId}`);
    
    console.log('[BookingSync] Fetching booking:', {
      bookingId,
      url,
      hasToken: !!token,
    });

    const response = await fetch(url, {
      headers: {
        ...headers,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (!response.ok) {
      console.warn(`[BookingSync] Failed to fetch booking ${bookingId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.success && data.booking) {
      console.log('[BookingSync] Booking fetched successfully:', {
        bookingId: data.booking.id,
        status: data.booking.status,
        assignment_status: data.booking.assignment_status,
        stage: getBookingStage(data.booking),
      });
      
      // Cache the booking data locally
      await cacheBooking(bookingId, data.booking);
      return data.booking;
    }

    console.warn('[BookingSync] API returned success=false:', data.message);
    return null;
  } catch (error) {
    console.error('[BookingSync] Error fetching booking:', error?.message || error);
    // Return cached version on error
    return await getCachedBooking(bookingId);
  }
};

/**
 * Cache booking data locally
 */
export const cacheBooking = async (bookingId, bookingData) => {
  try {
    const cacheKey = `${BOOKING_SYNC_KEY}${bookingId}`;
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      data: bookingData,
      timestamp: Date.now(),
      version: 2, // Increment on schema changes
    }));
  } catch (error) {
    console.warn('[BookingSync] Error caching booking:', error?.message);
  }
};

/**
 * Get cached booking data
 */
export const getCachedBooking = async (bookingId) => {
  try {
    const cacheKey = `${BOOKING_SYNC_KEY}${bookingId}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const { data, version } = JSON.parse(cached);
      if (version === 2) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.warn('[BookingSync] Error reading cached booking:', error?.message);
    return null;
  }
};

/**
 * Clear cache for a booking
 */
export const clearBookingCache = async (bookingId) => {
  try {
    const cacheKey = `${BOOKING_SYNC_KEY}${bookingId}`;
    await AsyncStorage.removeItem(cacheKey);
  } catch (error) {
    console.warn('[BookingSync] Error clearing cache:', error?.message);
  }
};

/**
 * Get booking stage based on status
 * 0 = No booking
 * 1 = Booking Confirmed
 * 2 = Driver Assigned
 * 3 = Pickup in Progress
 * 4 = On the Way
 * 5 = Delivered/Completed
 */
export const getBookingStage = (booking) => {
  if (!booking) return 0;

  const status = String(
    booking?.status || booking?.booking_status || ''
  ).trim().toLowerCase();

  const assignmentStatus = String(
    booking?.assignment_status || ''
  ).trim().toLowerCase();

  console.log('[BookingSync] Stage Debug:', {
    status,
    assignmentStatus,
    booking,
  });

  // Stage 5 - Delivered
  if (
    booking?.delivered_at ||
    status === 'completed' ||
    status === 'delivered' ||
    assignmentStatus === 'completed' ||
    assignmentStatus === 'delivered'
  ) {
    return 5;
  }

  // Stage 4 - On the Way
  if (
    booking?.pickup_completed_at ||
    status === 'on_the_way' ||
    status === 'on-the-way' ||
    status === 'picked_up' ||
    status === 'picked' ||
    status === 'pickup_completed' ||
    assignmentStatus === 'on_the_way' ||
    assignmentStatus === 'on-the-way' ||
    assignmentStatus === 'picked_up' ||
    assignmentStatus === 'picked' ||
    assignmentStatus === 'en_route' ||
    assignmentStatus === 'pickup_completed'
  ) {
    return 4;
  }

  // Stage 3 - Pickup Started / In Progress
  if (
    booking?.pickup_started_at ||
    status === 'in_progress' ||
    status === 'in-progress' ||
    status === 'pickup_started' ||
    status === 'at_pickup' ||
    assignmentStatus === 'in_progress' ||
    assignmentStatus === 'in-progress' ||
    assignmentStatus === 'at_pickup' ||
    assignmentStatus === 'pickup_started'
  ) {
    return 3;
  }

  // Stage 2 - Agent Assigned
if (
  status === 'agent_assigned' ||
  status === 'accepted' ||
  status === 'assigned' ||
  assignmentStatus === 'agent_assigned' ||
  assignmentStatus === 'accepted' ||
  assignmentStatus === 'assigned' ||
  booking?.accepted_at
) {
  return 2;
}
  // Stage 1 - Booking Created
  if (booking?.created_at) {
    return 1;
  }

  return 0;
};
/**
 * Build timeline for UI display
 */
export const buildTimeline = (booking) => {
  const stage = getBookingStage(booking);

  const formatTimestamp = (value) => {
    if (!value) return 'Pending';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return [
    {
      title: 'Booking Confirmed',
      timestamp: formatTimestamp(booking?.created_at),
      active: stage >= 1,
    },
    {
      title: 'Agent Assigned',
      timestamp: stage >= 2 ? formatTimestamp(booking?.assigned_at) : 'Pending',
      active: stage >= 2,
    },
    {
      title: 'In Progress',
      timestamp: stage >= 3 ? formatTimestamp(booking?.pickup_started_at) : 'Pending',
      active: stage >= 3,
    },
    {
      title: 'On the Way',
      timestamp: stage >= 4 ? formatTimestamp(booking?.pickup_completed_at) : 'Pending',
      active: stage >= 4,
    },
    {
      title: 'Completed',
      timestamp: stage >= 5 ? formatTimestamp(booking?.delivered_at) : 'Pending',
      active: stage >= 5,
    },
  ];
};

export const getTrackingStatusLabel = (booking) => {
  const stage = getBookingStage(booking);
  if (stage >= 5) return 'Completed';
  if (stage >= 4) return 'Luggage On The Way';
  if (stage >= 3) return 'In Progress';
  if (stage >= 2) return 'Agent Assigned';
  return 'Pending';
};

/**
 * Extract the latest known agent location from booking payloads.
 * Supports the different field names already used across the app/backend.
 */
export const getLiveAgentLocation = (booking) => {
  if (!booking) return null;

  const latitude = Number(
    booking?.agent_latitude ??
    booking?.agentLatitude ??
    booking?.latitude ??
    booking?.current_agent_latitude ??
    booking?.currentAgentLatitude ??
    booking?.assigned_agent_latitude ??
    booking?.assignedAgentLatitude
  );
  const longitude = Number(
    booking?.agent_longitude ??
    booking?.agentLongitude ??
    booking?.longitude ??
    booking?.current_agent_longitude ??
    booking?.currentAgentLongitude ??
    booking?.assigned_agent_longitude ??
    booking?.assignedAgentLongitude
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    updatedAt: booking?.agent_location_updated_at || booking?.location_updated_at || booking?.agentLocationUpdatedAt || null,
  };
};

/**
 * Start polling for booking updates
 * Returns interval ID (save it to clear later)
 */
export const startBookingPolling = (
  bookingId,
  token,
  onUpdate,
  pollIntervalMs = 3000 // More aggressive polling
) => {
  if (!bookingId) return null;

  console.log(`[BookingSync] 🔄 Starting polling for booking ${bookingId} every ${pollIntervalMs}ms`);

  // Immediate first fetch
  fetchLatestBooking(bookingId, token).then((booking) => {
    if (booking) {
      console.log('[BookingSync] ✅ Initial fetch successful');
      onUpdate(booking);
    }
  });

  // Set up polling
  let pollCount = 0;
  const intervalId = setInterval(() => {
    pollCount++;
    console.log(`[BookingSync] 🔄 Poll #${pollCount} for booking ${bookingId}`);
    
    fetchLatestBooking(bookingId, token).then((booking) => {
      if (booking) {
        console.log(`[BookingSync] ✅ Poll #${pollCount} - Status: ${booking.status}, Assignment: ${booking.assignment_status}`);
        onUpdate(booking);
      }
    });
  }, pollIntervalMs);

  return intervalId;
};

/**
 * Stop polling
 */
export const stopBookingPolling = (intervalId) => {
  if (intervalId) {
    clearInterval(intervalId);
    console.log('[BookingSync] Polling stopped');
  }
};

/**
 * Get driver details from booking
 */
export const getDriverDetails = (booking, stage) => {
  if (!booking || stage < 2) {
    return {
      name: 'No driver assigned',
      phone: '',
      vehicleNumber: 'Waiting for agent acceptance',
      visible: false,
      location: null,
    };
  }

  return {
    name: booking?.assigned_agent_id ? `Agent #${booking.assigned_agent_id}` : 'Driver details loading...',
    phone: booking?.agent_phone || '',
    vehicleNumber: booking?.vehicle_number || booking?.vehicle_type || 'Vehicle pending',
    visible: true,
    location: getLiveAgentLocation(booking),
  };
};

/**
 * Check if booking is completed
 */
export const isCompletedBooking = (booking) => {
  if (!booking) return false;
  const stage = getBookingStage(booking);
  return stage >= 5;
};

/**
 * Format ETA text
 */
export const formatEta = (minutes) => {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric) || numeric <= 0) return '--';
  return `${Math.round(numeric)} mins`;
};

/**
 * Store active booking ID for tracking
 */
export const setActiveTrackingBooking = async (bookingId) => {
  try {
    if (bookingId) {
      await AsyncStorage.setItem(ACTIVE_BOOKING_KEY, String(bookingId));
    } else {
      await AsyncStorage.removeItem(ACTIVE_BOOKING_KEY);
    }
  } catch (error) {
    console.warn('[BookingSync] Error setting active booking:', error?.message);
  }
};

/**
 * Get active booking ID
 */
export const getActiveTrackingBooking = async () => {
  try {
    return await AsyncStorage.getItem(ACTIVE_BOOKING_KEY);
  } catch (error) {
    console.warn('[BookingSync] Error getting active booking:', error?.message);
    return null;
  }
};

export default {
  fetchLatestBooking,
  cacheBooking,
  getCachedBooking,
  clearBookingCache,
  getBookingStage,
  buildTimeline,
  startBookingPolling,
  stopBookingPolling,
  getDriverDetails,
  isCompletedBooking,
  formatEta,
  setActiveTrackingBooking,
  getActiveTrackingBooking,
};
