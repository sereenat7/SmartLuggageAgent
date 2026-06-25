const STORAGE_KEY = 'admin_notification_settings';

export const defaultNotificationSettings = {
  newBookingAlerts: true,
  agentOfflineAlerts: true,
  complaintEscalations: true,
  paymentFailures: false,
};

export function loadNotificationSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultNotificationSettings };
    return { ...defaultNotificationSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultNotificationSettings };
  }
}

export function saveNotificationSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('admin-notification-settings-changed'));
}

export function isNewBookingAlertsEnabled() {
  return loadNotificationSettings().newBookingAlerts;
}
