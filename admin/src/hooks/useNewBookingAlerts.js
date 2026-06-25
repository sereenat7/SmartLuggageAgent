import { useEffect, useRef } from 'react';
import { fetchBookings } from '../services/bookings';
import { isNewBookingAlertsEnabled } from '../services/notificationSettings';
import { useAuth } from '../context/AuthContext';

const BASELINE_KEY = 'admin_booking_alert_baseline';
const POLL_MS = 15000;

function loadBaseline() {
  try {
    const raw = sessionStorage.getItem(BASELINE_KEY);
    if (!raw) return null;
    return new Set(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveBaseline(ids) {
  sessionStorage.setItem(BASELINE_KEY, JSON.stringify([...ids]));
}

function showBookingNotification(booking) {
  const title = 'New booking';
  const body = `${booking.id} — ${booking.customer?.name || 'Customer'} · ${booking.pickup || 'Pickup pending'}`;

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, tag: `booking-${booking.bookingId}` });
    return;
  }

  window.alert(`${title}\n${body}`);
}

async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function useNewBookingAlerts() {
  const { isAuthenticated } = useAuth();
  const pollingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let active = true;

    const checkBookings = async () => {
      if (!active || pollingRef.current) return;
      if (!isNewBookingAlertsEnabled()) return;

      pollingRef.current = true;

      try {
        await requestNotificationPermission();
        const bookings = await fetchBookings();
        const ids = new Set(
          bookings.map((booking) => booking.bookingId).filter((id) => id != null),
        );

        if (!ids.size) return;

        const baseline = loadBaseline();

        if (!baseline) {
          saveBaseline(ids);
          return;
        }

        const newBookings = bookings.filter(
          (booking) => booking.bookingId != null && !baseline.has(booking.bookingId),
        );

        newBookings
          .sort((a, b) => a.bookingId - b.bookingId)
          .forEach((booking) => {
            showBookingNotification(booking);
            baseline.add(booking.bookingId);
          });

        if (newBookings.length) {
          saveBaseline(baseline);
        }
      } catch {
        // Ignore polling errors (offline backend, etc.)
      } finally {
        pollingRef.current = false;
      }
    };

    const onSettingsChange = () => {
      if (isNewBookingAlertsEnabled()) {
        checkBookings();
      }
    };

    checkBookings();
    const intervalId = window.setInterval(checkBookings, POLL_MS);
    window.addEventListener('admin-notification-settings-changed', onSettingsChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('admin-notification-settings-changed', onSettingsChange);
    };
  }, [isAuthenticated]);
}
