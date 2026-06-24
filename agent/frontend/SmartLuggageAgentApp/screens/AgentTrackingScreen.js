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
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Customer Details</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{statusLabel}</Text>
            </View>
          </View>

          <View style={styles.customerProfileRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerNameText}>{customerName}</Text>
              <Text style={styles.customerMetaText}>{booking?.bag_count || booking?.bagCount || 1} bags</Text>
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
              <Text style={styles.statColValue}>{loadingLocation || loadingRoute ? '...' : etaLabel}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statColLabel}>DISTANCE</Text>
              <Text style={styles.statColValue}>{loadingLocation || loadingRoute ? '...' : distanceLabel}</Text>
            </View>
          </View>

          {routeError ? <Text style={styles.routeWarn}>{routeError}</Text> : null}

          {actionConfig.action !== 'done' && (
            <TouchableOpacity
              style={[
                styles.primaryActionBtn,
                actionConfig.action === 'done' && styles.primaryActionBtnDisabled,
              ]}
              onPress={handleBigAction}
              disabled={actionConfig.action === 'done' || actionLoading}
              activeOpacity={0.9}
            >
              {actionLoading ? (
                <View style={[styles.primaryActionGradient, { backgroundColor: BRAND_ORANGE }]}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : (
                <LinearGradient colors={BrandGradient} style={styles.primaryActionGradient}>
                  <Text style={styles.primaryActionText}>{actionConfig.label}</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          )}
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
    bottom: 300,
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
    zIndex: 40,
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
  primaryActionBtnDisabled: {
    backgroundColor: '#94A3B8',
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
    marginBottom: 8,
  },
});
