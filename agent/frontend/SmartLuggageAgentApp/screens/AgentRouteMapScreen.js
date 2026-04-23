import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Colors from '../constants/colors';

let MapView = null;
let Marker = null;
let Polyline = null;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
}

const DEFAULT_CITY_SPEED_KMPH = 28;

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
    return {
      latitude: 28.6139,
      longitude: 77.2090,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
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
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.8),
  };
};

const buildTaskFromRequest = (request) => ({
  id: request?.sessionId ? `session-${request.sessionId}` : `request-${request?.queueId || Date.now()}`,
  sessionId: request?.sessionId || null,
  agentName: request?.agentName || 'Agent',
  agentId: request?.agentId || null,
  type: 'Pickup',
  pickupLocation: request?.pickupAddress || 'Pickup location pending',
  dropLocation: request?.dropAddress || 'Drop location pending',
  timeSlot: request?.pickupTime || 'Time slot pending',
  luggage: Number(request?.bagCount || 1),
  status: 'in-progress',
  phoneNumber: request?.phone || request?.userPhone || '',
  customerName: request?.name || request?.userName || 'Customer',
  customerPhone: request?.phone || request?.userPhone || '',
  pickupLatitude: request?.pickupLatitude || null,
  pickupLongitude: request?.pickupLongitude || null,
});

export default function AgentRouteMapScreen({ navigation, route }) {
  const request = route?.params?.request || {};

  const customerName = request?.name || request?.userName || 'Customer';
  const customerPhone = request?.phone || request?.userPhone || 'No phone';
  const customerLat = toNumberOrNull(request?.pickupLatitude);
  const customerLng = toNumberOrNull(request?.pickupLongitude);

  const customerLocation = useMemo(() => (
    Number.isFinite(customerLat) && Number.isFinite(customerLng)
      ? { latitude: customerLat, longitude: customerLng }
      : null
  ), [customerLat, customerLng]);

  const [agentLocation, setAgentLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distanceKm, setDistanceKm] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadAgentLocation = async () => {
      try {
        setLoadingLocation(true);
        setRouteError('');

        const permissionResult = await Location.requestForegroundPermissionsAsync();
        if (permissionResult.status !== 'granted') {
          if (!cancelled) {
            setRouteError('Location permission denied. Turn on location to get route and ETA.');
          }
          return;
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!cancelled) {
          setAgentLocation({
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
          });
        }
      } catch (_error) {
        if (!cancelled) {
          setRouteError('Unable to get current location.');
        }
      } finally {
        if (!cancelled) {
          setLoadingLocation(false);
        }
      }
    };

    loadAgentLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadShortestRoute = async () => {
      if (!agentLocation || !customerLocation) {
        return;
      }

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
        if (!cancelled) {
          setLoadingRoute(false);
        }
      }
    };

    loadShortestRoute();

    return () => {
      cancelled = true;
    };
  }, [agentLocation, customerLocation]);

  const initialRegion = useMemo(() => buildInitialRegion(agentLocation, customerLocation), [agentLocation, customerLocation]);

  const handleCall = async () => {
    if (!customerPhone || customerPhone === 'No phone') {
      Alert.alert('Call customer', 'Phone number is not available for this request.');
      return;
    }

    const telUrl = `tel:${String(customerPhone).replace(/\s+/g, '')}`;
    const canOpen = await Linking.canOpenURL(telUrl);
    if (!canOpen) {
      Alert.alert('Call customer', 'Phone call is not supported on this device.');
      return;
    }

    Linking.openURL(telUrl);
  };

  const hasValidDestination = Boolean(customerLocation);

  const handleArrived = () => {
    navigation.navigate('TaskDetails', {
      task: buildTaskFromRequest(request),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.mapHeaderOverlay}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Route To Pickup</Text>
            <Text style={styles.headerSubtitle}>Shortest available path</Text>
          </View>
        </View>

        {Platform.OS === 'web' ? (
          <View style={styles.centerState}>
            <Text style={styles.centerStateTitle}>Map preview is mobile only</Text>
            <Text style={styles.centerStateText}>Open this flow on Android/iOS to view route guidance.</Text>
          </View>
        ) : !hasValidDestination ? (
          <View style={styles.centerState}>
            <Text style={styles.centerStateTitle}>Pickup location missing</Text>
            <Text style={styles.centerStateText}>This request has no user coordinates yet.</Text>
          </View>
        ) : (
          <MapView style={styles.map} initialRegion={initialRegion} showsUserLocation>
            {agentLocation ? (
              <Marker
                coordinate={agentLocation}
                title="You"
                description="Current location"
                pinColor="#0F62FE"
              />
            ) : null}

            {customerLocation ? (
              <Marker
                coordinate={customerLocation}
                title={customerName}
                description="Pickup location"
                pinColor="#FF3B30"
              />
            ) : null}

            {routeCoordinates.length >= 2 ? (
              <Polyline
                coordinates={routeCoordinates}
                strokeWidth={5}
                strokeColor="#2563EB"
                lineJoin="round"
                lineCap="round"
              />
            ) : null}
          </MapView>
        )}

        <View style={styles.bottomCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{customerName.charAt(0).toUpperCase()}</Text>
          </View>

          <View style={styles.cardMainInfo}>
            <Text style={styles.customerName}>{customerName}</Text>
            <Text style={styles.customerPhone}>{customerPhone}</Text>
          </View>

          <TouchableOpacity style={styles.callButton} onPress={handleCall}>
            <Ionicons name="call" size={16} color={Colors.textWhite} />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Distance</Text>
              <Text style={styles.metricValue}>{distanceKm !== null ? `${distanceKm} km` : '--'}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Delivery Time</Text>
              <Text style={styles.metricValue}>{etaMinutes !== null ? `${etaMinutes} min` : '--'}</Text>
            </View>
          </View>

          {(loadingLocation || loadingRoute) ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loaderText}>Finding best route...</Text>
            </View>
          ) : null}

          {routeError ? <Text style={styles.routeErrorText}>{routeError}</Text> : null}

          <TouchableOpacity style={styles.arrivedButton} onPress={handleArrived}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.textWhite} />
            <Text style={styles.arrivedButtonText}>Arrived / Start Task</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  map: {
    flex: 1,
  },
  mapHeaderOverlay: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginRight: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
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
  },
  bottomCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 10,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  cardMainInfo: {
    flex: 1,
    minWidth: 140,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  customerPhone: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  callButton: {
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0F62FE',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  metricsRow: {
    width: '100%',
    flexDirection: 'row',
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  metricValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  loaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 12,
    color: '#64748B',
  },
  routeErrorText: {
    width: '100%',
    fontSize: 12,
    color: '#B91C1C',
  },
  arrivedButton: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  arrivedButtonText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 13,
  },
});