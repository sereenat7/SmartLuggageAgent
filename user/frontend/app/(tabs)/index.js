import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  SafeAreaView, StatusBar, Platform, Linking, Alert 
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as bookingSync from '../../utils/bookingSync';
import { API_BASE_URL } from '../../utils/api';

export default function Home() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  
  const [greeting, setGreeting] = useState("Good Morning");
  const [displayName, setDisplayName] = useState("User");
  const [pickupAddress, setPickupAddress] = useState("Fetching location...");
  const [userSelectedPickup, setUserSelectedPickup] = useState(false);
  const [activeBooking, setActiveBooking] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [userPhone, setUserPhone] = useState("");
  const pollingRef = useRef(null);

  const displayInitial = displayName.charAt(0).toUpperCase();
  const API_URL = `${API_BASE_URL}/api/bookings`;

  const applyBookingsSnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    setRecentBookings(snapshot.recentBookings || []);
    setActiveBooking((previous) => {
      const next = snapshot.activeBooking || null;
      if (!next) return null;
      if (!previous || bookingSync.hasBookingStatusChanged(previous, next)) {
        return next;
      }
      return { ...previous, ...next };
    });

    if (snapshot.activeBooking?.id) {
      bookingSync.setActiveTrackingBooking(snapshot.activeBooking.id);
    } else {
      bookingSync.setActiveTrackingBooking(null);
    }
  }, []);

  const refreshHomeBookings = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return null;

      const bookings = await bookingSync.fetchUserBookings(token);
      if (!bookings) return null;

      const preferredId = await bookingSync.getActiveTrackingBooking();
      const activeBooking = bookingSync.resolvePrimaryActiveBooking(bookings, preferredId);
      const snapshot = {
        bookings,
        activeBooking,
        recentBookings: bookings.slice(0, 3),
      };

      applyBookingsSnapshot(snapshot);
      return { ...snapshot, token };
    } catch (error) {
      console.error('Error refreshing home bookings:', error);
      return null;
    }
  }, [applyBookingsSnapshot]);

  const handleBookingsSnapshot = useCallback((snapshot) => {
    applyBookingsSnapshot(snapshot);

    if (snapshot?.activeBooking && !bookingSync.isActiveBooking(snapshot.activeBooking)) {
      if (pollingRef.current) {
        bookingSync.stopBookingPolling(pollingRef.current);
        pollingRef.current = null;
      }
      refreshHomeBookings();
    }
  }, [applyBookingsSnapshot, refreshHomeBookings]);

  // Load saved pickup or current location
  const loadPickup = async () => {
  try {
    const saved = await AsyncStorage.getItem("pickupDetails");

    if (saved) {
      const data = JSON.parse(saved);
      // Only keep saved location if it was user-selected
      if (data.userSelected && data.address) {
        setPickupAddress(data.address);
        setUserSelectedPickup(true);
        return; // ✅ stop here, DO NOT fetch location
      }
    }

    // Otherwise, always fetch fresh current location
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setPickupAddress("Permission denied");
      return;
    }

    let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    let res = await Location.reverseGeocodeAsync(loc.coords);
    let currentAddr = "Current location";
    if (res.length > 0) {
      currentAddr = `${res[0].name || ""}, ${res[0].street || ""}, ${res[0].city || ""}`;
    }
    setPickupAddress(currentAddr);
    
    // ✅ Save current location to AsyncStorage with coordinates
    await AsyncStorage.setItem(
      "pickupLocationDetails",
      JSON.stringify({
        address: currentAddr,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        city: res[0]?.city || "",
        state: res[0]?.region || "",
        country: res[0]?.country || "",
        name: displayName,
        phone: global.userPhone || "",
        tag: "Home"
      })
    );
    
    await AsyncStorage.setItem(
      "pickupDetails",
      JSON.stringify({
        address: currentAddr,
        userSelected: false
      })
    );
    
    setUserSelectedPickup(false);

  } catch (e) {
    console.log("Error loading pickup:", e);
    setPickupAddress("Error fetching location");
  }
};
  // Greeting & username
  useEffect(() => {
    const hours = new Date().getHours();
    if (hours < 12) setGreeting("Good Morning");
    else if (hours < 16) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    const loadName = async () => {
      try {
        if (params?.userName) {
          // ✅ User just logged in - clear old pickup to force fresh location fetch
          await AsyncStorage.removeItem("pickupDetails");
          
          setDisplayName(params.userName);
          await AsyncStorage.setItem("userName", params.userName);
        } else {
          const savedName = await AsyncStorage.getItem("userName");
          if (savedName) setDisplayName(savedName);
        }
      } catch (e) {
        console.log("Error loading name:", e);
      }
    };

    loadName();
    loadPickup();
    refreshHomeBookings();
  }, [params?.userName, refreshHomeBookings]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadDataOnFocus = async () => {
        try {
          const savedName = await AsyncStorage.getItem('userName');
          if (savedName && isActive) {
            setDisplayName(savedName);
          }

          const saved = await AsyncStorage.getItem('pickupDetails');
          if (saved) {
            const data = JSON.parse(saved);
            if (data.address && isActive) {
              setPickupAddress(data.address);
              setUserSelectedPickup(data.userSelected || false);
            }
          } else if (isActive) {
            await loadPickup();
          }

          if (!isActive) return;

          const result = await refreshHomeBookings();
          if (!isActive || !result?.token) return;

          if (pollingRef.current) {
            bookingSync.stopBookingPolling(pollingRef.current);
          }

          pollingRef.current = bookingSync.startBookingsListPolling(
            result.token,
            (snapshot) => {
              if (!isActive) return;
              handleBookingsSnapshot(snapshot);
            },
            3000
          );
        } catch (e) {
          console.log('Error in useFocusEffect:', e);
        }
      };

      loadDataOnFocus();

      return () => {
        isActive = false;
        if (pollingRef.current) {
          bookingSync.stopBookingPolling(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }, [refreshHomeBookings, handleBookingsSnapshot])
  );
  // When user manually selects a pickup
  const onUserSelectPickup = async (address) => {
    setPickupAddress(address);
    setUserSelectedPickup(true);
    await AsyncStorage.setItem("pickupDetails", JSON.stringify({ userSelected: true, address }));
  };

  // Format airport with terminal dynamically
  const navigateToBookingDetails = (booking) => {
    if (!booking?.id) return;
    router.push({
      pathname: '/(booking)/booking-details',
      params: { bookingId: String(booking.id) },
    });
  };

  const formatAirportDestination = (booking) => {
    if (!booking) return 'Airport';
    
    // Use arrival_airport from database (fully dynamic)
    const airport = booking.arrival_airport || booking.departure_city || 'Airport';
    const terminal = booking.terminal ? ` ${booking.terminal}` : '';
    
    return `${airport}${terminal}`;
  };

  const getBookingProgressInfo = (booking) => {
    if (!booking) return { percentage: 0, label: 'Pending', description: 'Awaiting confirmation' };

    if (bookingSync.isCancelledBooking(booking)) {
      return { percentage: 0, label: 'Cancelled', description: 'Booking cancelled' };
    }
    
    const stage = bookingSync.getBookingStage(booking);
    
    switch(stage) {
      case 1:
        return { percentage: 20, label: 'Booking Confirmed', description: 'Getting ready...' };
      case 2:
        return { percentage: 40, label: 'Agent Assigned', description: 'Agent confirmed' };
      case 3:
        return { percentage: 60, label: 'In Progress', description: 'Pickup in progress...' };
      case 4:
        return { percentage: 80, label: 'On the Way', description: 'Arriving soon...' };
      case 5:
        return { percentage: 100, label: 'Delivered', description: 'Completed' };
      default:
        return { percentage: 0, label: 'Pending', description: 'Awaiting confirmation' };
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    } catch (e) {
      return 'N/A';
    }
  };

  const SUPPORT_EMAIL = 'smartluggage.support@gmail.com';
  const SUPPORT_PHONE = '1800 123 456';
  const SUPPORT_PHONE_DIAL = '1800123456';

  const openSupportEmail = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Smart Luggage Support Query')}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Email', `Please email us at ${SUPPORT_EMAIL}`);
      }
    } catch (error) {
      console.error('Failed to open email client:', error);
    }
  };

  const openSupportCall = async () => {
    const url = `tel:${SUPPORT_PHONE_DIAL}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Failed to open phone dialer:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} bounces={true} contentContainerStyle={styles.scrollContent}>
        {/* TOP HEADER */}
        <LinearGradient colors={['#ff0033', '#ff6600']} style={styles.headerGradient}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greetingText}>{greeting}, {displayName} 👋</Text>
                <Text style={styles.subGreeting}>Your luggage service at your fingertips</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(tabs)/profile')}>
                <View style={styles.profileCircle}>
                  <Text style={styles.profileInitial}>{displayInitial}</Text>
                </View>
              </TouchableOpacity>
            </View>

          </SafeAreaView>
        </LinearGradient>

        {/* SPACER */}
        <View style={{ height: 16 }} />

        {/* PICKUP */}
        <TouchableOpacity
          style={styles.pickupCard}
          activeOpacity={0.9}
          onPress={() =>
            router.push({
              pathname: "/(booking)/search_pickup",
              params: { address: pickupAddress, sourceScreen: "home" },
            })
          }
        >
          <View style={styles.pickupLeft}>
            <Ionicons name="location-sharp" size={20} color="#10B981" style={{ marginRight: 10 }} />
            <View>
              <Text style={styles.pickupTitle}>Pick up from</Text>
              <Text style={styles.pickupAddress} numberOfLines={1}>
                {pickupAddress}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color="#999" />
        </TouchableOpacity>

        
        {/* CONTENT */}
        <View style={styles.contentBody}>
          {/* HERO */}
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={() => router.push('/(booking)/flight')} 
            style={styles.heroWrapper}
          >
            <LinearGradient colors={['#1A1C1E', '#2D3436']} style={styles.heroCard}>
              <View style={styles.popularTag}>
                <MaterialCommunityIcons name="fire" size={14} color="#FFF" />
                <Text style={styles.popularText}>POPULAR</Text>
              </View>

              <Text style={styles.heroTitle}>Book a Pickup</Text>
              <Text style={styles.heroSub}>
                Secure, fast, and reliable luggage transfer to any destination.
              </Text>
              
              <View style={styles.bookNowBtn}>
                <LinearGradient colors={['#ff0033', '#ff6600']} style={styles.btnGradient}>
                  <Text style={styles.btnText}>Book Now</Text>
                  <Feather name="arrow-right" size={18} color="#FFF" />
                </LinearGradient>
              </View>

              <MaterialCommunityIcons 
                name="package-variant-closed" 
                size={90} 
                color="rgba(255,255,255,0.03)" 
                style={styles.bgIcon} 
              />
            </LinearGradient>
          </TouchableOpacity>

          {/* ACTIVE BOOKING */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Booking</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/bookings')}>
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>

          {activeBooking ? (
            <TouchableOpacity
              style={styles.activeCard}
              activeOpacity={0.9}
              onPress={() => navigateToBookingDetails(activeBooking)}
            >
              <View style={styles.cardTop}>
                <View style={styles.clockIconBg}>
                  <Feather name="clock" size={24} color="#FFF" />
                </View>

                <View style={styles.orderInfo}>
                  <Text style={styles.orderId}>Order #{activeBooking.id}</Text>
                  
                  {/* Vertical Route Display */}
                  <View style={styles.verticalRoute}>
                    <View style={styles.routeItem}>
                      <Ionicons name="location-sharp" size={16} color="#FF0033" style={styles.routeIcon} />
                      <Text style={styles.routeText} numberOfLines={2}>{activeBooking.pickup_address}</Text>
                    </View>
                    
                    <View style={styles.routeDashedLine} />
                    
                    <View style={styles.routeItem}>
                      <Ionicons name="location-sharp" size={16} color="#FF6600" style={styles.routeIcon} />
                      <Text style={styles.routeText} numberOfLines={3}>{formatAirportDestination(activeBooking)}</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: getBookingProgressInfo(activeBooking).percentage <= 25 ? '#FFF3CD' : getBookingProgressInfo(activeBooking).percentage <= 50 ? '#E7F3FF' : getBookingProgressInfo(activeBooking).percentage < 100 ? '#D1ECF1' : '#D4EDDA' }]}>
                  <Text style={[styles.statusText, { color: getBookingProgressInfo(activeBooking).percentage <= 25 ? '#856404' : getBookingProgressInfo(activeBooking).percentage <= 50 ? '#004085' : getBookingProgressInfo(activeBooking).percentage < 100 ? '#0C5460' : '#155724' }]}>
                    {getBookingProgressInfo(activeBooking).label}
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${getBookingProgressInfo(activeBooking).percentage}%` }]} />
                </View>

                <View style={styles.progressLabels}>
                  <Text style={styles.arrivalText}>{getBookingProgressInfo(activeBooking).description}</Text>
                  <Text style={styles.percentText}>{getBookingProgressInfo(activeBooking).percentage}%</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.activeCard}>
              <View style={styles.cardTop}>
                <View style={styles.clockIconBg}>
                  <Feather name="clock" size={24} color="#FFF" />
                </View>

                <View style={styles.orderInfo}>
                  <Text style={styles.orderId}>No Active Bookings</Text>
                  <Text style={styles.orderRoute}>Create a new booking to get started</Text>
                </View>
              </View>
            </View>
          )}

          {/* FEATURES */}
          <Text style={[styles.sectionTitle, { marginTop: 25 }]}>Why Choose Us?</Text>
          <View style={styles.featureRow}>
            <FeatureItem icon="shield-check" label="Secure" color="#EEF2FF" iconColor="#4F46E5" />
            <FeatureItem icon="map-marker-radius" label="Live Track" color="#ECFDF5" iconColor="#10B981" />
            <FeatureItem icon="airplane" label="Airline Safe" color="#F5F3FF" iconColor="#8B5CF6" />
            <FeatureItem icon="camera" label="Photo Proof" color="#FFF7ED" iconColor="#F59E0B" />
          </View>

          {/* RECENT */}
          <Text style={[styles.sectionTitle, { marginTop: 25 }]}>Recent Activity</Text>
          <View style={styles.recentCard}>
            {recentBookings && recentBookings.length > 0 ? (
              recentBookings.map((booking, index) => (
                <View key={booking.id || index}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push({
                      pathname: '/(booking)/booking-details',
                      params: { bookingId: String(booking.id) },
                    })}
                  >
                    <RecentItem 
                      id={`#${booking.id}`} 
                      date={formatDate(booking.created_at)}
                      status={getBookingProgressInfo(booking).label}
                    />
                  </TouchableOpacity>
                  {index < recentBookings.length - 1 && <View style={styles.divider} />}
                </View>
              ))
            ) : (
              <View style={styles.recentRow}>
                <View>
                  <Text style={styles.recentId}>No bookings yet</Text>
                  <Text style={styles.recentDate}>Start by creating a booking</Text>
                </View>
              </View>
            )}
          </View>

          {/* SUPPORT */}
          <View style={styles.supportCard}>
            <View style={styles.supportHeader}>
              <View style={styles.supportIconBox}>
                <Ionicons name="help-circle-outline" size={22} color="#ff6600" />
              </View>
              <View style={styles.supportHeaderText}>
                <Text style={styles.supportTitle}>Need help?</Text>
                <Text style={styles.supportSubtitle}>We usually reply within a few minutes.</Text>
              </View>
            </View>

            <View style={styles.supportActionsRow}>
              <TouchableOpacity
                style={styles.supportActionCard}
                activeOpacity={0.8}
                onPress={openSupportEmail}
              >
                <View style={styles.supportActionIconEmail}>
                  <Ionicons name="mail-outline" size={20} color="#ff6600" />
                </View>
                <View style={styles.supportActionTextWrap}>
                  <Text style={styles.supportActionLabel}>Email</Text>
                  <Text style={styles.supportActionValue} numberOfLines={1}>
                    {SUPPORT_EMAIL}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.supportActionCard}
                activeOpacity={0.8}
                onPress={openSupportCall}
              >
                <View style={styles.supportActionIconCall}>
                  <Ionicons name="call-outline" size={20} color="#10B981" />
                </View>
                <View style={styles.supportActionTextWrap}>
                  <Text style={styles.supportActionLabel}>Call</Text>
                  <Text style={styles.supportActionValue}>{SUPPORT_PHONE}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* SUB COMPONENTS */
