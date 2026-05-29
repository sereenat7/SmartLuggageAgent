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
  bookingId: request?.bookingId || null,
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
});

export default function AgentRouteMapScreen({ navigation, route }) {
  const request = route?.params?.request || {};
  const bookingIdFromParams =
    route?.params?.bookingId ||
    request?.bookingId ||
    null;

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
    const smsUrl = `sms:${phone.replace(/\s+/g, '')}`;
    const canOpen = await Linking.canOpenURL(smsUrl);
    if (!canOpen) {
      Alert.alert('Message', 'Messaging is not supported on this device.');
      return;
    }
    Linking.openURL(smsUrl);
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
              bookingId: bookingIdFromParams,
              sessionId: request?.sessionId,
            }),
            bookingId: bookingIdFromParams,
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

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack && navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Dashboard', { activeTab: 'In Progress', refreshInbox: true });
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>

        <View style={styles.bottomSheet}>
          <LinearGradient colors={BrandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sheetHeader}>
            <Text style={styles.sheetHeaderText}>AGENT IS EN ROUTE</Text>
          </LinearGradient>

          <View style={styles.sheetBody}>
            <Text style={styles.etaTitle}>
              Estimated Arrival: {isBusy ? '...' : etaRangeText}
            </Text>

            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color="#94A3B8" />
              <Text style={styles.infoText}>Customer: {customerName}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color="#94A3B8" />
              <Text style={styles.infoText}>
                Customer Contact: {customerPhone || 'Not available'}
              </Text>
            </View>

            {routeError ? <Text style={styles.routeWarn}>{routeError}</Text> : null}
            {distanceKm !== null ? (
              <Text style={styles.distanceMeta}>{distanceKm} km • {mapEtaLabel}</Text>
            ) : null}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionTouch} onPress={handleCall} activeOpacity={0.88}>
                <LinearGradient colors={BrandGradient} style={styles.actionBtn}>
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>CALL CUSTOMER</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionTouch} onPress={handleMessage} activeOpacity={0.88}>
                <LinearGradient colors={BrandGradient} style={styles.actionBtn}>
                  <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>MESSAGE CUSTOMER</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.arrivedTouch} onPress={handleArrived} activeOpacity={0.9}>
              <LinearGradient colors={BrandGradient} style={styles.arrivedBtn}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.arrivedBtnText}>ARRIVED / START TASK</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
    bottom: SCREEN_WIDTH < 380 ? 300 : 320,
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
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sheetHeaderText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sheetBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  etaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  routeWarn: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 4,
    marginBottom: 4,
  },
  distanceMeta: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  actionTouch: { flex: 1 },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  arrivedTouch: { marginTop: 2 },
  arrivedBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  arrivedBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
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
