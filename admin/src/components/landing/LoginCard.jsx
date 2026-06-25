import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useAuth } from '../../context/AuthContext';
import Logo from './Logo';

function LoginCard() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Invalid email or password. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-card__brand">
        <Logo size="sm" centered />
      </div>

      <h2 className="login-card__title">
        Smart Luggage <span>Admin Portal</span>
      </h2>
      <p className="login-card__description">
        Manage bookings, users, agents, payments, and customer support from one secure dashboard.
      </p>

      <form className="login-card__form" onSubmit={handleSubmit}>
        <label className="login-field">
          <span className="login-field__icon" aria-hidden="true">
            <PersonOutlineOutlinedIcon fontSize="small" />
          </span>
          <input
            type="email"
            name="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="login-field">
          <span className="login-field__icon" aria-hidden="true">
            <LockOutlinedIcon fontSize="small" />
          </span>
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            type="button"
            className="login-field__toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <VisibilityOffOutlinedIcon fontSize="small" />
            ) : (
              <VisibilityOutlinedIcon fontSize="small" />
            )}
          </button>
        </label>

        <div className="login-card__options">
          <label className="login-checkbox">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <button type="button" className="login-card__forgot">
            Forgot Password?
          </button>
        </div>

        <button type="submit" className="login-card__submit" disabled={isSubmitting}>
          <LockOutlinedIcon fontSize="small" />
          {isSubmitting ? 'Signing in...' : 'Admin Login'}
        </button>
      </form>

      <div className="login-card__notice">
        <ShieldOutlinedIcon className="login-card__notice-icon" fontSize="small" />
        <p>Authorized personnel only. All access is monitored and secure.</p>
      </div>

      <Snackbar
        open={Boolean(errorMessage)}
        autoHideDuration={6000}
        onClose={() => setErrorMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setErrorMessage('')} severity="error" variant="filled" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default LoginCard;
