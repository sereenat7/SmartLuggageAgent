import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, Platform, StatusBar, ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'history'
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Replace with your actual backend URL
  const API_URL = "http://10.166.255.52:5000/api/bookings"; 

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        console.warn("❌ No auth token found. User may not be logged in.");
        Alert.alert("Not Logged In", "Please log in to view bookings");
        setBookings([]);
        return;
      }

      // Decode token logic (Kept exactly as provided)
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [phone] = decoded.split(':');
        console.log('📱 Fetching bookings for phone:', phone);
      } catch (e) {
        console.log('Could not decode token');
      }

      const response = await axios.get(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log('📦 API Response - Bookings count:', response.data?.bookings?.length || 0);

      if (response.data.success && response.data.bookings && response.data.bookings.length > 0) {
        const transformedBookings = response.data.bookings.map(booking => ({
          ...booking,
          id: booking.id,
          flight: `${booking.airline_name || 'Unknown'}-${booking.flight_number || ''}`.trim(),
          date: booking.departure_date ? new Date(booking.departure_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : 'N/A',
          time: booking.pickup_time || booking.departure_time || 'N/A',
          address: booking.pickup_address || 'N/A',
          status: booking.status === 'pending' ? 'active' : (booking.status === 'completed' ? 'completed' : 'active'),
        }));
        setBookings(transformedBookings);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.error("❌ Error fetching bookings:", error.message);
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

  const filteredBookings = bookings.filter(item => {
    const matches = activeTab === 'current' ? item.status === 'active' : item.status === 'completed';
    return matches;
  });

  const renderBookingCard = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.flightBadge}>
          <Ionicons name="airplane" size={14} color="#FF3B2F" />
          <Text style={styles.flightText}>{item.flight}</Text>
        </View>
        <Text style={styles.dateText}>{item.date}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={18} color="#6B7280" />
          <Text style={styles.infoLabel}>Pickup Time:</Text>
          <Text style={styles.infoValue}>{item.time}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={18} color="#6B7280" />
          <Text style={styles.infoLabel}>From:</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{item.address}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={[styles.statusTag, item.status === 'active' ? styles.activeTag : styles.completedTag]}>
          {item.status === 'active' ? 'In Transit' : 'Delivered'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#999" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" translucent />
      
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
          <ActivityIndicator size="large" color="#FF3B2F" />
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchBookings();}} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={60} color="#E5E7EB" />
              <Text style={styles.emptyText}>No {activeTab} bookings found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F9FAFB',
    // Adds padding to avoid the Status Bar area on Android
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
  },
  header: { 
    paddingHorizontal: 20, 
    paddingTop: 20,     // Pushes "My Bookings" down from the top edge
    paddingBottom: 15, 
    backgroundColor: '#FFF' 
  },
  headerTitle: { 
    fontSize: 28,      // Increased size slightly for better visibility
    fontWeight: '800', 
    color: '#1A1C1E',
    marginTop: 5       // Fine-tuned alignment
  },
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#F3F4F6', 
    marginHorizontal: 20, 
    marginVertical: 15, 
    borderRadius: 12, 
    padding: 4 
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTabBtn: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  activeTabText: { color: '#FF3B2F' },
  listContent: { paddingHorizontal: 20, paddingBottom: 30 },
  card: { 
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: '#E5E7EB' 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  flightBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  flightText: { marginLeft: 5, color: '#FF3B2F', fontWeight: '700', fontSize: 12 },
  dateText: { color: '#9CA3AF', fontSize: 12 },
  cardBody: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', paddingVertical: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoLabel: { marginLeft: 10, fontSize: 13, color: '#6B7280', width: 90 },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1A1C1E', flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  statusTag: { fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, textTransform: 'uppercase' },
  activeTag: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
  completedTag: { backgroundColor: '#D1FAE5', color: '#065F46' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 15, color: '#9CA3AF', fontSize: 16, fontWeight: '500' }
});