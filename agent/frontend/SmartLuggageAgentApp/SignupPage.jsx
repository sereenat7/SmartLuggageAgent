import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { API_URL } from './config'; // Use shared config for consistency

export default function SignupPage({ onBack, onGoLogin }) {
  const [formData, setFormData] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          mobile: formData.phone,
          password: formData.password
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Account created! Please login.');
        onGoLogin();
      } else {
        alert(data.error || 'Signup failed');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.main
      className="min-h-screen bg-[#f5f6fa] px-4 py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      <div className="mx-auto w-full max-w-md rounded-[28px] border border-[#e3e5ea] bg-white p-6 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.45)]">
        <button
          onClick={onBack}
          className="mb-4 rounded-xl border border-[#e6e6e6] px-3 py-2 text-sm font-medium text-[#5a5f66]"
        >
          Back
        </button>

        <h1 className="text-3xl font-semibold text-[#222]">Create Account</h1>
        <p className="mt-2 text-sm text-[#686f78]">Sign up to start handling secure pickups and deliveries.</p>

        <div className="mt-6 space-y-3">
          <input
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            className="w-full rounded-2xl border border-[#eee] bg-[#eee] px-4 py-3 text-sm outline-none focus:border-[#ff6600]"
            placeholder="Full Name"
          />
          <input
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full rounded-2xl border border-[#eee] bg-[#eee] px-4 py-3 text-sm outline-none focus:border-[#ff6600]"
            placeholder="Email"
          />
          <input
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full rounded-2xl border border-[#eee] bg-[#eee] px-4 py-3 text-sm outline-none focus:border-[#ff6600]"
            placeholder="Phone"
          />
          <input
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full rounded-2xl border border-[#eee] bg-[#eee] px-4 py-3 text-sm outline-none focus:border-[#ff6600]"
            placeholder="Password"
            type="password"
          />
        </div>

        <motion.button
          onClick={handleSignup}
          disabled={loading}
          whileHover={{ scale: 1.02, boxShadow: '0 0 26px rgba(255,112,67,0.52)' }}
          whileTap={{ scale: 0.98 }}
          className="mt-5 w-full rounded-[30px] bg-gradient-to-r from-[#ff0033] to-[#ff6600] px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Signing Up...' : 'Sign Up'}
        </motion.button>

        <button onClick={onGoLogin} className="mt-4 w-full text-sm text-gray-500">
          Already have an account? <span className="font-bold text-[#ff6600]">Login</span>
        </button>
      </div>
    </motion.main>
  );
}
