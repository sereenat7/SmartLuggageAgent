import * as Location from 'expo-location';
import { USER_API_URL } from '../config';

export const TRACKING_STATUS = {
  PENDING: 'pending',
  AGENT_ASSIGNED: 'agent_assigned',
  IN_PROGRESS: 'in_progress',
  ON_THE_WAY: 'on_the_way',
  COMPLETED: 'completed',
};

const DEFAULT_CITY_SPEED_KMPH = 28;

const normalizeStatus = (value) => {
  const status = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (['accepted', 'assigned', 'queued'].includes(status)) return TRACKING_STATUS.AGENT_ASSIGNED;
  if (['in-progress', 'pickup_started', 'at_pickup'].includes(status)) return TRACKING_STATUS.IN_PROGRESS;
  if (['picked_up', 'pickup_completed', 'en_route', 'on-the-way'].includes(status)) return TRACKING_STATUS.ON_THE_WAY;
  if (['delivered', 'completed'].includes(status)) return TRACKING_STATUS.COMPLETED;
  return status || TRACKING_STATUS.PENDING;
};

const toNumberOrNull = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const normalizeTrackingBooking = (booking = {}) => ({
  ...booking,
  id: booking?.id || booking?.bookingId || booking?.booking_id || null,
  status: normalizeStatus(booking?.status || booking?.booking_status || booking?.assignment_status || TRACKING_STATUS.PENDING),
  username: booking?.username || booking?.name || booking?.userName || booking?.customerName || 'Customer',
  phone: booking?.phone || booking?.userPhone || booking?.customerPhone || '',
  pickup_address: booking?.pickup_address || booking?.pickupAddress || booking?.pickupLocation || 'Pickup location pending',
  drop_address: booking?.drop_address || booking?.dropAddress || booking?.dropLocation || 'Drop location pending',
  pickup_latitude: booking?.pickup_latitude ?? booking?.pickupLatitude ?? null,
  pickup_longitude: booking?.pickup_longitude ?? booking?.pickupLongitude ?? null,
  drop_latitude: booking?.drop_latitude ?? booking?.dropLatitude ?? null,
  drop_longitude: booking?.drop_longitude ?? booking?.dropLongitude ?? null,
  pickup_time: booking?.pickup_time || booking?.timeSlot || booking?.pickupTime || 'Time slot pending',
  bag_count: booking?.bag_count ?? booking?.bagCount ?? booking?.luggage ?? 1,
  tracking_qr: booking?.tracking_qr || null,
});

export const getTrackingStatusLabel = (status) => {
  switch (normalizeStatus(status)) {
    case TRACKING_STATUS.PENDING:
      return 'Pending';
    case TRACKING_STATUS.AGENT_ASSIGNED:
      return 'Agent Assigned';
    case TRACKING_STATUS.IN_PROGRESS:
      return 'In Progress';
    case TRACKING_STATUS.ON_THE_WAY:
      return 'On The Way';
    case TRACKING_STATUS.COMPLETED:
      return 'Completed';
    default:
      return 'Pending';
  }
};

export const getTrackingActionConfig = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === TRACKING_STATUS.AGENT_ASSIGNED) {
    return { label: 'ARRIVED / START TASK', action: 'start' };
  }
  if (normalized === TRACKING_STATUS.IN_PROGRESS) {
    return { label: 'TASK IN PROGRESS', action: 'none' };
  }
  if (normalized === TRACKING_STATUS.ON_THE_WAY) {
    return { label: 'ON THE WAY', action: 'none' };
  }
  if (normalized === TRACKING_STATUS.COMPLETED) {
    return { label: 'DELIVERED', action: 'done' };
  }
  return { label: 'TRACKING UNAVAILABLE', action: 'none' };
};

export const getTrackingMapTarget = (booking) => {
  const normalized = normalizeTrackingBooking(booking);
  const status = normalizeStatus(normalized.status);
  const useDrop = status === TRACKING_STATUS.ON_THE_WAY || status === TRACKING_STATUS.COMPLETED;

  if (useDrop) {
    const latitude = toNumberOrNull(normalized.drop_latitude);
    const longitude = toNumberOrNull(normalized.drop_longitude);
    return {
      latitude,
      longitude,
      label: 'Drop location',
      title: normalized.drop_address,
      routePhase: 'delivery',
    };
  }

  const latitude = toNumberOrNull(normalized.pickup_latitude);
  const longitude = toNumberOrNull(normalized.pickup_longitude);
  return {
    latitude,
    longitude,
    label: 'Pickup location',
    title: normalized.pickup_address,
    routePhase: 'pickup',
  };
};

export const fetchAgentLocationOnce = async () => {
  const permissionResult = await Location.requestForegroundPermissionsAsync();
  if (permissionResult.status !== 'granted') {
    throw new Error('Location permission denied');
  }

  const currentPosition = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: currentPosition.coords.latitude,
    longitude: currentPosition.coords.longitude,
  };
};

export const fetchRouteLine = async (fromLocation, toLocation) => {
  if (!fromLocation || !toLocation) {
    return {
      coordinates: [],
      distanceKm: null,
      etaMinutes: null,
      routeError: 'Route unavailable',
    };
  }

  try {
    const routeUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromLocation.longitude},${fromLocation.latitude};` +
      `${toLocation.longitude},${toLocation.latitude}` +
      `?overview=full&geometries=geojson`;

    const response = await fetch(routeUrl);
    const data = await response.json();
    const bestRoute = data?.routes?.[0];

    if (!response.ok || !bestRoute?.geometry?.coordinates?.length) {
      throw new Error('No route found');
    }

    return {
      coordinates: bestRoute.geometry.coordinates.map((coordinate) => ({
        latitude: coordinate[1],
        longitude: coordinate[0],
      })),
      distanceKm: Number((bestRoute.distance / 1000).toFixed(1)),
      etaMinutes: Math.max(1, Math.ceil(bestRoute.duration / 60)),
      routeError: '',
    };
  } catch (_error) {
    const straightDistance = haversineKm(
      fromLocation.latitude,
      fromLocation.longitude,
      toLocation.latitude,
      toLocation.longitude,
    );

    return {
      coordinates: [fromLocation, toLocation],
      distanceKm: Number(straightDistance.toFixed(1)),
      etaMinutes: Math.max(1, Math.ceil((straightDistance / DEFAULT_CITY_SPEED_KMPH) * 60)),
      routeError: 'Live route unavailable. Showing direct path.',
    };
  }
};

const parseResponseJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    return {};
  }
};

export const startBookingTask = async (bookingId) => {
  const response = await fetch(`${USER_API_URL}/api/bookings/start/${bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await parseResponseJson(response);
  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || 'Failed to start task');
  }

  return data.booking;
};

export const verifyTrackingQr = async (bookingId, qrType, qrValue) => {
  const response = await fetch(`${USER_API_URL}/api/bookings/verify-qr/${bookingId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrType, qrValue }),
  });

  const data = await parseResponseJson(response);
  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || 'Failed to verify QR');
  }

  return data.booking;
};

export const formatDistance = (distanceKm) => {
  const numeric = Number(distanceKm);
  if (!Number.isFinite(numeric)) return '--';
  return `${numeric.toFixed(1)} km`;
};

export const formatEta = (minutes) => {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric) || numeric <= 0) return '--';
  return `${Math.round(numeric)} min`;
};
