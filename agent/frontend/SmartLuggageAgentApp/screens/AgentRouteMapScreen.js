import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandGradient, BRAND_ORANGE } from '../constants/colors';
import { USER_API_URL } from '../config';
import AgentMapView from '../components/AgentMapView';
import { normalizeLatLng } from '../utils/locationUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_CITY_SPEED_KMPH = 28;
const LOCATION_REFRESH_MS = 12000;

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

const buildInitialRegion = (agentLocation, customerLocation) => {
  const points = [agentLocation, customerLocation].filter(Boolean);
  if (!points.length) {
    return { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  }
  if (points.length === 1) {
    return {
      latitude: points[0].latitude,
      longitude: points[0].longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.012, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.012, (maxLng - minLng) * 1.6),
  };
};

const buildTaskFromRequest = (request) => ({
  id: request?.sessionId ? `session-${request.sessionId}` : `request-${request?.queueId || Date.now()}`,
  sessionId: request?.sessionId || null,
  bookingId: request?.bookingId || request?.booking_id || null,
  agentName: request?.agentName || 'Agent',
  agentId: request?.agentId || null,
  type: 'Pickup',
  pickupLocation: request?.pickupAddress || 'Pickup location pending',
  dropLocation: request?.dropAddress || 'Drop location pending',
  timeSlot: request?.pickupTime || 'Time slot pending',
  luggage: Number(request?.bagCount || 1),
  status: 'in-progress',
  phoneNumber: request?.phone || '',
  customerName: request?.name || 'Customer',
  customerPhone: request?.phone || '',
  pickupLatitude: request?.pickupLatitude || null,
  pickupLongitude: request?.pickupLongitude || null,
  photos: request?.photos || null,
});

export default function AgentRouteMapScreen({ navigation, route }) {
  const request = route?.params?.request || {};
  
  // Extract a strictly numeric booking ID
  const bookingIdFromParams = (() => {
    const rawVal = route?.params?.bookingId || request?.bookingId || request?.booking_id || request?.id || null;
    if (!rawVal) return null;
    if (typeof rawVal === 'number' && Number.isInteger(rawVal)) return rawVal;
    const str = String(rawVal);
    if (str.includes('session') || str.includes('request')) {
      const taskVal = route?.params?.task?.bookingId || route?.params?.task?.booking_id || request?.bookingId || request?.booking_id;
      if (taskVal && !isNaN(Number(taskVal))) return Number(taskVal);
      return null;
    }
    const num = Number(str);
    return isNaN(num) ? null : num;
  })();

  const [customerFromServer, setCustomerFromServer] = useState(null);
  const [loadingCustomer, setLoadingCustomer] = useState(Boolean(bookingIdFromParams));

  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!bookingIdFromParams) {
      setLoadingCustomer(false);
      return undefined;
    }

    const loadCustomer = async () => {
      setLoadingCustomer(true);
      try {
        const url = `${USER_API_URL}/api/bookings/agent-details/${bookingIdFromParams}`;
        const resp = await fetch(url);
        const data = await resp.json().catch(() => ({}));
        if (!cancelled && resp.ok && data?.customer) {
          setCustomerFromServer(data.customer);
        }
      } catch (_e) {
        // fallback to navigation params
      } finally {
        if (!cancelled) setLoadingCustomer(false);
      }
    };

    loadCustomer();
    return () => { cancelled = true; };
  }, [bookingIdFromParams]);

  const customerName =
    customerFromServer?.name ||
    request?.name ||
    request?.userName ||
    'Customer';

  const customerPhone =
    customerFromServer?.phone ||
    request?.phone ||
    request?.userPhone ||
    '';

  const customerLocation = useMemo(() => {
    const rawLat =
      customerFromServer?.pickupLatitude ??
      request?.pickupLatitude;
    const rawLng =
      customerFromServer?.pickupLongitude ??
      request?.pickupLongitude;
    const normalized = normalizeLatLng(rawLat, rawLng);
    if (!Number.isFinite(normalized.latitude)) return null;
    return normalized;
  }, [
    customerFromServer?.pickupLatitude,
    customerFromServer?.pickupLongitude,
    request?.pickupLatitude,
    request?.pickupLongitude,
  ]);

  const [agentLocation, setAgentLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distanceKm, setDistanceKm] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState('');

  const loadAgentLocation = async () => {
    try {
      const permissionResult = await Location.requestForegroundPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        setRouteError('Location permission denied. Enable GPS for live ETA.');
        return;
      }
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setAgentLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
    } catch (_error) {
      setRouteError('Unable to get your current location.');
    } finally {
      setLoadingLocation(false);
    }
  };

  useEffect(() => {
    loadAgentLocation();
    const timer = setInterval(loadAgentLocation, LOCATION_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadShortestRoute = async () => {
      if (!agentLocation || !customerLocation) return;

      setLoadingRoute(true);
      setRouteError('');

      try {
        const routeUrl =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${agentLocation.longitude},${agentLocation.latitude};` +
          `${customerLocation.longitude},${customerLocation.latitude}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(routeUrl);
        const data = await response.json();
        if (cancelled) return;

        const bestRoute = data?.routes?.[0];
        if (!response.ok || !bestRoute?.geometry?.coordinates?.length) {
          throw new Error('No route found');
        }

        const decodedPath = bestRoute.geometry.coordinates.map((coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));

        setRouteCoordinates(decodedPath);
        setDistanceKm(Number((bestRoute.distance / 1000).toFixed(1)));
        setEtaMinutes(Math.max(1, Math.ceil(bestRoute.duration / 60)));
      } catch (_error) {
        const straightDistance = haversineKm(
          agentLocation.latitude,
          agentLocation.longitude,
          customerLocation.latitude,
          customerLocation.longitude,
        );
        if (!cancelled) {
          setRouteCoordinates([agentLocation, customerLocation]);
          setDistanceKm(Number(straightDistance.toFixed(1)));
          setEtaMinutes(Math.max(1, Math.ceil((straightDistance / DEFAULT_CITY_SPEED_KMPH) * 60)));
          setRouteError('Live route unavailable. Showing direct path.');
        }
      } finally {
        if (!cancelled) setLoadingRoute(false);
      }
    };

    loadShortestRoute();
    return () => { cancelled = true; };
  }, [agentLocation, customerLocation]);

  const initialRegion = useMemo(
    () => buildInitialRegion(agentLocation, customerLocation),
    [agentLocation, customerLocation],
  );

  const etaRangeText = useMemo(() => {
    if (!Number.isFinite(etaMinutes)) return '--';
    const low = Math.max(1, etaMinutes - 1);
    const high = etaMinutes + 1;
    return `${low}-${high} min`;
  }, [etaMinutes]);

  const mapEtaLabel = Number.isFinite(etaMinutes) ? `ETA ${etaMinutes} MIN` : 'ETA --';

  const fitMapToRoute = () => {
    if (!mapRef.current?.fitToCoordinates || !agentLocation || !customerLocation) return;
    mapRef.current.fitToCoordinates(
      routeCoordinates.length >= 2 ? routeCoordinates : [agentLocation, customerLocation],
      {
        edgePadding: { top: 80, right: 48, bottom: 280, left: 48 },
        animated: true,
      },
    );
  };

  const handleCall = async () => {
    const phone = String(customerPhone || '').trim();
    if (!phone) {
      Alert.alert('Call', 'Customer phone number is not available.');
      return;
    }
    const telUrl = `tel:${phone.replace(/\s+/g, '')}`;
    const canOpen = await Linking.canOpenURL(telUrl);
    if (!canOpen) {
      Alert.alert('Call', 'Phone call is not supported on this device.');
      return;
    }
    Linking.openURL(telUrl);
  };

  const handleMessage = async () => {
    const phone = String(customerPhone || '').trim();
    if (!phone) {
      Alert.alert('Message', 'Customer phone number is not available.');
      return;
    }
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const whatsappUrl = `https://wa.me/${cleanPhone}`;
    Linking.openURL(whatsappUrl).catch(() => {
      Alert.alert('Message', 'WhatsApp is not installed on this device.');
    });
  };

  const handleArrived = async () => {
    try {
      const resp = await fetch(`${USER_API_URL}/api/agents/arrived`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: request?.sessionId || null,
          bookingId: bookingIdFromParams,
          agentId: request?.agentId || null,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.message || `Update failed (${resp.status})`);
      }
      navigation.reset({
        index: 0,
        routes: [{
          name: 'TaskDetails',
          params: {
            task: buildTaskFromRequest({
              ...request,
              ...customerFromServer,
              bookingId: bookingIdFromParams,
              sessionId: request?.sessionId,
            }),
          },
        }],
      });
    } catch (e) {
      Alert.alert('Arrived', e?.message || 'Failed to mark arrival.');
    }
  };

  const hasValidDestination = Boolean(customerLocation);
  const isBusy = loadingLocation || loadingRoute || loadingCustomer;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {!hasValidDestination ? (
          <View style={styles.centerState}>
            <Text style={styles.centerStateTitle}>Pickup location missing</Text>
            <Text style={styles.centerStateText}>This booking has no customer coordinates yet.</Text>
          </View>
        ) : (
          <AgentMapView
            mapRef={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            agentLocation={agentLocation}
            customerLocation={customerLocation}
            routeCoordinates={routeCoordinates}
            etaMinutes={etaMinutes}
          />
        )}

        <TouchableOpacity style={styles.recenterBtn} onPress={fitMapToRoute}>
          <Ionicons name="navigate" size={20} color="#111827" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>

        <View style={styles.bottomSheet}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Customer Details</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>In Progress</Text>
            </View>
          </View>

          <View style={styles.customerProfileRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerNameText}>{customerName}</Text>
              <Text style={styles.customerMetaText}>{request?.bagCount || customerFromServer?.bag_count || 1} bags</Text>
            </View>
            <View style={styles.actionButtonsGroup}>
              <TouchableOpacity style={styles.phoneCallBtn} onPress={handleCall} activeOpacity={0.8}>
                <Ionicons name="call" size={20} color="#1E293B" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.phoneCallBtn} onPress={handleMessage} activeOpacity={0.8}>
                <Ionicons name="chatbubbles-outline" size={20} color="#1E293B" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statColLabel}>ETA</Text>
              <Text style={styles.statColValue}>{isBusy ? '...' : (etaMinutes ? `${etaMinutes} mins` : '--')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statColLabel}>DISTANCE</Text>
              <Text style={styles.statColValue}>{isBusy ? '...' : (distanceKm ? `${distanceKm} km` : '--')}</Text>
            </View>
          </View>

          {routeError ? <Text style={styles.routeWarn}>{routeError}</Text> : null}

          <TouchableOpacity style={styles.primaryActionBtn} onPress={handleArrived} activeOpacity={0.9}>
            <LinearGradient colors={BrandGradient} style={styles.primaryActionGradient}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryActionText}>ARRIVED / START TASK</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {isBusy ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={BRAND_ORANGE} />
            <Text style={styles.loadingText}>Calculating route & ETA...</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  map: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: 300,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  bottomSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  statusBadge: {
    backgroundColor: '#E8FFF2',
    borderColor: '#D1FAE5',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  customerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  actionButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF6600',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  customerMetaText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '600',
  },
  phoneCallBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 14,
    marginBottom: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statColLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statColValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  primaryActionBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryActionGradient: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  routeWarn: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 4,
    marginBottom: 4,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  centerStateText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 25,
  },
  loadingText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
});
