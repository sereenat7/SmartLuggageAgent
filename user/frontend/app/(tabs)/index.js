import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  SafeAreaView, StatusBar, Platform 
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

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

  const displayInitial = displayName.charAt(0).toUpperCase();
  const API_URL = `${process.env.EXPO_PUBLIC_API_URL || 'http://172.16.111.44:5000'}/api/bookings`;

  // Fetch latest booking
  const fetchLatestBooking = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success && data.bookings && data.bookings.length > 0) {
        const latest = data.bookings[0];
        setActiveBooking(latest);
      }
    } catch (error) {
      console.error("Error fetching active booking:", error);
    }
  };

  // Fetch recent bookings
  const fetchRecentBookings = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success && data.bookings) {
        setRecentBookings(data.bookings.slice(0, 3));
      }
    } catch (error) {
      console.error("Error fetching recent bookings:", error);
    }
  };

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
    fetchLatestBooking();
    fetchRecentBookings();
  }, [params?.userName]);

  useFocusEffect(
  useCallback(() => {
    // When focusing on homepage, load name and location from AsyncStorage
    const loadDataOnFocus = async () => {
      try {
        // Load name
        const savedName = await AsyncStorage.getItem("userName");
        if (savedName) {
          setDisplayName(savedName);
        }
        
        // Load pickup location
        const saved = await AsyncStorage.getItem("pickupDetails");
        if (saved) {
          const data = JSON.parse(saved);
          if (data.address) {
            setPickupAddress(data.address);
            setUserSelectedPickup(data.userSelected || false);
            return;
          }
        }
        
        // Only fetch if NO location saved at all
        await loadPickup();
        
        // Fetch bookings on focus
        await fetchLatestBooking();
        await fetchRecentBookings();
      } catch (e) {
        console.log("Error in useFocusEffect:", e);
      }
    };
    
    loadDataOnFocus();
  }, [])
);
  // When user manually selects a pickup
  const onUserSelectPickup = async (address) => {
    setPickupAddress(address);
    setUserSelectedPickup(true);
    await AsyncStorage.setItem("pickupDetails", JSON.stringify({ userSelected: true, address }));
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

  // Format airport with terminal dynamically
  const formatAirportDestination = (booking) => {
    if (!booking) return 'Airport';
    
    // Use arrival_airport from database (fully dynamic)
    const airport = booking.arrival_airport || booking.departure_city || 'Airport';
    const terminal = booking.terminal ? ` ${booking.terminal}` : '';
    
    return `${airport}${terminal}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
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
            <View style={styles.activeCard}>
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

                <View style={[styles.statusBadge, { backgroundColor: activeBooking.booking_status === 'assigned' ? '#FFF3CD' : activeBooking.booking_status === 'in transit' ? '#D1ECF1' : '#D4EDDA' }]}>
                  <Text style={[styles.statusText, { color: activeBooking.booking_status === 'assigned' ? '#856404' : activeBooking.booking_status === 'in transit' ? '#0C5460' : '#155724' }]}>
                    {activeBooking.booking_status ? activeBooking.booking_status.charAt(0).toUpperCase() + activeBooking.booking_status.slice(1) : 'Assigned'}
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: activeBooking.booking_status === 'assigned' ? '25%' : activeBooking.booking_status === 'in transit' ? '65%' : '100%' }]} />
                </View>

                <View style={styles.progressLabels}>
                  <Text style={styles.arrivalText}>{activeBooking.booking_status === 'assigned' ? 'Getting ready...' : activeBooking.booking_status === 'in transit' ? 'Arriving soon...' : 'Completed'}</Text>
                  <Text style={styles.percentText}>{activeBooking.booking_status === 'assigned' ? '25%' : activeBooking.booking_status === 'in transit' ? '65%' : '100%'}</Text>
                </View>
              </View>
            </View>
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
                  <RecentItem 
                    id={`#${booking.id}`} 
                    date={formatDate(booking.created_at)}
                    status={booking.booking_status ? booking.booking_status.charAt(0).toUpperCase() + booking.booking_status.slice(1) : 'Completed'}
                  />
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

          <View style={{ height: 100 }} />
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
  return (
    <View style={styles.recentRow}>
      <View>
        <Text style={styles.recentId}>{id}</Text>
        <Text style={styles.recentDate}>{date}</Text>
      </View>
      <View style={[styles.deliveredBadge, { backgroundColor: status === 'Assigned' ? '#FFF3CD' : status === 'In transit' ? '#D1ECF1' : '#D4EDDA' }]}>
        <Text style={[styles.deliveredText, { color: status === 'Assigned' ? '#856404' : status === 'In transit' ? '#0C5460' : '#155724' }]}>
          {status || 'Delivered'}
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

  recentCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginTop: 15, marginBottom: 20 },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentId: { fontSize: 14, fontWeight: '700', color: '#1A1C1E' },
  recentDate: { fontSize: 11, color: '#9CA3AF' },
  deliveredBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  deliveredText: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 15 },
});

