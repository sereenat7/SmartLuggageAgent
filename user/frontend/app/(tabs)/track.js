import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../utils/api';
import * as bookingSync from '../../utils/bookingSync';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ACTIVE_COLOR = '#00cc66';
const INACTIVE_COLOR = '#cbd5e1';

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

const formatEta = (minutes) => {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric) || numeric <= 0) return '--';
  return `${Math.round(numeric)} mins`;
};

const normalizePhoneForTel = (raw) => {
  const phone = String(raw || '').replace(/\s+/g, '').trim();
  if (!phone) return '';
  if (phone.startsWith('+')) return phone;
  if (/^\d{10}$/.test(phone)) return `+91${phone}`;
  return phone;
};

const addCacheBust = (url) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_ts=${Date.now()}`;
};

const DEFAULT_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 18,
  longitudeDelta: 18,
};

const GEOAPIFY_STATIC_MAP_KEY = '6a6f5450f3164727b88686b4a5a0fffd';
// Tile style for interactive map. Change to 'osm-bright', 'osm-liberty', 'osm-bright-smooth', 'positron' etc.
const GEOAPIFY_TILE_STYLE = 'osm-liberty';

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const estimateEtaMinutes = (fromLocation, toLocation, speedKmph = 28) => {
  if (!fromLocation || !toLocation) return null;
  const distanceKm = haversineKm(fromLocation.latitude, fromLocation.longitude, toLocation.latitude, toLocation.longitude);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  return Math.max(1, Math.round((distanceKm / speedKmph) * 60));
};

const extractRouteMeta = (routeGeoJson) => {
  const feature = routeGeoJson?.features?.[0];
  const coords = extractRouteCoordinates(routeGeoJson);
  const distanceM = Number(feature?.properties?.distance);
  const timeS = Number(feature?.properties?.time);
  return {
    coordinates: coords,
    distanceKm: Number.isFinite(distanceM) ? distanceM / 1000 : null,
    durationMinutes: Number.isFinite(timeS) ? Math.max(1, Math.round(timeS / 60)) : null,
  };
};

const parseJsonResponse = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    console.warn('[Track] Non-JSON response:', text.slice(0, 160));
    return {};
  }
};

const fetchOsrmRoute = async (from, to) => {
  if (!from || !to) return null;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
    const routeRes = await fetch(url);
    const routeData = await parseJsonResponse(routeRes);
    const coords = routeData?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const distanceM = Number(routeData.routes[0].distance);
    const durationS = Number(routeData.routes[0].duration);
    return {
      coordinates: coords,
      distanceKm: Number.isFinite(distanceM) ? distanceM / 1000 : null,
      durationMinutes: Number.isFinite(durationS) ? Math.max(1, Math.round(durationS / 60)) : null,
    };
  } catch (err) {
    console.warn('[Track] OSRM route failed:', err?.message);
    return null;
  }
};

const fetchGeoapifyRoute = async (from, to) => {
  if (!from || !to) return null;
  try {
    const routeUrl = `https://api.geoapify.com/v1/routing?waypoints=${from.longitude},${from.latitude}|${to.longitude},${to.latitude}&mode=drive&format=geojson&apiKey=${GEOAPIFY_STATIC_MAP_KEY}`;
    const routeRes = await fetch(routeUrl);
    const routeData = await parseJsonResponse(routeRes);
    if (!routeData?.features?.length) return null;
    return extractRouteMeta(routeData);
  } catch (err) {
    console.warn('[Track] Geoapify route failed:', err?.message);
    return null;
  }
};

const fetchDrivingRoute = async (from, to) => {
  const geoapifyRoute = await fetchGeoapifyRoute(from, to);
  if (geoapifyRoute?.coordinates?.length > 1) return geoapifyRoute;
  return fetchOsrmRoute(from, to);
};

const buildAgentFromBooking = (booking) => {
  const agentId = booking?.resolved_agent_id || booking?.assigned_agent_id;
  if (!agentId) return null;
  return {
    agentId,
    id: agentId,
    name: booking.agent_name,
    phone: booking.agent_phone,
    latitude: booking.agent_latitude,
    longitude: booking.agent_longitude,
    vehicleType: booking.agent_vehicle_type,
    vehicleNumber: booking.agent_vehicle_type,
  };
};

const extractRouteCoordinates = (routeGeoJson) => {
  const geometry = routeGeoJson?.features?.[0]?.geometry;
  if (!geometry?.coordinates) return [];

  if (geometry.type === 'LineString') {
    return geometry.coordinates;
  }

  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.flat().filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2);
  }

  return [];
};

