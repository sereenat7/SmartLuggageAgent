import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import {
  defaultNotificationSettings,
  loadNotificationSettings,
  saveNotificationSettings,
} from '../services/notificationSettings';
import { changePassword } from '../services/auth';
import './Settings.css';

const STORAGE_KEY = 'admin_platform_settings';

const defaultSettings = {
  platformName: 'LuggagePro Admin',
  supportEmail: 'support@luggagepro.in',
  supportPhone: '+91 1800-000-1234',
  timezone: 'Asia/Kolkata (IST +5:30)',
};

const fields = [
  { key: 'platformName', label: 'Platform Name' },
  { key: 'supportEmail', label: 'Support Email', type: 'email' },
  { key: 'supportPhone', label: 'Support Phone', type: 'tel' },
  { key: 'timezone', label: 'Timezone' },
];

const notificationItems = [
  {
    key: 'newBookingAlerts',
    title: 'New booking alerts',
    description: 'Notify when a new booking is placed',
  },
  {
    key: 'agentOfflineAlerts',
    title: 'Agent offline alerts',
    description: 'Alert when agents go offline during peak hours',
  },
  {
    key: 'complaintEscalations',
    title: 'Complaint escalations',
    description: 'Notify on high-priority complaints',
  },
  {
    key: 'paymentFailures',
    title: 'Payment failures',
    description: 'Alert on failed payment transactions',
  },
];

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

function SettingsToggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`settings-toggle${checked ? ' settings-toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-toggle__thumb" />
    </button>
  );
}

function Settings() {
  const [settings, setSettings] = useState(loadSettings);
  const [notifications, setNotifications] = useState(loadNotificationSettings);
  const [saved, setSaved] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleNotificationToggle = async (key, value) => {
    const next = { ...notifications, [key]: value };
    setNotifications(next);
    saveNotificationSettings(next);

    if (key === 'newBookingAlerts' && value && typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setNotifications(defaultNotificationSettings);
    localStorage.removeItem(STORAGE_KEY);
    saveNotificationSettings(defaultNotificationSettings);
    setSaved(false);
  };

  const handlePasswordChange = (key, value) => {
    setPasswordForm((prev) => ({ ...prev, [key]: value }));
    setPasswordError('');
    setPasswordMessage('');
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordMessage('');

    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    setPasswordSaving(true);

    try {
      const data = await changePassword(currentPassword, newPassword);

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to update password');
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage(data.message || 'Password updated successfully');
    } catch (error) {
      setPasswordError(
        error.response?.data?.message || error.message || 'Failed to update password',
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-page__intro">
        <h1 className="settings-page__title">Settings</h1>
        <p className="settings-page__subtitle">Platform configuration and preferences</p>
      </header>

      <section className="settings-card" aria-labelledby="settings-general-title">
        <h2 id="settings-general-title" className="settings-card__title">
          General
        </h2>

        <div className="settings-card__rows">
          {fields.map((field) => (
            <div key={field.key} className="settings-row">
              <label className="settings-row__label" htmlFor={`settings-${field.key}`}>
                {field.label}
              </label>
              <input
                id={`settings-${field.key}`}
                className="settings-row__input"
                type={field.type || 'text'}
                value={settings[field.key]}
                onChange={(event) => handleChange(field.key, event.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="settings-card__actions">
          <button type="button" className="settings-btn settings-btn--ghost" onClick={handleReset}>
            Reset
          </button>
          <button type="button" className="settings-btn settings-btn--primary" onClick={handleSave}>
            Save changes
          </button>
          {saved ? <span className="settings-card__saved">Saved</span> : null}
        </div>
      </section>

      <section className="settings-card" aria-labelledby="settings-password-title">
        <h2 id="settings-password-title" className="settings-card__title">
          Password
        </h2>

        <div className="settings-card__rows">
          <div className="settings-row">
            <label className="settings-row__label" htmlFor="settings-current-password">
              Current password
            </label>
            <input
              id="settings-current-password"
              className="settings-row__input"
              type="password"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(event) => handlePasswordChange('currentPassword', event.target.value)}
            />
          </div>

          <div className="settings-row">
            <label className="settings-row__label" htmlFor="settings-new-password">
              New password
            </label>
            <input
              id="settings-new-password"
              className="settings-row__input"
              type="password"
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(event) => handlePasswordChange('newPassword', event.target.value)}
            />
          </div>

          <div className="settings-row">
            <label className="settings-row__label" htmlFor="settings-confirm-password">
              Confirm password
            </label>
            <input
              id="settings-confirm-password"
              className="settings-row__input"
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(event) => handlePasswordChange('confirmPassword', event.target.value)}
            />
          </div>
        </div>

        <div className="settings-card__actions">
          <button
            type="button"
            className="settings-btn settings-btn--primary"
            onClick={handleChangePassword}
            disabled={passwordSaving}
          >
            {passwordSaving ? 'Updating...' : 'Change password'}
          </button>
          {passwordMessage ? <span className="settings-card__saved">{passwordMessage}</span> : null}
        </div>
      </section>

      <section className="settings-card" aria-labelledby="settings-notifications-title">
        <h2 id="settings-notifications-title" className="settings-card__title">
          Notifications
        </h2>

        <div className="settings-card__rows">
          {notificationItems.map((item) => (
            <div key={item.key} className="settings-row settings-row--notification">
              <div className="settings-row__content">
                <div className="settings-row__label">{item.title}</div>
                <p className="settings-row__hint">{item.description}</p>
              </div>
              <SettingsToggle
                checked={notifications[item.key]}
                onChange={(value) => handleNotificationToggle(item.key, value)}
                label={item.title}
              />
            </div>
          ))}
        </div>
      </section>

      <Snackbar
        open={Boolean(passwordError)}
        autoHideDuration={6000}
        onClose={() => setPasswordError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setPasswordError('')} severity="error" variant="filled" sx={{ width: '100%' }}>
          {passwordError}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default Settings;
