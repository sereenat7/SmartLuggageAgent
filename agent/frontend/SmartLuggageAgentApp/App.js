// App.js — iOS / Android only
// Phase order: splash → pickup-animation → app
// NavigationContainer (Landing page) is NOT mounted until phase === 'app'
// so it is IMPOSSIBLE for Landing to show during splash or animation.
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './navigation';
import NativeSplashScreen from './NativeSplashScreen';
import LuggagePickupAnimation from './screens/LuggagePickupAnimation';
import AgentRouteMapScreen from './screens/AgentRouteMapScreen';

export default function App() {
  const [phase, setPhase] = useState('splash'); // 'splash' → 'pickup' → 'app'

  // ── SPLASH ──────────────────────────────────────────────────────────────────
  if (phase === 'splash') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <NativeSplashScreen onFinish={() => setPhase('pickup')} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // ── PICKUP ANIMATION ────────────────────────────────────────────────────────
  if (phase === 'pickup') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <LuggagePickupAnimation onFinish={() => setPhase('app')} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // ── MAIN APP (Landing → Login → …) ─────────────────────────────────────────
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