const buildGeoapifyStaticMapUrl = ({ centerLatitude, centerLongitude, pickupLatitude, pickupLongitude, dropLatitude, dropLongitude, routeCoordinates, hasPickupPoint, hasDropPoint }) => {
  // smaller default size to avoid excessively long URLs and large downloads on mobile
  const width = 900;
  const height = 600;
  const center = `lonlat:${centerLongitude},${centerLatitude}`;
  const zoom = hasPickupPoint && hasDropPoint ? 11.5 : 12.5;
  const markers = [];

  if (hasPickupPoint) {
    markers.push(`lonlat:${pickupLongitude},${pickupLatitude};type:material;color:#ff6600;size:64;icon:location_on;icontype:material;contentcolor:#ffffff;whitecircle:no`);
  }

  if (hasDropPoint) {
    markers.push(`lonlat:${dropLongitude},${dropLatitude};type:material;color:#0f172a;size:64;icon:flag;icontype:material;contentcolor:#ffffff;whitecircle:no`);
  }

  // If route is large, encode it using polyline6 to avoid very long URLs which cause 400 errors
  const encodePolyline6 = (coords) => {
    // coords: array of [lon, lat]
    const precision = 1e6;
    let lastLat = 0;
    let lastLng = 0;
    let result = '';

    const encodeValue = (value) => {
      let v = value;
      v = v < 0 ? ~(v << 1) : v << 1;
      let chunks = '';
      while (v >= 0x20) {
        chunks += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
        v >>= 5;
      }
      chunks += String.fromCharCode(v + 63);
      return chunks;
    };

    for (let i = 0; i < coords.length; i++) {
      const [lon, lat] = coords[i];
      const latE5 = Math.round(lat * precision);
      const lngE5 = Math.round(lon * precision);
      const dLat = latE5 - lastLat;
      const dLng = lngE5 - lastLng;
      lastLat = latE5;
      lastLng = lngE5;
      result += encodeValue(dLat);
      result += encodeValue(dLng);
    }

    return result;
  };

  let routeGeometry = '';
  if (routeCoordinates.length > 1) {
    if (routeCoordinates.length > 40) {
      const encoded = encodePolyline6(routeCoordinates);
      routeGeometry = `polyline6:${encoded};linecolor:#2563eb;linewidth:5;linestyle:solid;lineopacity:0.9`;
    } else {
      routeGeometry = `polyline:${routeCoordinates.map(([lon, lat]) => `${lon},${lat}`).join(',')};linecolor:#2563eb;linewidth:5;linestyle:solid;lineopacity:0.9`;
    }
  } else if (hasPickupPoint && hasDropPoint) {
    routeGeometry = `polyline:${pickupLongitude},${pickupLatitude},${dropLongitude},${dropLatitude};linecolor:#2563eb;linewidth:5;linestyle:solid;lineopacity:0.9`;
  }

  const params = [
  `style=osm-liberty`,
    `width=${width}`,
    `height=${height}`,
    // don't force scaleFactor; mobile may fetch large images if scaleFactor is set
    `center=${encodeURIComponent(center)}`,
    `zoom=${zoom}`,
    markers.length ? `marker=${encodeURIComponent(markers.join('|'))}` : '',
    routeGeometry ? `geometry=${encodeURIComponent(routeGeometry)}` : '',
    `apiKey=${GEOAPIFY_STATIC_MAP_KEY}`,
  ].filter(Boolean);

  return `https://maps.geoapify.com/v1/staticmap?${params.join('&')}`;
};

const buildMapHtml = (pickupLat, pickupLng, dropLat, dropLng, agentLat, agentLng, routeCoordinates, apiKey) => {
  const pickup = pickupLat && pickupLng ? JSON.stringify([pickupLat, pickupLng]) : 'null';
  const drop = dropLat && dropLng ? JSON.stringify([dropLat, dropLng]) : 'null';
  const agent = agentLat && agentLng ? JSON.stringify([agentLat, agentLng]) : 'null';
  const route = JSON.stringify(routeCoordinates || []);

  return `
    <!doctype html>
    <html>
    <head>
      <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>html,body,#map{height:100%;margin:0;padding:0}</style>
    </head>
    <body>
      <div style="padding:20px;font-size:20px;">
        WebView Test
        <img
          src="https://tile.openstreetmap.org/0/0/0.png"
          width="256"
          height="256"
        />
      </div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const pickup = ${pickup};
        const drop = ${drop};
        const agent = ${agent};
        const routeCoords = ${route};
        const apiKey = '${apiKey}';

        const fallbackCenter = pickup || drop || agent || [20.5937, 78.9629];
        const map = L.map('map', {
          zoomControl: true,
          preferCanvas: true,
          zoomAnimation: true,
          fadeAnimation: true,
          markerZoomAnimation: true,
          inertia: true,
          inertiaDeceleration: 3000,
          worldCopyJump: true,
        }).setView(fallbackCenter, 15);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const markers = [];
        if (pickup) {
          const m = L.marker([pickup[0], pickup[1]], { title: 'Pickup' }).addTo(map);
          m.bindPopup('Pickup');
          markers.push(m);
        }
        if (drop) {
          const m2 = L.marker([drop[0], drop[1]], { title: 'Drop' }).addTo(map);
          m2.bindPopup('Drop');
          markers.push(m2);
        }
        if (agent) {
          const agentIcon = L.divIcon({
            className: 'agent-marker',
            html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 8px rgba(37,99,235,0.22);"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          const m3 = L.marker([agent[0], agent[1]], { icon: agentIcon, title: 'Agent' }).addTo(map);
          m3.bindPopup('Agent location');
          markers.push(m3);
        }

        const routePoints = Array.isArray(routeCoords) ? routeCoords.map(([lon, lat]) => [lat, lon]).filter((pt) => Array.isArray(pt) && pt.length === 2) : [];
        if (routePoints.length > 1) {
          const poly = L.polyline(routePoints, { color: '#2563eb', weight: 5, opacity: 0.9 }).addTo(map);
          map.fitBounds(poly.getBounds(), { padding: [36, 36] });
        } else if (markers.length) {
          const group = L.featureGroup(markers.map(m => m));
          map.fitBounds(group.getBounds(), { padding: [36, 36] });
        }
      </script>
    </body>
    </html>
  `;
};

