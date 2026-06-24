// navigation/index.js
import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen      from '../screens/LoginScreen';
import GuestScreen      from '../screens/GuestScreen';
import KYCFormScreen    from '../screens/KYCFormScreen';
import DashboardScreen  from '../screens/DashboardScreen';
import TaskDetailsScreen from '../screens/TaskDetailsScreen';
import AgentTrackingScreen from '../screens/AgentTrackingScreen';
import ProfileScreen    from '../screens/ProfileScreen';
import AgentRouteMapScreen from '../screens/AgentRouteMapScreen';
import AgentAirportMapScreen from '../screens/AgentAirportMapScreen';
import QrScannerScreen from '../screens/QrScannerScreen';
import QrVerificationScreen from '../screens/QrVerificationScreen';

import NativeLandingScreen from '../screens/NativeLandingScreen';
import Colors from '../constants/colors';

// Web LandingPage uses HTML/DOM/framer-motion — safe to require only on web
const LandingComponent = Platform.OS === 'web'
  ? require('../LandingPage').default
  : NativeLandingScreen;

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.textWhite,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'fade',
      }}
    >
      {/* Always registered statically — no conditional JSX — so reset() always finds it */}
      <Stack.Screen name="Landing"     component={LandingComponent}   options={{ headerShown: false }} />
      <Stack.Screen name="Login"       component={LoginScreen}        options={{ headerShown: false }} />
      <Stack.Screen name="Guest"       component={GuestScreen}        options={{ title: 'Guest Mode' }} />
      <Stack.Screen name="KYCForm"     component={KYCFormScreen}      options={{ headerShown: false }} />
      <Stack.Screen name="Dashboard"   component={DashboardScreen}    options={{ headerShown: false }} />
      <Stack.Screen name="TaskDetails" component={TaskDetailsScreen}  options={{ headerShown: false }} />
      <Stack.Screen name="QrScanner" component={QrScannerScreen}      options={{ headerShown: false }} />
      <Stack.Screen name="QrVerification" component={QrVerificationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AgentTracking" component={AgentTrackingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AgentRouteMap" component={AgentRouteMapScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AgentAirportMap" component={AgentAirportMapScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile"     component={ProfileScreen}      options={{ headerShown: false }} />
    </Stack.Navigator>

  );
}

