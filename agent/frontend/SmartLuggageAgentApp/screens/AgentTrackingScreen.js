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
import { LinearGradient } from 'expo-linear-gradient';
import AgentMapView from '../components/AgentMapView';
import Colors, { BrandGradient, BRAND_ORANGE } from '../constants/colors';
import {
  fetchAgentLocationOnce,
  fetchRouteLine,
  formatDistance,
  formatEta,
  getTrackingActionConfig,
  getTrackingMapTarget,
  getTrackingStatusLabel,
  normalizeTrackingBooking,
  startBookingTask,
} from '../utils/trackingService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOCATION_REFRESH_MS = 6000;

const buildInitialRegion = (agentLocation, targetLocation) => {
  const points = [agentLocation, targetLocation].filter(Boolean);
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
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
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

export default function AgentTrackingScreen({ navigation, route }) {
  const incomingBooking = route?.params?.booking || route?.params?.task || route?.params?.request || {};
  const mapRef = useRef(null);

  const [booking, setBooking] = useState(normalizeTrackingBooking(incomingBooking));
  const [agentLocation, setAgentLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distanceKm, setDistanceKm] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  useEffect(() => {
    setBooking(normalizeTrackingBooking(incomingBooking));
  }, [incomingBooking]);

  const targetInfo = useMemo(() => getTrackingMapTarget(booking), [booking]);
  const actionConfig = useMemo(() => getTrackingActionConfig(booking?.status), [booking?.status]);
  const isDeliveryLeg = targetInfo.routePhase === 'delivery';
  const targetLocation = useMemo(() => {
    if (targetInfo.latitude === null || targetInfo.longitude === null) return null;
    return { latitude: targetInfo.latitude, longitude: targetInfo.longitude };
  }, [targetInfo.latitude, targetInfo.longitude]);

  const customerName = booking?.username || 'Customer';
  const customerPhone = booking?.phone || '';
  const bookingId = booking?.id || route?.params?.bookingId;
  const pickupLabel = booking?.pickup_address || 'Pickup location pending';
  const dropLabel = booking?.drop_address || 'Drop location pending';
  const etaLabel = Number.isFinite(etaMinutes) ? formatEta(etaMinutes) : '--';
  const distanceLabel = Number.isFinite(distanceKm) ? formatDistance(distanceKm) : '--';

  const syncAgentLocation = async () => {
    try {
      const location = await fetchAgentLocationOnce();
      setAgentLocation(location);
    } catch (error) {
      setRouteError(error?.message || 'Unable to get your current location');
    } finally {
      setLoadingLocation(false);
    }
  };

  useEffect(() => {
    syncAgentLocation();
    const timer = setInterval(syncAgentLocation, LOCATION_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRoute = async () => {
      if (!agentLocation || !targetLocation) return;
      setLoadingRoute(true);
      try {
        const routeResult = await fetchRouteLine(agentLocation, targetLocation);
        if (cancelled) return;
        setRouteCoordinates(routeResult.coordinates);
        setDistanceKm(routeResult.distanceKm);
        setEtaMinutes(routeResult.etaMinutes);
        setRouteError(routeResult.routeError || '');
      } catch (error) {
        if (!cancelled) {
          setRouteError(error?.message || 'Failed to load route');
        }
      } finally {
        if (!cancelled) setLoadingRoute(false);
      }
    };

    loadRoute();
    return () => { cancelled = true; };
  }, [agentLocation, targetLocation]);

  const initialRegion = useMemo(() => buildInitialRegion(agentLocation, targetLocation), [agentLocation, targetLocation]);

  const fitMapToRoute = () => {
    if (!mapRef.current?.fitToCoordinates) return;
    const coordinates = routeCoordinates.length >= 2
      ? routeCoordinates
      : [agentLocation, targetLocation].filter(Boolean);
    if (coordinates.length < 2) return;
    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 80, right: 48, bottom: 260, left: 48 },
      animated: true,
    });
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

  const handleBigAction = async () => {
    if (actionConfig.action === 'start') {
      try {
        setActionLoading(true);
        const updatedBooking = await startBookingTask(bookingId);
        setBooking(normalizeTrackingBooking(updatedBooking));
        navigation.navigate('TaskDetails', {
          task: normalizeTrackingBooking(updatedBooking),
        });
      } catch (error) {
        Alert.alert('Start Task Failed', error?.message || 'Unable to start task.');
      } finally {
        setActionLoading(false);
      }
      return;
    }
  };

  const openFullMap = () => {
    fitMapToRoute();
  };

  const statusLabel = getTrackingStatusLabel(booking?.status);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.mapWrap}>
          <AgentMapView
            mapRef={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            agentLocation={agentLocation}
            customerLocation={targetLocation}
            routeCoordinates={routeCoordinates}
            etaMinutes={etaMinutes}
          />

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.recenterBtn} onPress={openFullMap}>
            <Ionicons name="navigate" size={20} color="#111827" />
          </TouchableOpacity>

          <View style={styles.etaBadge}>
            <Text style={styles.etaBadgeLabel}>ETA</Text>
            <Text style={styles.etaBadgeValue}>{etaLabel}</Text>
          </View>

          <View style={styles.distanceBadge}>
            <Text style={styles.distanceBadgeLabel}>Distance</Text>
            <Text style={styles.distanceBadgeValue}>{distanceLabel}</Text>
          </View>

          <View style={styles.routeStatusPill}>
            <Text style={styles.routeStatusPillText}>{isDeliveryLeg ? 'Routing to drop-off' : 'Routing to pickup'}</Text>
          </View>
        </View>

        <View style={styles.bottomSheet}>
          <LinearGradient colors={BrandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sheetHeader}>
            <Text style={styles.sheetHeaderText}>{statusLabel.toUpperCase()}</Text>
          </LinearGradient>

          <View style={styles.sheetBody}>
            <Text style={styles.bookingTitle}>Booking #{bookingId || '--'}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color="#94A3B8" />
              <Text style={styles.infoText}>{customerName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color="#94A3B8" />
              <Text style={styles.infoText}>{customerPhone || 'Not available'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color="#94A3B8" />
              <Text style={styles.infoText} numberOfLines={2}>
                {isDeliveryLeg ? dropLabel : pickupLabel}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionTouch} onPress={handleCall} activeOpacity={0.88}>
                <LinearGradient colors={BrandGradient} style={styles.actionBtn}>
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>CALL</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionTouch} onPress={handleMessage} activeOpacity={0.88}>
                <LinearGradient colors={BrandGradient} style={styles.actionBtn}>
                  <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>MESSAGE</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.bigActionButton,
                actionConfig.action === 'done' && styles.bigActionButtonDisabled,
              ]}
              onPress={handleBigAction}
              disabled={actionConfig.action === 'done' || actionLoading}
              activeOpacity={0.9}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.bigActionButtonText}>{actionConfig.label}</Text>
              )}
            </TouchableOpacity>

            {routeError ? <Text style={styles.routeWarn}>{routeError}</Text> : null}
            {loadingLocation || loadingRoute ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={BRAND_ORANGE} />
                <Text style={styles.loadingText}>Updating live route...</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  mapWrap: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: SCREEN_WIDTH < 380 ? 290 : 315,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  etaBadge: {
    position: 'absolute',
    top: 14,
    right: 68,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 30,
  },
  etaBadgeLabel: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  etaBadgeValue: { fontSize: 15, color: '#111827', fontWeight: '800', marginTop: 2 },
  distanceBadge: {
    position: 'absolute',
    top: 14,
    left: 68,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 30,
  },
  distanceBadgeLabel: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  distanceBadgeValue: { fontSize: 15, color: '#111827', fontWeight: '800', marginTop: 2 },
  routeStatusPill: {
    position: 'absolute',
    bottom: SCREEN_WIDTH < 380 ? 300 : 325,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 30,
  },
  routeStatusPillText: { fontSize: 12, color: '#111827', fontWeight: '800' },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetHeader: {
    paddingVertical: 13,
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
  bookingTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9, gap: 8 },
  infoText: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionTouch: { flex: 1 },
  actionBtn: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  bigActionButton: {
    marginTop: 14,
    backgroundColor: BRAND_ORANGE,
    borderRadius: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  bigActionButtonDisabled: { backgroundColor: '#94A3B8' },
  bigActionButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14, letterSpacing: 0.4 },
  routeWarn: { fontSize: 12, color: '#B45309', marginTop: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  loadingText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
});