// Debug: attempt to prefetch the static map and log status for troubleshooting
const prefetchStaticMap = async (url) => {
  try {
    console.log('[Track] Prefetching static map URL:', url);
    const res = await fetch(url, { method: 'GET' });
    console.log('[Track] Static map response status:', res.status);
    if (!res.ok) {
      try {
        const body = await res.text();
        console.warn('[Track] Static map error body:', body.slice ? body.slice(0, 2000) : body);
      } catch (e) {
        // ignore
      }
    }
    return res.status >= 200 && res.status < 300;
  } catch (err) {
    console.warn('[Track] Static map fetch failed:', err?.message || err);
    return false;
  }
};

// Use bookingSync helpers for consistent stage calculation
const getBookingStage = bookingSync.getBookingStage;
const isCompletedBooking = bookingSync.isCompletedBooking;
const buildTimeline = bookingSync.buildTimeline;

export default function TrackLuggage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [bookingId, setBookingId] = useState(params.bookingId ? String(params.bookingId) : '');
  const [booking, setBooking] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null);
  const [liveAgentLocation, setLiveAgentLocation] = useState(null);
  const [h3Status, setH3Status] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState(null);
  const [routeEtaMinutes, setRouteEtaMinutes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapImageLoading, setMapImageLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const isCompleted = useRef(false);

  const pollingRef = useRef(null);
  const lastPolledRef = useRef(0);

  const resolveTrackedBookingId = useCallback(async () => {
    if (params.bookingId) {
      const routeBookingId = String(params.bookingId);
      await bookingSync.setActiveTrackingBooking(routeBookingId);
      return routeBookingId;
    }

    const stored = await bookingSync.getActiveTrackingBooking();
    if (stored) return stored;

    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      const activeBooking = await bookingSync.fetchLatestActiveBooking(token);
      if (activeBooking?.id) {
        const activeId = String(activeBooking.id);
        await bookingSync.setActiveTrackingBooking(activeId);
        return activeId;
      }
    }

    return '';
  }, [params.bookingId]);

  // Simple direct polling - no complex callbacks
  const fetchBookingData = useCallback(async (targetBookingId) => {
    if (!targetBookingId) return;

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('[Track] No auth token found');
        return;
      }

      const url = `${API_BASE_URL}/api/bookings/${targetBookingId}?_t=${Date.now()}`;
      console.log('[Track] Fetching:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      console.log('[Track] Response status:', response.status);

      if (!response.ok) {
        console.warn('[Track] HTTP error:', response.status);
        return;
      }

      const data = await parseJsonResponse(response);
      console.log('[Track] API Response:', data);

      if (data.success && data.booking) {
        const currentBooking = data.booking;
        console.log('FULL BOOKING DATA:', JSON.stringify(currentBooking, null, 2));
        console.log('[Track] Booking update:', {
          id: currentBooking.id,
          status: currentBooking.status,
          assignment_status: currentBooking.assignment_status,
          stage: getBookingStage(currentBooking),
        });

        setBooking(currentBooking);
        setLastUpdated(new Date());

        const assignedAgentId = currentBooking?.resolved_agent_id || currentBooking?.assigned_agent_id;
        const stage = getBookingStage(currentBooking);

        let fetchedAgent = buildAgentFromBooking(currentBooking);

        if (assignedAgentId && stage >= 2) {
          try {
            const agentRes = await fetch(`${API_BASE_URL}/api/bookings/agent-profile/${targetBookingId}?_t=${Date.now()}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const agentData = await parseJsonResponse(agentRes);
            if (agentData.success && agentData.agent) {
              fetchedAgent = {
                ...(fetchedAgent || {}),
                ...agentData.agent,
                name: agentData.agent.name || fetchedAgent?.name,
                phone: agentData.agent.phone || fetchedAgent?.phone,
              };
            }
          } catch (err) {
            console.warn('[Track] Failed to fetch agent:', err?.message);
          }
        }

        if (fetchedAgent) {
          setAgentProfile(fetchedAgent);
          const embeddedLocation = bookingSync.getLiveAgentLocation(fetchedAgent);
          if (embeddedLocation) {
            setLiveAgentLocation(embeddedLocation);
          }
        }

        try {
          const h3Res = await fetch(`${API_BASE_URL}/api/agents/h3-status/${targetBookingId}?_t=${Date.now()}`);
          const h3Data = await h3Res.json();
          if (h3Data.success) {
            setH3Status(h3Data);
          }
        } catch (_h3Err) {
          // optional
        }

        const pickupLat = toFiniteNumber(currentBooking?.pickup_latitude);
        const pickupLng = toFiniteNumber(currentBooking?.pickup_longitude);
        const dropLat = toFiniteNumber(currentBooking?.drop_latitude);
        const dropLng = toFiniteNumber(currentBooking?.drop_longitude);
        const pickupPoint = pickupLat !== null && pickupLng !== null ? { latitude: pickupLat, longitude: pickupLng } : null;
        const dropPoint = dropLat !== null && dropLng !== null ? { latitude: dropLat, longitude: dropLng } : null;

        const activeTarget = stage >= 4 ? dropPoint : pickupPoint;
        const agentLocation = bookingSync.getLiveAgentLocation(fetchedAgent || {}) || liveAgentLocation;

        let nextRouteCoords = [];
        let nextDistanceKm = null;
        let nextEtaMinutes = null;

        // Full pickup → drop by-road route on map whenever both points exist
        if (pickupPoint && dropPoint) {
          const mapRoute = await fetchDrivingRoute(pickupPoint, dropPoint);
          if (mapRoute?.coordinates?.length > 1) {
            nextRouteCoords = mapRoute.coordinates;
            if (stage >= 4) {
              nextDistanceKm = mapRoute.distanceKm;
              nextEtaMinutes = mapRoute.durationMinutes;
            }
          } else {
            nextRouteCoords = [
              [pickupPoint.longitude, pickupPoint.latitude],
              [dropPoint.longitude, dropPoint.latitude],
            ];
          }
        }

        // Live ETA/distance from agent to current target
        const routeOrigin = agentLocation || (stage >= 4 ? pickupPoint : null);
        if (routeOrigin && activeTarget && agentLocation && stage >= 2 && stage < 5) {
          const liveRoute = await fetchDrivingRoute(routeOrigin, activeTarget);
          if (liveRoute) {
            nextDistanceKm = liveRoute.distanceKm ?? nextDistanceKm;
            nextEtaMinutes = liveRoute.durationMinutes ?? nextEtaMinutes;
            if (stage < 4 && liveRoute.coordinates?.length > 1) {
              nextRouteCoords = liveRoute.coordinates;
            }
          } else if (routeOrigin && activeTarget) {
            nextDistanceKm = nextDistanceKm ?? haversineKm(
              routeOrigin.latitude,
              routeOrigin.longitude,
              activeTarget.latitude,
              activeTarget.longitude,
            );
            nextEtaMinutes = nextEtaMinutes ?? estimateEtaMinutes(routeOrigin, activeTarget);
          }
        }

        setRouteCoordinates(nextRouteCoords);
        setRouteDistanceKm(nextDistanceKm);
        setRouteEtaMinutes(nextEtaMinutes);
      } else {
        console.warn('[Track] API returned success=false');
      }
    } catch (error) {
      console.error('[Track] Fetch error:', error?.message || error);
    }
  }, []);

  const loadTrackingData = useCallback(async (targetBookingId, silent = false) => {
    console.log('[Track] loadTrackingData called:', { targetBookingId, silent });

    if (!targetBookingId) {
      setBooking(null);
      setAssignment(null);
      setAgentProfile(null);
      setLiveAgentLocation(null);
      setH3Status(null);
      setRouteCoordinates([]);
      if (!silent) setLoading(false);

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        console.log('[Track] Polling stopped');
      }
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    // Initial fetch
    await fetchBookingData(targetBookingId);

    // Start polling every 3 seconds
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    console.log('[Track] Starting polling for booking:', targetBookingId);
    let pollCount = 0;

    pollingRef.current = setInterval(async () => {
      pollCount++;
      const now = Date.now();
      
      // Log every poll
      if (pollCount % 5 === 0) {
        console.log(`[Track] Poll #${pollCount} at ${new Date().toLocaleTimeString()}`);
      }

      await fetchBookingData(targetBookingId);
    }, 10000);

    setLoading(false);
  }, [fetchBookingData]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const bootstrap = async () => {
        const trackedId = await resolveTrackedBookingId();
        if (!isActive) return;
        setBookingId(trackedId);
        if (trackedId) {
          await loadTrackingData(trackedId);
          // Polling is now handled by loadTrackingData via bookingSync
        } else {
          // No booking selected - show empty state
          setBooking(null);
          setAssignment(null);
          setAgentProfile(null);
          setH3Status(null);
          setLoading(false);
          
          // Stop polling if active
          if (pollingRef.current) {
            bookingSync.stopBookingPolling(pollingRef.current);
            pollingRef.current = null;
          }
        }
      };

      bootstrap();

      return () => {
        isActive = false;
        // Clean up polling when screen loses focus
        if (pollingRef.current) {
          bookingSync.stopBookingPolling(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }, [loadTrackingData, resolveTrackedBookingId])
  );

  useEffect(() => {
    if (params.bookingId) {
      setBookingId(String(params.bookingId));
    }
  }, [params.bookingId]);

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        bookingSync.stopBookingPolling(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const trackingBooking = booking || {};
  const completed = isCompletedBooking(booking);
  // Update ref so polling logic can read it
  isCompleted.current = completed;
  const timeline = useMemo(() => buildTimeline(trackingBooking), [trackingBooking]);
  const stage = getBookingStage(trackingBooking);
  const assignedAgentId = booking?.resolved_agent_id || booking?.assigned_agent_id || booking?.assignedAgentId || h3Status?.stored?.assignedAgentId || assignment?.session?.agent?.agentId || null;
  const assignedAgent = agentProfile || assignment?.session?.agent || null;
  const pickupLatitude = toFiniteNumber(trackingBooking?.pickup_latitude || trackingBooking?.pickupLatitude);
  const pickupLongitude = toFiniteNumber(trackingBooking?.pickup_longitude || trackingBooking?.pickupLongitude);
  const dropLatitude = toFiniteNumber(trackingBooking?.drop_latitude || trackingBooking?.dropLatitude);
  const dropLongitude = toFiniteNumber(trackingBooking?.drop_longitude || trackingBooking?.dropLongitude);
  const activeTarget = stage >= 4
    ? {
        latitude: dropLatitude,
        longitude: dropLongitude,
        label: 'Airport',
      }
    : {
        latitude: pickupLatitude,
        longitude: pickupLongitude,
        label: 'You',
      };
  const liveDistanceText = routeDistanceKm !== null
    ? `${routeDistanceKm.toFixed(1)} km away`
    : h3Status?.computed?.distanceKm != null
      ? `${Number(h3Status.computed.distanceKm).toFixed(1)} km away`
      : liveAgentLocation && activeTarget
        ? `${haversineKm(liveAgentLocation.latitude, liveAgentLocation.longitude, activeTarget.latitude, activeTarget.longitude).toFixed(1)} km away`
        : pickupLatitude !== null && dropLatitude !== null
          ? `${haversineKm(pickupLatitude, pickupLongitude, dropLatitude, dropLongitude).toFixed(1)} km away`
          : '--';
  const mapPhaseText = stage >= 4 ? 'Agent to airport' : stage >= 2 ? 'Agent to you' : 'Map available after driver assignment';

  // Fix 4: Driver details only when stage >= 2 (agent assigned)
  const driverName = stage >= 2
    ? (
      String(assignedAgent?.name || trackingBooking?.agent_name || '').trim() ||
      (assignedAgentId ? `Agent #${assignedAgentId}` : 'Driver details loading...')
    )
    : 'No driver assigned';
  const driverPhone = stage >= 2 ? (assignedAgent?.phone || trackingBooking?.agent_phone || assignment?.session?.agent?.phone || '') : '';
  const vehicleNumber = stage >= 2
    ? (assignedAgent?.vehicleNumber || assignedAgent?.vehicleType || trackingBooking?.agent_vehicle_type || trackingBooking?.vehicle_number || trackingBooking?.vehicle_type || 'Vehicle pending')
    : 'Waiting for agent acceptance';
  const driverStatus = stage >= 5 ? 'Completed' : stage >= 4 ? 'On The Way' : stage >= 3 ? 'In Progress' : stage >= 2 ? 'Agent Assigned' : stage >= 1 ? 'Pending' : 'No booking';
  const etaText = formatEta(
    routeEtaMinutes ||
    h3Status?.computed?.travelEtaMinutes ||
    trackingBooking?.agent_eta_minutes ||
    trackingBooking?.eta_minutes
  );
  const hasPickupPoint = pickupLatitude !== null && pickupLongitude !== null;
  const hasDropPoint = dropLatitude !== null && dropLongitude !== null;
  const centerLatitude = hasPickupPoint && hasDropPoint
    ? (pickupLatitude + dropLatitude) / 2
    : hasPickupPoint
      ? pickupLatitude
      : hasDropPoint
        ? dropLatitude
        : DEFAULT_REGION.latitude;
  const centerLongitude = hasPickupPoint && hasDropPoint
    ? (pickupLongitude + dropLongitude) / 2
    : hasPickupPoint
      ? pickupLongitude
      : hasDropPoint
        ? dropLongitude
        : DEFAULT_REGION.longitude;
  const staticMapUrl = useMemo(() => buildGeoapifyStaticMapUrl({
    centerLatitude,
    centerLongitude,
    pickupLatitude,
    pickupLongitude,
    dropLatitude,
    dropLongitude,
    routeCoordinates,
    hasPickupPoint,
    hasDropPoint,
  }), [centerLatitude, centerLongitude, dropLatitude, dropLongitude, hasDropPoint, hasPickupPoint, pickupLatitude, pickupLongitude, routeCoordinates]);

  const buildMapHtml = (pickupLat, pickupLng, dropLat, dropLng, agentLat, agentLng, routeCoordinates, apiKey) => {
  const pickup = pickupLat && pickupLng ? JSON.stringify([pickupLat, pickupLng]) : 'null';
  const drop = dropLat && dropLng ? JSON.stringify([dropLat, dropLng]) : 'null';
  const agent = agentLat && agentLng ? JSON.stringify([agentLat, agentLng]) : 'null';
  const route = JSON.stringify(routeCoordinates || []);

  return `
    <!doctype html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; backgroundColor: #f8fafc; }
        .agent-marker-ping {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #2563eb;
          border: 3px solid #fff;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.3);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const pickup = ${pickup};
        const drop = ${drop};
        const agent = ${agent};
        const routeCoords = ${route};
        const apiKey = '${apiKey}';

        const fallbackCenter = pickup || drop || agent || [20.5937, 78.9629];
        
        // Critical Fix: Initialize map using Canvas driver for fluid zooming vectors
        const map = L.map('map', {
          zoomControl: false,
          preferCanvas: true,
          zoomSnap: 0.5,
          zoomDelta: 0.5,
          wheelDebounceTime: 40
        }).setView(fallbackCenter, 14);

        // Fetch official high-res crisp tiles from Geoapify matching your static map style
        L.tileLayer('https://maps.geoapify.com/v1/tile/osm-liberty/{z}/{x}/{y}.png?apiKey=' + apiKey, {
          attribution: '© OpenStreetMap contributors | Geoapify',
          maxZoom: 20,
          maxNativeZoom: 19,
          detectRetina: true // Forces high-DPI crisp graphics on retina screens
        }).addTo(map);

        const markers = [];
        if (pickup) {
          const m = L.marker([pickup[0], pickup[1]]).addTo(map).bindPopup('<b>Pickup Point</b>');
          markers.push(m);
        }
        if (drop) {
          const m2 = L.marker([drop[0], drop[1]]).addTo(map).bindPopup('<b>Drop Destination</b>');
          markers.push(m2);
        }
        if (agent) {
          const agentIcon = L.divIcon({
            className: 'custom-agent-wrapper',
            html: '<div class="agent-marker-ping"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          const m3 = L.marker([agent[0], agent[1]], { icon: agentIcon }).addTo(map).bindPopup('<b>Driver Status</b>');
          markers.push(m3);
        }

        // Project route geometry cleanly
        const routePoints = Array.isArray(routeCoords)
          ? routeCoords.map((pt) => (Array.isArray(pt) && pt.length >= 2 ? [pt[1], pt[0]] : null)).filter(Boolean)
          : [];
        if (routePoints.length > 1) {
          const poly = L.polyline(routePoints, { 
            color: '#2563eb', 
            weight: 5, 
            opacity: 0.85,
            lineJoin: 'round'
          }).addTo(map);
          map.fitBounds(poly.getBounds(), { padding: [40, 40], animate: false });
        } else if (pickup && drop) {
          const fallbackLine = L.polyline([[pickup[0], pickup[1]], [drop[0], drop[1]]], {
            color: '#2563eb',
            weight: 5,
            opacity: 0.85,
            dashArray: '8 8',
            lineJoin: 'round'
          }).addTo(map);
          map.fitBounds(fallbackLine.getBounds(), { padding: [40, 40], animate: false });
        } else if (markers.length) {
          const group = L.featureGroup(markers);
          map.fitBounds(group.getBounds(), { padding: [40, 40], animate: false });
        }
      </script>
    </body>
    </html>
  `;
};

  useEffect(() => {
    setMapImageLoading(true);
    const timeoutId = setTimeout(() => {
      setMapImageLoading(false);
    }, 7000);

    return () => clearTimeout(timeoutId);
  }, [staticMapUrl]);

  useEffect(() => {
    // Log the static map URL and try a lightweight prefetch to detect failures.
    if (!staticMapUrl) return;
    (async () => {
      const ok = await prefetchStaticMap(staticMapUrl);
      if (!ok) {
        // if prefetch failed, ensure we clear loading state so UI isn't blocked
        setMapImageLoading(false);
      }
    })();
  }, [staticMapUrl]);

  const mapSubtitle = trackingBooking?.pickup_address
    ? `${trackingBooking.pickup_address}${trackingBooking.drop_address ? ` • ${trackingBooking.drop_address}` : ''}`
    : bookingId
      ? 'Tracking your latest active booking'
      : 'No active booking yet';

  const handleCallDriver = useCallback(() => {
    const phone = normalizePhoneForTel(driverPhone);
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  }, [driverPhone]);

  // Fix 1 & 5: Show empty state or completed state
  if (!loading && !bookingId && !booking) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient
          colors={['#ff0033', '#ff6600']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.headerContainer, { paddingTop: Platform.OS === 'ios' ? 60 : 50 }]}
        >
          <Text style={styles.headerTitle}>Track Luggage</Text>
          <Text style={styles.headerSubtitle}>Real-time tracking of your pickup</Text>
        </LinearGradient>

        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateIconCircle}>
            <Ionicons name="location-outline" size={56} color="#cbd5e1" />
          </View>
          <Text style={styles.emptyStateTitle}>No active tracking</Text>
          <Text style={styles.emptyStateSubtitle}>Track your current booking here</Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/bookings')}
          >
            <Ionicons name="list" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.emptyStateButtonText}>Go to Bookings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* HEADER BAR */}
      <LinearGradient
        colors={['#ff0033', '#ff6600']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.headerContainer, { paddingTop: Platform.OS === 'ios' ? 60 : 50 }]}
      >
        <Text style={styles.headerTitle}>Track Luggage</Text>
        <Text style={styles.headerSubtitle}>{bookingId ? mapSubtitle : 'Real-time tracking of your pickup'}</Text>
      </LinearGradient>

      {/* MAIN SCROLLABLE CONTENT */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Fix 5: Completed booking banner */}
        {completed ? (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
            <Text style={styles.completedBannerText}>This booking has been completed</Text>
          </View>
        ) : null}

        {/* Fix 4: MAP — only show when stage >= 2 (agent assigned) */}
        <View style={styles.mapCardFrame}>
          {stage >= 2 && (hasPickupPoint || hasDropPoint) ? (
            <WebView
              key={`map-${bookingId}-${routeCoordinates.length}-${pickupLatitude}-${dropLatitude}-${liveAgentLocation?.latitude || 'na'}`}
              originWhitelist={['*']}
              mixedContentMode="always"
              source={{
                html: buildMapHtml(
                  pickupLatitude,
                  pickupLongitude,
                  dropLatitude,
                  dropLongitude,
                  liveAgentLocation?.latitude,
                  liveAgentLocation?.longitude,
                  routeCoordinates,
                  GEOAPIFY_STATIC_MAP_KEY
                )
              }}
              style={styles.mapInternalFill}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              androidHardwareAccelerationDisabled={false}
              cacheEnabled={true}
              scalesPageToFit={false}
              nestedScrollEnabled={true}
              allowsInlineMediaPlayback
            />
          ) : stage >= 2 ? (
            <Image
              source={{ uri: staticMapUrl }}
              style={styles.mapInternalFill}
              resizeMode="cover"
              onLoadEnd={() => setMapImageLoading(false)}
              onError={() => setMapImageLoading(false)}
            />
          ) : null}

          {stage >= 2 && mapImageLoading ? (
            <View style={styles.mapLoadingOverlay}>
              <View style={styles.mapLoadingCard}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.mapLoadingText}>Loading live route...</Text>
              </View>
            </View>
          ) : null}

          <View pointerEvents="none" style={styles.mapOverlayLayer}>
            {stage >= 2 ? (
              <TouchableOpacity style={styles.mapTargetPill} activeOpacity={0.8}>
                <Ionicons name="navigate" size={20} color="#dc2626" />
              </TouchableOpacity>
            ) : null}

            <View style={styles.mapStatusPill}>
              <Text style={styles.mapStatusPillText}>
                {mapPhaseText}
              </Text>
            </View>

            {stage < 2 ? (
              <View style={styles.mapMarkerClusterCenter}>
                <View style={styles.markerPulseEffectRing}>
                  <Ionicons name="location" size={44} color="#2563eb" />
                </View>
                <Text style={styles.liveMapHeadlineText}>Waiting for driver</Text>
                <Text style={styles.liveMapMetaText}>
                  Map will appear once a driver has been assigned to your booking
                </Text>
              </View>
            ) : null}

            {stage >= 2 && hasPickupPoint && hasDropPoint ? (
              <View style={styles.routeSummaryChip}>
                <Ionicons name="trail-sign" size={14} color="#0f172a" />
                <Text style={styles.routeSummaryText}>Route from source to destination</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* DRIVER IDENTIFICATION CARD */}
        <View style={styles.driverMetricsContainerCard}>
          <View style={styles.driverTopRowMeta}>
            <Text style={styles.driverSectionHeader}>Driver Details</Text>
            <View style={styles.statusBadgeCapsule}>
              <Text style={styles.statusBadgeText}>{driverStatus}</Text>
            </View>
          </View>

          <View style={styles.driverIdentityProfileLine}>
            <View style={styles.avatarCircularBadge}>
              <Ionicons name="person" size={26} color="#ffffff" />
            </View>
            <View style={styles.driverIdentityTextStack}>
              <Text style={styles.driverNameText}>{driverName}</Text>
              <Text style={styles.driverLicensePlateText}>{vehicleNumber}</Text>
            </View>
            {/* Fix 4: Only show call button when driver is assigned */}
            {stage >= 2 && driverPhone ? (
              <TouchableOpacity style={styles.telephonyIconButton} activeOpacity={0.8} onPress={handleCallDriver}>
                <Ionicons name="call" size={18} color="#16a34a" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.telephonyIconButton, { opacity: 0.3 }]}>
                <Ionicons name="call" size={18} color="#94a3b8" />
              </View>
            )}
          </View>

          {/* Fix 4: Only show ETA row when driver is assigned */}
          {stage >= 2 ? (
            <View style={styles.driverEtaDataGridRow}>
              <View style={styles.etaDataBlockFrame}>
                <View style={styles.etaIconRowAnchor}>
                  <Ionicons name="time-outline" size={16} color="#4b5563" style={{ marginRight: 6 }} />
                  <Text style={styles.etaGridLabel}>ETA</Text>
                </View>
                <Text style={styles.etaGridValueText}>{etaText}</Text>
              </View>

              <View style={[styles.etaDataBlockFrame, { borderLeftWidth: 1, borderColor: '#f3f4f6', paddingLeft: 16 }]}>
                <View style={styles.etaIconRowAnchor}>
                  <Ionicons name="location-outline" size={16} color="#4b5563" style={{ marginRight: 6 }} />
                  <Text style={styles.etaGridLabel}>Distance</Text>
                </View>
                <Text style={styles.etaGridValueText} numberOfLines={2}>
                  {liveDistanceText}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* PROGRESS GRAPH TIMELINE NODES */}
        <View style={styles.trackingProgressTimelineCard}>
          <Text style={styles.timelineSectionHeader}>Tracking Progress</Text>

          {timeline.map((node, index) => {
            const isLast = index === timeline.length - 1;
            const isActive = node.active;
            return (
              <View key={node.title} style={[styles.timelineNodeBlockRow, isLast ? { marginBottom: 0 } : null]}>
                <View style={styles.timelineLeftTrackIndicatorCol}>
                  <View style={isActive ? styles.activeCoreTerminalNodeCircle : styles.inactiveCoreTerminalNodeCircle} />
                  {!isLast ? (
                    <View style={isActive && timeline[index + 1]?.active ? styles.activeVerticalLineSegment : styles.inactiveVerticalLineSegment} />
                  ) : null}
                </View>
                <View style={styles.timelineContentDataBlock}>
                  <Text style={[styles.timelineNodeTitleText, !isActive && styles.dimmedTimelineText]}>{node.title}</Text>
                  <Text style={[styles.timelineNodeTimestampText, !isActive && styles.dimmedTimelineText]}>{node.timestamp}</Text>
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    paddingHorizontal: 34,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  mapCardFrame: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.57,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    overflow: 'hidden',
    marginBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 22,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  mapInternalFill: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  mapLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  mapLoadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  mapOverlayLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  mapTargetPill: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  mapStatusPill: {
    position: 'absolute',
    top: 18,
    left: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  mapStatusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  mapMarkerClusterCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  markerPulseEffectRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  liveMapHeadlineText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  liveMapMetaText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  routeSummaryChip: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  routeSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  driverMetricsContainerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  driverTopRowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverSectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  statusBadgeCapsule: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  driverIdentityProfileLine: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 16,
    marginBottom: 16,
  },
  avatarCircularBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ff4d00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  driverIdentityTextStack: {
    flex: 1,
  },
  driverNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  driverLicensePlateText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  telephonyIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverEtaDataGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaDataBlockFrame: {
    flex: 1,
  },
  etaIconRowAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  etaGridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  etaGridValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 18,
  },
  trackingProgressTimelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineSectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
  },
  timelineNodeBlockRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineLeftTrackIndicatorCol: {
    alignItems: 'center',
    width: 24,
    marginRight: 14,
  },
  activeCoreTerminalNodeCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00cc66',
    borderWidth: 3,
    borderColor: '#ffffff',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#00cc66',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  inactiveCoreTerminalNodeCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    zIndex: 2,
  },
  activeVerticalLineSegment: {
    width: 2,
    flex: 1,
    backgroundColor: '#00cc66',
    marginTop: -2,
    marginBottom: -4,
  },
  inactiveVerticalLineSegment: {
    width: 2,
    flex: 1,
    backgroundColor: '#cbd5e1',
    marginTop: -2,
    marginBottom: -4,
  },
  timelineContentDataBlock: {
    flex: 1,
    paddingBottom: 22,
  },
  timelineNodeTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  timelineNodeTimestampText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '500',
  },
  dimmedTimelineText: {
    color: '#94a3b8',
  },
  // Empty state styles
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 28,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff6600',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#ff6600',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Completed booking banner
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  completedBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
    flex: 1,
  },
});