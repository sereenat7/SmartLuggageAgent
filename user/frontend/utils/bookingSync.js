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
    return null;
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
 * 0 = No booking / Cancelled
 * 1 = Booking Confirmed
 * 2 = Driver Assigned
 * 3 = Pickup in Progress
 * 4 = On the Way
 * 5 = Delivered/Completed
 */
const getBookingStageFromStatusValue = (rawStatus) => {
  const status = String(rawStatus || '').trim().toLowerCase().replace(/-/g, '_');
  if (!status || status === 'cancelled') return 0;
  if (status === 'completed' || status === 'delivered') return 5;
  if (status === 'on_the_way') return 4;
  if (['picked_up', 'pickup_completed', 'en_route', 'picked'].includes(status)) return 4;
  if (status === 'in_progress' || status === 'pickup_started' || status === 'at_pickup') return 3;
  if (status === 'agent_assigned' || status === 'accepted' || status === 'assigned') return 2;
  if (status === 'confirmed' || status === 'pending' || status === 'queued' || status === 'scheduled') return 1;
  return 0;
};

export const getBookingStage = (booking) => {
  if (!booking) return 0;

  if (isCancelledBooking(booking)) {
    return 0;
  }

  const stage = getBookingStageFromStatusValue(booking?.status);
  if (stage > 0) return stage;

  const assignmentStage = getBookingStageFromStatusValue(booking?.assignment_status);
  if (assignmentStage > 0) return assignmentStage;

  return booking?.created_at ? 1 : 0;
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
  const status = String((booking?.status || booking?.booking_status || '') || '').trim().toLowerCase();
  const assignmentStatus = String(booking?.assignment_status || '').trim().toLowerCase();
  if (status === 'cancelled' || assignmentStatus === 'cancelled') {
    return 'Cancelled';
  }

  const stage = getBookingStage(booking);
  if (stage >= 5) return 'Completed';
  if (stage >= 4) return 'Luggage On The Way';
  if (stage >= 3) return 'In Progress';
  if (stage >= 2) return 'Agent Assigned';
  if (stage >= 1) return 'Booking Confirmed';
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
 * Check if booking is cancelled
 */
export const isCancelledBooking = (booking) => {
  if (!booking) return false;
  const status = String(booking?.status || booking?.booking_status || '').trim().toLowerCase();
  const assignmentStatus = String(booking?.assignment_status || '').trim().toLowerCase();
  return status === 'cancelled' || assignmentStatus === 'cancelled';
};

/**
 * Active = not completed and not cancelled
 */
export const isActiveBooking = (booking) => {
  if (!booking) return false;
  return !isCompletedBooking(booking) && !isCancelledBooking(booking);
};

/**
 * Pick the booking the user is most likely tracking right now.
 */
export const resolvePrimaryActiveBooking = (bookings, preferredBookingId = null) => {
  if (!Array.isArray(bookings) || !bookings.length) return null;

  const activeBookings = bookings.filter((booking) => isActiveBooking(booking));
  if (!activeBookings.length) return null;

  if (preferredBookingId) {
    const preferred = activeBookings.find(
      (booking) => Number(booking.id) === Number(preferredBookingId)
    );
    if (preferred) return preferred;
  }

  return activeBookings.reduce((best, current) => {
    const bestStage = getBookingStage(best);
    const currentStage = getBookingStage(current);
    if (currentStage !== bestStage) {
      return currentStage > bestStage ? current : best;
    }

    const bestTime = new Date(best.assigned_at || best.updated_at || best.created_at || 0).getTime();
    const currentTime = new Date(current.assigned_at || current.updated_at || current.created_at || 0).getTime();
    return currentTime > bestTime ? current : best;
  });
};

/**
 * Fetch all bookings for the logged-in user.
 */
export const fetchUserBookings = async (token) => {
  if (!token) return null;

  try {
    const url = addCacheBust(`${API_BASE_URL}/api/bookings`);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !Array.isArray(data.bookings)) return null;
    return data.bookings;
  } catch (error) {
    console.warn('[BookingSync] Error fetching user bookings:', error?.message);
    return null;
  }
};

/**
 * Fetch the primary active booking for the logged-in user.
 */
export const fetchLatestActiveBooking = async (token) => {
  const bookings = await fetchUserBookings(token);
  if (!bookings) return null;

  const preferredId = await getActiveTrackingBooking();
  return resolvePrimaryActiveBooking(bookings, preferredId);
};

/**
 * Poll the bookings list so home / bookings screens stay in sync.
 */
export const startBookingsListPolling = (token, onUpdate, pollIntervalMs = 5000) => {
  if (!token) return null;

  const poll = async () => {
    const bookings = await fetchUserBookings(token);
    if (!bookings) return;

    const preferredId = await getActiveTrackingBooking();
    const activeBooking = resolvePrimaryActiveBooking(bookings, preferredId);

    onUpdate({
      bookings,
      activeBooking,
      recentBookings: bookings.slice(0, 3),
    });
  };

  poll();
  return setInterval(poll, pollIntervalMs);
};

/**
 * Compare booking snapshots to avoid pointless UI churn.
 */
export const hasBookingStatusChanged = (previous, next) => {
  if (!previous || !next) return true;
  return (
    String(previous.status || '') !== String(next.status || '') ||
    String(previous.assignment_status || '') !== String(next.assignment_status || '') ||
    String(previous.booking_status || '') !== String(next.booking_status || '') ||
    Number(previous.assigned_agent_id || 0) !== Number(next.assigned_agent_id || 0)
  );
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
  isCancelledBooking,
  isActiveBooking,
  fetchLatestActiveBooking,
  fetchUserBookings,
  resolvePrimaryActiveBooking,
  startBookingsListPolling,
  hasBookingStatusChanged,
  formatEta,
  setActiveTrackingBooking,
  getActiveTrackingBooking,
};
