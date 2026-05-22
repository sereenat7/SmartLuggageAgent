import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';
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
  const etaLabel = Number.isFinite(etaMinutes) ? `ETA ${etaMinutes} MIN` : 'ETA --';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin:0; padding:0; height:100%; width:100%; }
    .eta-badge {
      position: absolute; z-index: 1000; top: 42%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255,255,255,0.95); padding: 8px 14px;
      border-radius: 8px; font: 800 13px Arial, sans-serif; color: #111827;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    }
    .marker-label {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 4px 8px; font: 700 11px Arial, sans-serif; color: #111827;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1); margin-bottom: 4px; text-align: center;
    }
    .marker-dot {
      width: 16px; height: 16px; border-radius: 50%; background: #fff;
      border: 4px solid ${BRAND_ORANGE}; margin: 0 auto;
      box-shadow: 0 0 0 6px rgba(255,102,0,0.25);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="eta-badge">${etaLabel}</div>
  <script>
    const agent = ${agent};
    const customer = ${customer};
    const path = [${path}];
    const map = L.map('map', { zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const points = [];
    function markerHtml(title, sub) {
      return '<div><div class="marker-label">' + title + '<br/><span style="font-size:9px;color:#64748b">' + sub + '</span></div><div class="marker-dot"></div></div>';
    }

    if (customer) {
      const m1 = L.marker(customer, {
        icon: L.divIcon({ className: '', html: markerHtml('CUSTOMER', '(Pickup)'), iconSize: [90, 50], iconAnchor: [45, 50] })
      }).addTo(map);
      points.push(customer);
    }
    if (agent) {
      const m2 = L.marker(agent, {
        icon: L.divIcon({ className: '', html: markerHtml('YOU', '(Agent)'), iconSize: [80, 50], iconAnchor: [40, 50] })
      }).addTo(map);
      points.push(agent);
    }
    if (path.length >= 2) {
      L.polyline(path, { color: '${BRAND_ORANGE}', weight: 5, opacity: 0.9 }).addTo(map);
      points.push(...path);
    } else if (agent && customer) {
      L.polyline([agent, customer], { color: '${BRAND_ORANGE}', weight: 5, opacity: 0.9, dashArray: '6 8' }).addTo(map);
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
        <Marker coordinate={customerLocation} title="Customer" description="Pickup location" pinColor={BRAND_ORANGE} />
      ) : null}
      {agentLocation ? (
        <Marker coordinate={agentLocation} title="You" description="Your location" pinColor="#1D4ED8" />
      ) : null}
      {routeCoordinates?.length >= 2 ? (
        <Polyline
          coordinates={routeCoordinates}
          strokeWidth={5}
          strokeColor={BRAND_ORANGE}
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

  const useWebMap = Platform.OS === 'web' || isExpoGo || nativeFailed;

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
});
