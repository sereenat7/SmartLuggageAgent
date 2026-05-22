import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { API_URL } from './config';

export default function LoginPage({ onBack, onGoSignup }) {
  const [formData, setFormData] = useState({ mobile: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Welcome ${data.user.fullName}!`);
        // Navigate or save token here
      } else {
        alert(data.error || 'Login failed');
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
      className="min-h-screen bg-[#f3f4f7] px-4 py-8"
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

        <h1 className="text-3xl font-semibold text-[#222]">Agent Login</h1>
        <p className="mt-2 text-sm text-[#686f78]">Login to access your assigned tasks and secure deliveries.</p>

        <div className="mt-6 space-y-3">
          <input
            name="mobile"
            value={formData.mobile}
            onChange={handleChange}
            className="w-full rounded-2xl border border-[#e2e5ea] px-4 py-3 text-sm outline-none focus:border-[#F4511E]"
            placeholder="Mobile"
          />
          <input
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full rounded-2xl border border-[#e2e5ea] px-4 py-3 text-sm outline-none focus:border-[#F4511E]"
            placeholder="Password"
            type="password"
          />
        </div>

        <motion.button
          onClick={handleLogin}
          disabled={loading}
          whileHover={{ scale: 1.02, boxShadow: '0 0 26px rgba(255,112,67,0.52)' }}
          whileTap={{ scale: 0.98 }}
          className="mt-5 w-full rounded-2xl bg-[#F4511E] px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </motion.button>

        <button onClick={onGoSignup} className="mt-4 w-full text-sm font-semibold text-[#4f5661] underline underline-offset-4">
          New here? Create an account
        </button>
      </div>
    </motion.main>
  );
}
