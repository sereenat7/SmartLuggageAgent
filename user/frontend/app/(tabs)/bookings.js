import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, Platform, StatusBar, ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

export default function BookingsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('current');
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const API_URL = `${process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.104:5000'}/api/bookings`;

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert("Not Logged In", "Please log in to view bookings");
        setBookings([]);
        return;
      }

      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success && data.bookings && Array.isArray(data.bookings)) {
        const transformedBookings = data.bookings.map(booking => {
          let formattedDate = 'N/A';
          try {
            if (booking.departure_date) {
              const dateStr = booking.departure_date.trim();
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                formattedDate = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
              } else {
                formattedDate = dateStr;
              }
            }
          } catch (e) {
            formattedDate = booking.departure_date || 'N/A';
          }

          const fullDestination = `${booking.arrival_airport || ''} ${booking.terminal || ''}`.trim() || 'N/A';

          return {
            ...booking,
            booking_id: booking.id || booking.booking_id,
            airline_flight: `${booking.airline_name || 'Unknown'} ${booking.flight_number || ''}`.trim(),
            pickup_display: booking.pickup_address || booking.pickup_area || 'N/A',
            destination_display: fullDestination,
            pickup_date: formattedDate,
            pickup_time_formatted: booking.pickup_time || booking.departure_time || 'N/A',
            amount_paid: booking.amount || booking.amount_paid || booking.total_amount || 0,
            status_type: (booking.status || booking.booking_status || 'pending').toLowerCase(),
          };
        });
        setBookings(transformedBookings);
      } else {
        setBookings([]);
      }
    } catch (error) {
      setBookings([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const getStatusColor = (status) => {
    switch(status) {
      case 'assigned': return { bg: '#FFF3E0', text: '#E65100', label: 'Assigned' };
      case 'in transit': case 'picked': return { bg: '#E3F2FD', text: '#1565C0', label: 'In Transit' };
      case 'delivered': case 'completed': return { bg: '#E8F5E9', text: '#2E7D32', label: 'Delivered' };
      default: return { bg: '#F5F5F5', text: '#616161', label: status };
    }
  };

  const filteredBookings = bookings.filter(item => {
    if (activeTab === 'current') {
      return !['delivered', 'completed'].includes(item.status_type);
    } else {
      return ['delivered', 'completed'].includes(item.status_type);
    }
  });

  const renderBookingCard = ({ item }) => {
    const statusColor = getStatusColor(item.status_type);
    
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => router.push({
          pathname: '/booking-details',
          params: { bookingId: item.booking_id }
        })}
        activeOpacity={0.8}
      >
        <View style={styles.cardInternal}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.bookingId}>Booking #{item.booking_id}</Text>
              <Text style={styles.flightInfo}>{item.airline_flight}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>{statusColor.label}</Text>
            </View>
          </View>

          <View style={styles.routeSectionVertical}>
            <Text style={styles.routeLabel}>Route</Text>
            
            <View style={styles.routeRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color="#ff0033" />
              <Text style={styles.pickupText} numberOfLines={1}>{item.pickup_display}</Text>
            </View>

            <View style={styles.lineContainer}>
              <View style={styles.dottedLine} />
            </View>

            <View style={styles.routeRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color="#ff6600" />
              <Text style={styles.airportText} numberOfLines={1}>{item.destination_display}</Text>
            </View>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.metaInfo}>
              <MaterialCommunityIcons name="calendar-clock" size={14} color="#666" />
              <Text style={styles.footerText}>{item.pickup_date} • {item.pickup_time_formatted}</Text>
            </View>
            <Text style={styles.amountText}>₹{item.amount_paid}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'current' && styles.activeTabBtn]} 
          onPress={() => setActiveTab('current')}
        >
          <Text style={[styles.tabText, activeTab === 'current' && styles.activeTabText]}>Current</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'history' && styles.activeTabBtn]} 
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>History</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff0033" />
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => String(item.booking_id)}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchBookings();}} tintColor="#ff0033" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="briefcase-variant-outline" size={60} color="#E5E7EB" />
              <Text style={styles.emptyText}>No {activeTab} bookings</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1A1C1E' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#E5E7EB', marginHorizontal: 24, marginVertical: 15, borderRadius: 14, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  activeTabBtn: { backgroundColor: '#FFF', elevation: 3 },
  tabText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  activeTabText: { color: '#ff0033' },
  listContent: { paddingHorizontal: 24, paddingBottom: 30 },
  card: { 
    marginBottom: 16, 
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F1F1',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 }
  },
  cardInternal: { padding: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  bookingId: { fontSize: 16, fontWeight: '800', color: '#1A1C1E' },
  flightInfo: { fontSize: 13, fontWeight: '600', color: '#ff6600', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  
  routeSectionVertical: { marginBottom: 15 },
  routeLabel: { fontSize: 10, fontWeight: '800', color: '#888', textTransform: 'uppercase', marginBottom: 8 },
  
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  lineContainer: { width: 18, alignItems: 'center', marginVertical: 2 },
  dottedLine: {
    width: 1,
    height: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 1,
  },
  pickupText: { fontSize: 14, fontWeight: '700', color: '#333', marginLeft: 10, flex: 1 },
  airportText: { fontSize: 14, fontWeight: '700', color: '#333', marginLeft: 10, flex: 1 },
  
  footerRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#FAFAFA'
  },
  metaInfo: { flexDirection: 'row', alignItems: 'center' },
  footerText: { marginLeft: 6, fontSize: 12, fontWeight: '600', color: '#666' },
  amountText: { fontSize: 18, fontWeight: '900', color: '#1A1C1E' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 15, color: '#9CA3AF', fontSize: 16, fontWeight: '600' }
});