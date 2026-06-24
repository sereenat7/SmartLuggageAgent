import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_ORANGE } from '../constants/colors';

const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

const buildLeafletHtml = ({ agentLocation, customerLocation, routeCoordinates, etaMinutes }) => {
  const agent = agentLocation
    ? `[${agentLocation.latitude}, ${agentLocation.longitude}]`
    : 'null';
  const customer = customerLocation
    ? `[${customerLocation.latitude}, ${customerLocation.longitude}]`
    : 'null';
  const path = (routeCoordinates || [])
    .map((p) => `[${p.latitude}, ${p.longitude}]`)
    .join(',');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin:0; padding:0; height:100%; width:100%; }
    .agent-marker-ping {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #2563eb;
      border: 3px solid #fff;
      box-shadow: 0 0 0 6px rgba(37,99,235,0.25);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const agent = ${agent};
    const customer = ${customer};
    const path = [${path}];
    const map = L.map('map', { 
      zoomControl: false,
      preferCanvas: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelDebounceTime: 40
    });
    L.tileLayer('https://maps.geoapify.com/v1/tile/osm-liberty/{z}/{x}/{y}.png?apiKey=6a6f5450f3164727b88686b4a5a0fffd', {
      attribution: '© OpenStreetMap contributors | Geoapify',
      maxZoom: 20,
      maxNativeZoom: 19,
      detectRetina: true
    }).addTo(map);

    const points = [];

    if (customer) {
      const customerIcon = L.divIcon({
        className: '',
        html: '<div style="position:relative;width:30px;height:40px;margin-top:-20px;"><svg width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.71573 0 0 6.71573 0 15C0 26.25 15 40 15 40C15 40 30 26.25 30 15C30 6.71573 23.2843 0 15 0Z" fill="#2563eb"/><circle cx="15" cy="15" r="6" fill="#ffffff"/><circle cx="15" cy="15" r="3" fill="#2563eb"/></svg></div>',
        iconSize: [30, 40],
        iconAnchor: [15, 40]
      });
      const m1 = L.marker(customer, { icon: customerIcon }).addTo(map);
      points.push(customer);
    }
    if (agent) {
      const agentIcon = L.divIcon({
        className: '',
        html: '<div class="agent-marker-ping"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      const m2 = L.marker(agent, { icon: agentIcon }).addTo(map);
      points.push(agent);
    }
    if (path.length >= 2) {
      L.polyline(path, { color: '#2563eb', weight: 5, opacity: 0.9 }).addTo(map);
      points.push(...path);
    } else if (agent && customer) {
      L.polyline([agent, customer], { color: '#2563eb', weight: 5, opacity: 0.9, dashArray: '6 8' }).addTo(map);
      points.push(agent, customer);
    }
    if (points.length) {
      map.fitBounds(points, { padding: [60, 60] });
    } else {
      map.setView([28.6139, 77.2090], 11);
    }
  </script>
</body>
</html>`;
};

function NativeAgentMap({
  style,
  initialRegion,
  agentLocation,
  customerLocation,
  routeCoordinates,
  mapRef,
}) {
  const maps = require('react-native-maps');
  const MapView = maps.default;
  const Marker = maps.Marker;
  const Polyline = maps.Polyline;

  return (
    <MapView
      ref={mapRef}
      style={style}
      initialRegion={initialRegion}
      showsUserLocation={false}
      showsMyLocationButton={false}
    >
      {customerLocation ? (
        <Marker coordinate={customerLocation} title="Customer" description="Pickup location" pinColor="#2563eb" />
      ) : null}
      {agentLocation ? (
        <Marker coordinate={agentLocation} title="You" description="Your location" pinColor="#2563eb" />
      ) : null}
      {routeCoordinates?.length >= 2 ? (
        <Polyline
          coordinates={routeCoordinates}
          strokeWidth={5}
          strokeColor="#2563eb"
          lineJoin="round"
          lineCap="round"
        />
      ) : null}
    </MapView>
  );
}

export default function AgentMapView({
  style,
  initialRegion,
  agentLocation,
  customerLocation,
  routeCoordinates,
  etaMinutes,
  mapRef,
}) {
  const [nativeFailed, setNativeFailed] = useState(false);
  const webRef = useRef(null);

  const useWebMap = true;

  const html = useMemo(
    () =>
      buildLeafletHtml({
        agentLocation,
        customerLocation,
        routeCoordinates,
        etaMinutes,
      }),
    [agentLocation, customerLocation, routeCoordinates, etaMinutes],
  );

  useEffect(() => {
    if (useWebMap && webRef.current) {
      webRef.current.reload();
    }
  }, [html, useWebMap]);

  if (useWebMap) {
    return (
      <View style={[style, styles.wrap]}>
        <WebView
          ref={webRef}
          style={styles.map}
          originWhitelist={['*']}
          source={{ html }}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
        />
        <View style={styles.floatingPill} pointerEvents="none">
          <Ionicons name="git-compare-outline" size={16} color="#111827" style={{ marginRight: 6 }} />
          <Text style={styles.floatingPillText}>Route from source to destination</Text>
        </View>
        {isExpoGo ? (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>Map preview (Expo Go). Run: npx expo run:android for native maps.</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <MapErrorBoundary onError={() => setNativeFailed(true)}>
      <NativeAgentMap
        style={style}
        initialRegion={initialRegion}
        agentLocation={agentLocation}
        customerLocation={customerLocation}
        routeCoordinates={routeCoordinates}
        mapRef={mapRef}
      />
    </MapErrorBoundary>
  );
}

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  map: { flex: 1 },
  hint: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    padding: 6,
  },
  hintText: { fontSize: 10, color: '#64748B', textAlign: 'center' },
  floatingPill: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  floatingPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
});
