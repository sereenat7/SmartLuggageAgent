/**
 * Booking Synchronization Diagnostic
 * Verify real-time tracking synchronization between agent and user
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';

export const DIAGNOSTIC_LOG = {
  logs: [],
  maxLogs: 100,

  add(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('en-IN');
    const logEntry = {
      timestamp,
      level, // 'INFO', 'DEBUG', 'ERROR', 'SUCCESS'
      message,
      data,
    };

    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    const color = {
      INFO: '🔵',
      DEBUG: '⚪',
      ERROR: '🔴',
      SUCCESS: '🟢',
    }[level] || '⚪';

    console.log(`${color} [${timestamp}] [${level}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },

  getLogs() {
    return this.logs;
  },

  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  },

  clear() {
    this.logs = [];
  },
};

/**
 * Verify booking sync is working
 */
export const verifyBookingSyncHealth = async (bookingId, token) => {
  DIAGNOSTIC_LOG.add('DEBUG', 'Starting booking sync verification', { bookingId });

  try {
    // Step 1: Check if token exists
    if (!token) {
      DIAGNOSTIC_LOG.add('ERROR', 'No auth token found', null);
      return false;
    }
    DIAGNOSTIC_LOG.add('SUCCESS', 'Auth token verified');

    // Step 2: Fetch booking directly
    const bookingUrl = `${API_BASE_URL}/api/bookings/${bookingId}?_ts=${Date.now()}`;
    DIAGNOSTIC_LOG.add('DEBUG', 'Fetching booking', { url: bookingUrl });

    const response = await fetch(bookingUrl, {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      DIAGNOSTIC_LOG.add('ERROR', `Fetch failed with status ${response.status}`, null);
      return false;
    }

    const data = await response.json();
    if (!data.success) {
      DIAGNOSTIC_LOG.add('ERROR', 'API returned success=false', { message: data.message });
      return false;
    }

    DIAGNOSTIC_LOG.add('SUCCESS', 'Booking fetched successfully', {
      bookingId: data.booking?.id,
      status: data.booking?.status,
      assignment_status: data.booking?.assignment_status,
      created_at: data.booking?.created_at,
      assigned_at: data.booking?.assigned_at,
    });

    return true;
  } catch (error) {
    DIAGNOSTIC_LOG.add('ERROR', 'Verification failed', { message: error?.message });
    return false;
  }
};

/**
 * Log booking state
 */
export const logBookingState = (booking, stage) => {
  const status = booking?.status || 'unknown';
  const assignmentStatus = booking?.assignment_status || 'unknown';

  DIAGNOSTIC_LOG.add('INFO', `Booking Stage: ${stage}`, {
    status,
    assignment_status: assignmentStatus,
    booking_id: booking?.id,
    assigned_agent_id: booking?.assigned_agent_id,
    created_at: booking?.created_at,
    assigned_at: booking?.assigned_at,
    pickup_started_at: booking?.pickup_started_at,
    pickup_completed_at: booking?.pickup_completed_at,
    delivered_at: booking?.delivered_at,
  });
};

/**
 * Export diagnostics for debugging
 */
export const exportDiagnostics = async () => {
  try {
    const logs = DIAGNOSTIC_LOG.exportLogs();
    const timestamp = new Date().toISOString();
    const diagnostics = {
      timestamp,
      logs,
      apiUrl: API_BASE_URL,
    };

    // Save to AsyncStorage for later retrieval
    await AsyncStorage.setItem('booking_sync_diagnostics', JSON.stringify(diagnostics));
    return diagnostics;
  } catch (error) {
    console.error('Failed to export diagnostics:', error);
    return null;
  }
};

export default DIAGNOSTIC_LOG;
