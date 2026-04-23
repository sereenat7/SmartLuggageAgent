﻿// screens/DashboardScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Colors from '../constants/colors';

import { API_URL } from '../config';
import { USER_API_URL } from '../config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_SMALL_DEVICE = SCREEN_WIDTH < 380;
const FETCH_TIMEOUT_MS = 7000;
const LOCATION_PING_INTERVAL_MS = 15000;

const mockTasks = [];

export default function DashboardScreen({ navigation, route }) {
  const [agentProfile, setAgentProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('Assigned');
  const [fullAgentData, setFullAgentData] = useState(null);
  const [tasks, setTasks] = useState(mockTasks);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState('');
  const [waitingRequests, setWaitingRequests] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [locationLabel, setLocationLabel] = useState('Location not synced');
  const [locationSyncStatus, setLocationSyncStatus] = useState('idle');
  
  // Get token and basic user info from login params
  const { token, user } = route.params || {};

  // Fetch KYC details on mount
  React.useEffect(() => {
    if (!token) {
        console.log('Dashboard: No token available');
        return;
    }

    const fetchProfile = async () => {
      try {
        console.log('Dashboard: Fetching KYC profile...');
        const resp = await fetch(`${API_URL}/api/kyc`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (resp.ok) {
          const data = await parseMaybeJson(resp);
          console.log('Dashboard: Fetched KYC Data:', data);
          // The backend returns { kyc: {...}, files: [...] }
          // We only need the nested kyc object for profile display
          if (data.kyc) {
             setFullAgentData(data.kyc);
          }
        } else {
            console.log('Dashboard: Failed to fetch profile', resp.status);
        }
      } catch (err) {
        console.log('Error fetching profile:', err);
      }
    };
    fetchProfile();
  }, [token]);

  React.useEffect(() => {
    if (!token) {
      return;
    }

    const fetchAgentAccount = async () => {
      try {
        const resp = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) {
          return;
        }
        const data = await parseMaybeJson(resp);
        if (data?.user) {
          setAgentProfile(data.user);
        }
      } catch (error) {
        console.log('Dashboard: failed to load /api/me profile', error.message);
      }
    };

    fetchAgentAccount();
  }, [token]);

  // Build one unified view model from login, account and KYC sources.
  const displayData = {
    ...(user || {}),
    ...(agentProfile || {}),
    ...(fullAgentData || {}),
  };

  const parseMaybeJson = async (response) => {
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    if (!contentType.includes('application/json') || !rawText) {
      return { message: rawText };
    }

    try {
      return JSON.parse(rawText);
    } catch (_error) {
      return { message: rawText };
    }
  };

  const fetchWithTimeout = useCallback(async (url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const fetchInbox = useCallback(async () => {
    try {
      setInboxLoading(true);
      setInboxError('');
      // Fetch pending bookings from user backend
      const inboxUrl = new URL(`${USER_API_URL}/api/bookings/inbox`);
      const resp = await fetchWithTimeout(inboxUrl.toString());
      const data = await parseMaybeJson(resp);
      if (resp.ok && data.success) {
        setWaitingRequests(Array.isArray(data.waiting) ? data.waiting : []);
        setActiveSessions(Array.isArray(data.activeSessions) ? data.activeSessions : []);
      } else {
        throw new Error(data.message || `Inbox request failed (${resp.status})`);
      }
    } catch (error) {
      setWaitingRequests([]);
      setActiveSessions([]);
      if (error.name === 'AbortError') {
        setInboxError('Request timed out. Check user backend on port 5000.');
      } else {
        setInboxError(error.message || 'Unable to load assigned requests');
      }
      console.log('Dashboard: inbox fetch failed', error.message);
    } finally {
      setInboxLoading(false);
    }
  }, [fetchWithTimeout]);

  useEffect(() => {
    fetchInbox();
    const timer = setInterval(fetchInbox, 5000);
    return () => clearInterval(timer);
  }, [fetchInbox]);

  const respondToRequest = async (request, action) => {
    try {
      setActionLoadingId(request.queueId);
      // user.id belongs to agent auth DB, while preferredAgentId belongs to matcher DB.
      // Use the matcher ID first to avoid cross-database ID mismatch errors.
      const resolvedAgentId = request?.preferredAgentId || user?.id;
      const resp = await fetchWithTimeout(`${USER_API_URL}/api/agents/respond-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueId: request.queueId,
          action,
          agentId: resolvedAgentId,
          agentName: displayData?.fullName || user?.fullName || '',
          agentPhone: displayData?.phone || displayData?.mobile || user?.mobile || user?.phone || null,
        }),
      });

      const data = await parseMaybeJson(resp);
      if (!resp.ok || data.success === false) {
        throw new Error(data.message || 'Request update failed');
      }

      await fetchInbox();
      if (action === 'accept') {
        const acceptedSession = {
          sessionId: data?.session?.sessionId || `queue-${request.queueId}`,
          bookingId: data?.session?.bookingId || request?.bookingId || null,
          userId: data?.session?.userId || request?.userId || null,
          userName: data?.session?.userName || request?.name || 'Customer',
          userPhone: data?.session?.userPhone || request?.phone || null,
          agentId: data?.session?.agentId || resolvedAgentId || null,
          agentName: data?.session?.agentName || displayData?.fullName || user?.fullName || 'Agent',
          agentPhone: data?.session?.agentPhone || displayData?.phone || displayData?.mobile || user?.mobile || user?.phone || null,
          pickupLocation: request?.pickupAddress || 'Pickup location pending',
          pickupLatitude: request?.pickupLatitude || null,
          pickupLongitude: request?.pickupLongitude || null,
          dropLocation: request?.dropAddress || 'Drop location pending',
          dropLatitude: request?.dropLatitude || null,
          dropLongitude: request?.dropLongitude || null,
          timeSlot: request?.pickupTime || 'Time slot pending',
          luggage: Number(request?.bagCount || 1),
          bagWeight: request?.bagWeight || null,
          airlineName: request?.airlineName || null,
          flightNumber: request?.flightNumber || null,
          terminal: request?.terminal || null,
          departureCity: request?.departureCity || null,
          arrivalCity: request?.arrivalCity || null,
          additionalInfo: request?.additionalInfo || null,
          status: 'in-progress',
        };

        setWaitingRequests((prevRequests) => prevRequests.filter((item) => item.queueId !== request.queueId));
        setActiveSessions((prevSessions) => {
          const filteredSessions = prevSessions.filter((session) => session.sessionId !== acceptedSession.sessionId);
          return [acceptedSession, ...filteredSessions];
        });
        setActiveTab('In Progress');
      }
    } catch (error) {
      const message = error.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : (error.message || 'Please try again');
      Alert.alert('Request update failed', message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptTask = (taskId) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId ? { ...task, status: 'in-progress' } : task
      )
    );
    // Optionally switch tab to show the progress
    setActiveTab('In Progress');
  };

  const handleDeclineTask = (taskId) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'Assigned') return task.status === 'assigned';
    if (activeTab === 'In Progress') return task.status === 'in-progress';
    if (activeTab === 'Completed') return task.status === 'completed';
    return true;
  });

  const getTaskCount = (status) => {
    if (status === 'assigned') {
      return waitingRequests.length;
    }

    if (status === 'in-progress') {
      return activeSessions.length + tasks.filter(task => task.status === status).length;
    }

    return tasks.filter(task => task.status === status).length;
  };

  const buildTaskFromSession = (session) => ({
    id: `session-${session.sessionId}`,
    sessionId: session.sessionId,
    agentName: session.userName || 'Customer',
    agentId: `USR${session.userId || ''}`,
    type: 'Pickup',
    pickupLocation: session.pickupLocation || 'Pickup location pending',
    dropLocation: session.dropLocation || 'Drop location pending',
    timeSlot: session.timeSlot || 'Time slot pending',
    luggage: Number(session.luggage || 1),
    status: 'in-progress',
    phoneNumber: session.userPhone || '',
  });

  const pingAgentLocation = useCallback(async () => {
    try {
      setLocationSyncStatus('syncing');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationSyncStatus('denied');
        setLocationLabel('Location permission denied');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geo?.[0]) {
          const place = [geo[0].name, geo[0].street, geo[0].city].filter(Boolean).join(', ');
          setLocationLabel(place || 'Location synced');
        } else {
          setLocationLabel('Location synced');
        }
      } catch (_geoErr) {
        setLocationLabel('Location synced');
      }

      const resp = await fetchWithTimeout(`${USER_API_URL}/api/agents/agent-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: user?.id,
          phone: user?.mobile || displayData?.mobile || displayData?.phone || null,
          name: displayData?.fullName || user?.fullName || 'Agent',
          latitude: lat,
          longitude: lng,
          vehicleType: fullAgentData?.vehicle_type || null,
        }),
      });

      const payload = await parseMaybeJson(resp);
      if (!resp.ok || payload.success === false) {
        throw new Error(payload.message || 'Failed to sync location');
      }

      setLocationSyncStatus('ok');
    } catch (error) {
      setLocationSyncStatus('error');
      if (error.name === 'AbortError') {
        setLocationLabel('Location sync timeout');
      }
      console.log('Dashboard: location ping failed', error.message);
    }
  }, [displayData?.fullName, displayData?.mobile, displayData?.phone, fetchWithTimeout, user?.id, user?.mobile, user?.fullName, fullAgentData?.vehicle_type]);

  useEffect(() => {
    pingAgentLocation();
    const timer = setInterval(pingAgentLocation, LOCATION_PING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pingAgentLocation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>My Tasks</Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Profile', { agentData: displayData, token: token })}
            style={styles.profileButton}
          >
            <Ionicons name="person-circle-outline" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>

        <View style={styles.agentIdentityCard}>
          <LinearGradient
            colors={['rgba(255, 196, 144, 0.35)', 'rgba(255, 255, 255, 0.14)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.agentIdentityGradient}
          >
            <Text style={styles.agentIdentityName} numberOfLines={1}>
              {displayData?.fullName || displayData?.full_name || 'Agent'}
            </Text>

            <View style={styles.agentMetaRow}>
              <View style={styles.agentMetaPill}>
                <Ionicons name="id-card-outline" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.agentIdentityMeta} numberOfLines={1}>
                  ID: {displayData?.id || user?.id || 'N/A'}
                </Text>
              </View>
              <View style={styles.agentMetaPill}>
                <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.agentIdentityMeta} numberOfLines={1}>
                  {displayData?.mobile || displayData?.phone || user?.mobile || user?.phone || 'N/A'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <TouchableOpacity activeOpacity={0.88} style={styles.statCardTouch}>
            <LinearGradient
              colors={['#FF8A33', '#FF6F1A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCard}
            >
              <Text style={styles.statNumber}>{getTaskCount('assigned')}</Text>
              <Text style={styles.statLabel}>Assigned</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.88} style={styles.statCardTouch}>
            <LinearGradient
              colors={['#FF8A33', '#FF6F1A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCard}
            >
              <Text style={styles.statNumber}>{getTaskCount('in-progress')}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.88} style={styles.statCardTouch}>
            <LinearGradient
              colors={['#FF8A33', '#FF6F1A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCard}
            >
              <Text style={styles.statNumber}>{getTaskCount('completed')}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.locationBanner} activeOpacity={0.85} onPress={pingAgentLocation}>
          <View style={styles.locationLeft}>
            <Ionicons name="location-sharp" size={18} color="#21B573" />
            <View style={styles.locationTextBlock}>
              <Text style={styles.locationBannerTitle}>Current Location</Text>
              <Text style={styles.locationBannerText} numberOfLines={1}>{locationLabel || 'Location not synced'}</Text>
            </View>
          </View>
          <View style={styles.locationRight}>
            <Ionicons name="chevron-forward" size={18} color="#8A9099" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {['Assigned', 'In Progress', 'Completed'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tasks List */}
      <ScrollView style={styles.tasksList} showsVerticalScrollIndicator={false}>
        {activeTab === 'Assigned' ? (
          <>
            {inboxLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="small" color={Colors.buttonPrimary} />
                <Text style={[styles.emptyText, styles.emptySpacing]}>Loading assigned requests...</Text>
              </View>
            ) : waitingRequests.length > 0 ? (
              waitingRequests.map((request) => (
                <RequestCard
                  key={request.queueId}
                  request={request}
                  loading={actionLoadingId === request.queueId}
                  onAccept={() => respondToRequest(request, 'accept')}
                  onDecline={() => respondToRequest(request, 'decline')}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {inboxError || 'No assigned requests right now'}
                </Text>
              </View>
            )}
          </>
        ) : activeTab === 'In Progress' ? (
          <>
            {activeSessions.length > 0 ? (
              activeSessions.map((session) => (
                <InProgressSessionCard
                  key={session.sessionId}
                  session={session}
                  onViewTask={() => navigation.navigate('TaskDetails', { task: buildTaskFromSession(session) })}
                />
              ))
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onPress={() => navigation.navigate('TaskDetails', { task })}
                  onAccept={() => handleAcceptTask(task.id)}
                  onDecline={() => handleDeclineTask(task.id)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No tasks in this category</Text>
              </View>
            )}
          </>
        ) : (
          filteredTasks.length > 0 ? (
            filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onPress={() => navigation.navigate('TaskDetails', { task })}
                onAccept={() => handleAcceptTask(task.id)}
                onDecline={() => handleDeclineTask(task.id)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No tasks in this category</Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
    </SafeAreaView>
  );
}

function RequestCard({ request, loading, onAccept, onDecline }) {
  const distanceText = Number.isFinite(Number(request.distanceKm))
    ? `${Number(request.distanceKm).toFixed(1)} km away`
    : null;
  const etaText = Number.isFinite(Number(request.etaMinutes))
    ? `${Math.max(1, Number(request.etaMinutes))} min ETA`
    : null;
  const leaveByText = request.leaveByAt
    ? `Leave by ${new Date(request.leaveByAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : null;
  const urgencyText = Number.isFinite(Number(request.urgencyMinutes))
    ? (Number(request.urgencyMinutes) <= 0
      ? 'Leave now'
      : `Leave in ${Number(request.urgencyMinutes)} min`)
    : null;

  const bookingSummary = [
    request.airlineName ? request.airlineName : null,
    request.flightNumber ? `Flight ${request.flightNumber}` : null,
    request.terminal ? `Terminal ${request.terminal}` : null,
  ].filter(Boolean).join(' • ');

  const bagDetails = [
    request.bagCount ? `${request.bagCount} bag${Number(request.bagCount) === 1 ? '' : 's'}` : null,
    request.bagWeight ? `${request.bagWeight}` : null,
    request.isFragile ? '⚠️ Fragile' : null,
    request.isCheckin ? '✓ Checkin' : null,
  ].filter(Boolean).join(' • ');

  const timingInfo = [
    request.pickupTime ? `Pickup: ${request.pickupTime}` : null,
    request.departureCity ? `From: ${request.departureCity}` : null,
    request.arrivalCity ? `To: ${request.arrivalCity}` : null,
  ].filter(Boolean).join(' • ');

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestAvatar}>
          <Text style={styles.requestAvatarText}>{(request.name || 'U').charAt(0)}</Text>
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{request.name || 'Unknown user'}</Text>
          <Text style={styles.requestMeta}>{request.phone || 'No phone'}</Text>
        </View>
        <Text style={styles.requestStatus}>Assigned</Text>
      </View>

      {bookingSummary ? <Text style={styles.requestDescription}>{bookingSummary}</Text> : null}
      {bagDetails ? <Text style={styles.requestMeta}>Luggage: {bagDetails}</Text> : null}
      {timingInfo ? <Text style={styles.requestMeta}>{timingInfo}</Text> : null}
      {request.pickupAddress ? <Text style={styles.requestMeta}>📍 {request.pickupAddress}</Text> : null}
      {request.additionalInfo ? <Text style={styles.requestMeta}>Notes: {request.additionalInfo}</Text> : null}
      {(distanceText || etaText || leaveByText) ? (
        <Text style={styles.requestTimingMeta}>{[distanceText, etaText, leaveByText].filter(Boolean).join(' • ')}</Text>
      ) : null}
      {urgencyText ? <Text style={styles.requestUrgency}>{urgencyText}</Text> : null}

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton, loading && styles.actionButtonDisabled]}
          onPress={onAccept}
          disabled={loading}
        >
          <Text style={styles.acceptButtonText}>{loading ? 'Working...' : 'Accept'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton, loading && styles.actionButtonDisabled]}
          onPress={onDecline}
          disabled={loading}
        >
          <Text style={styles.declineButtonText}>{loading ? 'Working...' : 'Decline'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InProgressSessionCard({ session, onViewTask }) {
  const tripSummary = [
    session.airlineName ? session.airlineName : null,
    session.flightNumber ? `Flight ${session.flightNumber}` : null,
    session.terminal ? `Terminal ${session.terminal}` : null,
  ].filter(Boolean).join(' • ');

  const routeSummary = [
    session.departureCity ? `From ${session.departureCity}` : null,
    session.arrivalCity ? `To ${session.arrivalCity}` : null,
    session.timeSlot ? `Pickup ${session.timeSlot}` : null,
  ].filter(Boolean).join(' • ');

  const luggageSummary = [
    session.luggage ? `${session.luggage} bag${Number(session.luggage) === 1 ? '' : 's'}` : null,
    session.bagWeight ? session.bagWeight : null,
  ].filter(Boolean).join(' • ');

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestAvatar}>
          <Text style={styles.requestAvatarText}>{(session.userName || 'U').charAt(0)}</Text>
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{session.userName || 'Unknown user'}</Text>
          <Text style={styles.requestMeta}>{session.userPhone || 'No phone'}</Text>
        </View>
        <Text style={styles.requestStatus}>Active</Text>
      </View>

      <Text style={styles.requestDescription}>
        Assigned to {session.agentName || 'Agent'} and currently in progress.
      </Text>

      {tripSummary ? <Text style={styles.requestMeta}>{tripSummary}</Text> : null}
      {routeSummary ? <Text style={styles.requestMeta}>{routeSummary}</Text> : null}
      {session.pickupLocation ? <Text style={styles.requestMeta}>📍 {session.pickupLocation}</Text> : null}
      {session.dropLocation ? <Text style={styles.requestMeta}>To: {session.dropLocation}</Text> : null}
      {luggageSummary ? <Text style={styles.requestMeta}>Luggage: {luggageSummary}</Text> : null}
      {session.additionalInfo ? <Text style={styles.requestMeta}>Notes: {session.additionalInfo}</Text> : null}

      <TouchableOpacity style={styles.viewTaskButton} onPress={onViewTask}>
        <Text style={styles.viewTaskText}>View Task</Text>
      </TouchableOpacity>
    </View>
  );
}

function TaskCard({ task, onPress, onAccept, onDecline }) {
  const getTypeColor = (type) => {
    return type === 'Pickup' ? '#7C3AED' : '#10B981';
  };

  return (
    <TouchableOpacity style={styles.taskCard} onPress={onPress}>
      {/* Agent Avatar & Info */}
      <View style={styles.agentSection}>
        <View style={[styles.avatar, { backgroundColor: getTypeColor(task.type) }]}>
          <Text style={styles.avatarText}>
            {task.agentName.split(' ').map(n => n[0]).join('')}
          </Text>
        </View>
        <View style={styles.agentInfo}>
          <Text style={styles.agentName}>{task.agentName}</Text>
          <Text style={styles.agentId}>{task.agentId}</Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(task.type) }]}>
          <Text style={styles.typeText}>{task.type}</Text>
        </View>
      </View>

      {/* Location Info */}
      <View style={styles.locationSection}>
        <View style={styles.locationItem}>
          <Text style={styles.locationIcon}>Current Location</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {task.pickupLocation}
          </Text>
        </View>
        <View style={styles.locationItem}>
          <Text style={styles.locationIcon}>To</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {task.dropLocation}
          </Text>
        </View>
      </View>

      {/* Time & Luggage */}
      <View style={styles.bottomSection}>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>Time</Text>
          <Text style={styles.infoText}>{task.timeSlot}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>ID</Text>
          <Text style={styles.infoText}>{task.luggage} bags</Text>
        </View>
      </View>

      {/* Status Badge */}
      {task.status === 'in-progress' && task.weight && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Weight updated: {task.weight} kg</Text>
        </View>
      )}

      {task.status === 'completed' && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>OTP Verified</Text>
        </View>
      )}

      {/* Actions */}
      {task.status === 'assigned' ? (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.acceptButton]}
            onPress={onAccept}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.declineButton]}
            onPress={onDecline}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.viewTaskButton} onPress={onPress}>
          <Text style={styles.viewTaskText}>View Task</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ff6600',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: '#ff6600',
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: IS_SMALL_DEVICE ? 12 : 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: 'relative',
  },
  agentIdentityCard: {
    marginTop: 8,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#AD3F00',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 7,
  },
  agentIdentityGradient: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  agentIdentityName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  agentMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  agentMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  agentIdentityMeta: {
    marginLeft: 5,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '600',
  },
  inboxContainer: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  inboxHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inboxTitle: {
    fontSize: IS_SMALL_DEVICE ? 15 : 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  inboxCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inboxSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  inboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  inboxName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  inboxMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inboxBadge: {
    backgroundColor: '#FFF3E8',
    color: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: '#E8FFF2',
    color: '#0F8A4B',
  },
  inboxEmpty: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingVertical: 8,
  },
  emptySpacing: {
    marginTop: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerTitle: {
    fontSize: IS_SMALL_DEVICE ? 18 : 20,
    fontWeight: '700',
    color: Colors.textWhite,
    flex: 1,
  },
  profileButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBanner: {
    position: 'absolute',
    left: IS_SMALL_DEVICE ? 12 : 16,
    right: IS_SMALL_DEVICE ? 12 : 16,
    bottom: -30,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    zIndex: 5,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  locationTextBlock: {
    flex: 1,
    marginLeft: 10,
  },
  locationBannerTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  locationBannerText: {
    color: '#7E838B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  locationRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginHorizontal: -2,
  },
  statCardTouch: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 16,
    shadowColor: '#8F3400',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  statCard: {
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.94)',
    marginTop: 3,
    fontWeight: '700',
  },
  tabsContainer: {
    marginTop: 34,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.buttonPrimary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.buttonPrimary,
  },
  tasksList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  taskCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  agentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  agentId: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    color: Colors.textWhite,
    fontSize: 11,
    fontWeight: '600',
  },
  locationSection: {
    marginBottom: 12,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  bottomSection: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  infoIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  infoText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
  },
  statusText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '500',
  },
  viewTaskButton: {
    backgroundColor: Colors.buttonPrimary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewTaskText: {
    color: Colors.textWhite,
    fontWeight: '600',
    fontSize: 14,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: Colors.buttonPrimary,
  },
  declineButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonDisabled: {
    opacity: 0.65,
  },
  acceptButtonText: {
    color: Colors.textWhite,
    fontWeight: '600',
    fontSize: 14,
  },
  declineButtonText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  requestCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: Colors.buttonPrimary,
  },
  requestAvatarText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  requestMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  requestStatus: {
    backgroundColor: '#FFF3E8',
    color: Colors.buttonPrimary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  requestDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  requestTimingMeta: {
    fontSize: 12,
    color: '#0E7A43',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 6,
  },
  requestUrgency: {
    fontSize: 12,
    color: '#C2410C',
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});