function FeatureItem({ icon, label, color, iconColor }) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIconBox, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

function RecentItem({ id, date, status }) {
  const getStatusBgColor = (status) => {
    if (!status) return '#D4EDDA';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('confirmed') || lowerStatus.includes('pending')) return '#FFF3CD';
    if (lowerStatus.includes('assigned')) return '#E7F3FF';
    if (lowerStatus.includes('progress') || lowerStatus.includes('way')) return '#D1ECF1';
    if (lowerStatus.includes('delivered') || lowerStatus.includes('completed')) return '#D4EDDA';
    if (lowerStatus.includes('cancelled')) return '#F8D7DA';
    return '#D4EDDA';
  };

  const getStatusTextColor = (status) => {
    if (!status) return '#155724';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('confirmed') || lowerStatus.includes('pending')) return '#856404';
    if (lowerStatus.includes('assigned')) return '#004085';
    if (lowerStatus.includes('progress') || lowerStatus.includes('way')) return '#0C5460';
    if (lowerStatus.includes('delivered') || lowerStatus.includes('completed')) return '#155724';
    if (lowerStatus.includes('cancelled')) return '#721C24';
    return '#155724';
  };

  return (
    <View style={styles.recentRow}>
      <View>
        <Text style={styles.recentId}>{id}</Text>
        <Text style={styles.recentDate}>{date}</Text>
      </View>
      <View style={[styles.deliveredBadge, { backgroundColor: getStatusBgColor(status) }]}>
        <Text style={[styles.deliveredText, { color: getStatusTextColor(status) }]}>
          {status || 'Pending'}
        </Text>
      </View>
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // ---------- HEADER ----------
  headerGradient: { 
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 20,
    paddingBottom: 25,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 25, 
    borderBottomRightRadius: 25,
    overflow: 'visible',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  subGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  profileCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)'
  },
  profileInitial: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 20
  },
  statBox: {
    width: '30%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center'
  },
  statNumber: { color: '#FFF', fontSize: 16, fontWeight: '800', marginTop: 4 },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' },

  // ---------- PICKUP CARD ----------
  pickupCard: {
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    marginTop: -30,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  pickupLeft: { flexDirection: "row", alignItems: "center" },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "green", marginRight: 10 },
  pickupTitle: { fontWeight: "600", fontSize: 14, color: "#1A1C1E" },
  pickupAddress: { color: "#777", fontSize: 12, width: 200 },

  // ---------- CONTENT ----------
  contentBody: { paddingHorizontal: 20 },
  scrollContent: { paddingBottom: 24 },
  heroWrapper: { width: '100%', marginTop: 20, alignSelf: 'center' },
  heroCard: {
    borderRadius: 28,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  popularTag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#FF3B30', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  popularText: { color: '#FFF', fontSize: 10, fontWeight: '900', marginLeft: 4 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8, lineHeight: 18, width: '80%' },
  bookNowBtn: { marginTop: 20, width: 160 },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 15 },
  btnText: { color: '#FFF', fontWeight: '800', marginRight: 8 },
  bgIcon: { position: 'absolute', right: -10, bottom: -10 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1A1C1E' },
  viewAll: { fontSize: 14, color: '#ff6600', fontWeight: '700' },

  activeCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  clockIconBg: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  orderInfo: { flex: 1, marginLeft: 12 },
  orderId: { fontSize: 16, fontWeight: '800', color: '#1A1C1E', marginBottom: 6 },
  orderRoute: { fontSize: 12, color: '#8E8E93' },
  verticalRoute: { marginTop: 6, paddingLeft: 2 },
  routeItem: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 3 },
  routeIcon: { marginRight: 6, marginTop: 1, minWidth: 16 },
  routeText: { fontSize: 10, color: '#555', fontWeight: '600', flex: 1, lineHeight: 14 },
  routeDashedLine: { height: 8, width: 2, marginLeft: 7, marginVertical: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#DDD' },
  statusBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { color: '#10B981', fontSize: 11, fontWeight: '800' },

  progressContainer: { marginTop: 15 },
  progressBarBg: { height: 6, backgroundColor: '#F2F2F7', borderRadius: 3 },
  progressBarFill: { height: 6, backgroundColor: '#10B981', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  arrivalText: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
  percentText: { fontSize: 12, color: '#10B981', fontWeight: '800' },

  featureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  featureItem: { alignItems: 'center', width: '22%' },
  featureIconBox: { width: 55, height: 55, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  featureLabel: { fontSize: 11, color: '#4B5563', fontWeight: '700' },

  recentCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginTop: 15 },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentId: { fontSize: 14, fontWeight: '700', color: '#1A1C1E' },
  recentDate: { fontSize: 11, color: '#9CA3AF' },
  deliveredBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  deliveredText: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 15 },

  supportCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 25,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  supportHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  supportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supportHeaderText: { flex: 1 },
  supportTitle: { fontSize: 17, fontWeight: '800', color: '#1A1C1E' },
  supportSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  supportActionsRow: { flexDirection: 'row', gap: 10 },
  supportActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  supportActionIconEmail: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  supportActionIconCall: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  supportActionTextWrap: { flex: 1, minWidth: 0 },
  supportActionLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  supportActionValue: { fontSize: 11, fontWeight: '800', color: '#1A1C1E', marginTop: 2 },
});
