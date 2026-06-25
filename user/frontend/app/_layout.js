import { useEffect } from "react";
import { Stack } from "expo-router";
import { initializeNotifications } from "../utils/notificationService";

export default function RootLayout() {
  useEffect(() => {
    // Initialize notifications on app start
    initializeNotifications();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(booking)" />
    </Stack>
  );
}
