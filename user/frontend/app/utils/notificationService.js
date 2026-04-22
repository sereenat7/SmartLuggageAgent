import { Platform, ToastAndroid } from 'react-native';

// Lazy load expo-notifications only on iOS
let Notifications = null;
let isInitializing = false;

const loadNotificationsIOS = async () => {
  // Only load on iOS
  if (Platform.OS !== 'ios') return null;
  if (Notifications) return Notifications;
  if (isInitializing) return null;
  
  isInitializing = true;
  
  try {
    const NotifModule = await import('expo-notifications');
    
    Notifications = NotifModule;
    
    // Configure notification handler
    if (Notifications.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
    
    return Notifications;
  } catch (error) {
    console.warn('⚠️ Could not load notifications on iOS:', error.message);
    isInitializing = false;
    return null;
  }
};

// Initialize notifications on app start
export const initializeNotifications = async () => {
  try {
    if (Platform.OS === 'ios') {
      const NotifModule = await loadNotificationsIOS();
      
      if (!NotifModule) {
        console.warn('⚠️ Notifications not available on iOS');
        return;
      }

      // Request notification permissions
      if (NotifModule.requestPermissionsAsync) {
        const { status } = await NotifModule.requestPermissionsAsync();
        
        if (status === 'granted') {
          console.log('✅ Notification permissions granted (iOS)');
        }
      }
    } else {
      // Android: No special initialization needed for ToastAndroid
      console.log('✅ Toast notifications initialized (Android)');
    }
  } catch (error) {
    console.warn('⚠️ Error initializing notifications:', error.message);
  }
};

// Trigger OS-level notification on login
export const triggerLoginNotification = async (username) => {
  try {
    console.log("🔥 LOGIN NOTIFICATION TRIGGERED");
    
    if (Platform.OS === 'ios') {
      // iOS: Use expo-notifications
      const NotifModule = await loadNotificationsIOS();
      
      if (!NotifModule || !NotifModule.scheduleNotificationAsync) {
        console.warn('⚠️ Notifications not available on iOS');
        return;
      }

      await NotifModule.scheduleNotificationAsync({
        content: {
          title: 'Login Successful ✅',
          body: `Welcome back, ${username}!`,
          sound: true,
          badge: 1,
          priority: 'high',
        },
        trigger: {
          seconds: 0.5,
        },
      });

      console.log('🔔 iOS notification scheduled');
    } else {
      // Android: Use ToastAndroid (system-level toast notification)
      const message = `Welcome back, ${username}!`;
      ToastAndroid.showWithGravity(message, ToastAndroid.LONG, ToastAndroid.TOP);
      console.log('🔔 Android toast notification displayed');
    }
  } catch (error) {
    console.error('❌ Error triggering notification:', error.message);
  }
};

