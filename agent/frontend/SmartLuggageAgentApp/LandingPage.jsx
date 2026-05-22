import React from 'react';
import { motion } from 'framer-motion';

// --- Icons ---

function LogoIcon({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#ff6600" />
      <path d="M9 8H23" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 8V24" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <rect x="9" y="12" width="14" height="12" rx="2" stroke="white" strokeWidth="2" />
    </svg>
  );
}

function RocketIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function ArrowRightIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function LockIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SmartphoneIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

// --- Animated Smart Suitcase SVG ---
function SmartSuitcase() {
  return (
    <svg viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      {/* Drop shadow */}
      <ellipse cx="100" cy="210" rx="55" ry="8" fill="#ff6600" opacity="0.12" />

      {/* Suitcase body */}
      <rect x="25" y="60" width="150" height="130" rx="14" fill="#1e293b" />
      <rect x="25" y="60" width="150" height="130" rx="14" stroke="#334155" strokeWidth="2" />

      {/* Suitcase lid line */}
      <line x1="25" y1="105" x2="175" y2="105" stroke="#334155" strokeWidth="2" />

      {/* Vertical center strip */}
      <rect x="88" y="60" width="24" height="130" fill="#0f172a" rx="2" />

      {/* Latches */}
      <rect x="84" y="90" width="32" height="16" rx="4" fill="#ff6600" />
      <rect x="84" y="118" width="32" height="16" rx="4" fill="#ff6600" />

      {/* Handle */}
      <rect x="72" y="30" width="56" height="36" rx="10" stroke="#94a3b8" strokeWidth="4" fill="none" />
      <rect x="82" y="55" width="36" height="10" rx="4" fill="#1e293b" />

      {/* Wheels */}
      <circle cx="55" cy="196" r="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <circle cx="55" cy="196" r="4" fill="#64748b" />
      <circle cx="145" cy="196" r="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <circle cx="145" cy="196" r="4" fill="#64748b" />

      {/* Smart chip / NFC icon on body */}
      <rect x="108" y="68" width="30" height="22" rx="4" fill="#1e40af" opacity="0.8" />
      <path d="M114 74 Q115 71 118 71 Q121 71 122 74" stroke="#93c5fd" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M112 76 Q113 70 118 70 Q123 70 124 76" stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M110 78 Q111 68 118 68 Q125 68 126 78" stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="118" cy="82" r="2" fill="#93c5fd" />

      {/* Luggage tag */}
      <rect x="148" y="72" width="22" height="32" rx="4" fill="#ff6600" />
      <circle cx="159" cy="68" r="4" fill="none" stroke="#ff6600" strokeWidth="2" />
      <line x1="155" y1="78" x2="163" y2="78" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="155" y1="84" x2="163" y2="84" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="155" y1="90" x2="159" y2="90" stroke="white" strokeWidth="1.5" strokeLinecap="round" />

      {/* Corner guards */}
      <rect x="25" y="60" width="14" height="14" rx="4" fill="#374151" />
      <rect x="161" y="60" width="14" height="14" rx="4" fill="#374151" />
      <rect x="25" y="176" width="14" height="14" rx="4" fill="#374151" />
      <rect x="161" y="176" width="14" height="14" rx="4" fill="#374151" />
    </svg>
  );
}

// --- Scan beam animation ---
function ScanBeam() {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: '12.5%',
        right: '12.5%',
        height: '3px',
        background: 'linear-gradient(90deg, transparent, #ff6600, #ff6b55, #ff6600, transparent)',
        borderRadius: '2px',
        boxShadow: '0 0 12px 4px rgba(255,75,51,0.5)',
        top: '27%',
      }}
      initial={{ top: '27%', opacity: 0 }}
      animate={{
        top: ['27%', '85%', '27%'],
        opacity: [0, 1, 1, 1, 0],
      }}
      transition={{
        duration: 3,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatDelay: 1.5,
      }}
    />
  );
}

// --- Orbit dots ---
function OrbitDot({ delay, radius, size = 6, color = '#ff6600' }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        top: '50%',
        left: '50%',
        marginTop: -size / 2,
        marginLeft: -size / 2,
        opacity: 0.7,
      }}
      animate={{
        x: [radius, 0, -radius, 0, radius],
        y: [0, -radius * 0.6, 0, radius * 0.6, 0],
        opacity: [0.7, 1, 0.7, 1, 0.7],
        scale: [1, 1.3, 1, 1.3, 1],
      }}
      transition={{
        duration: 4,
        ease: 'easeInOut',
        repeat: Infinity,
        delay,
      }}
    />
  );
}

// --- Main animated suitcase hero ---
function AnimatedSuitcaseHero() {
  return (
    <div style={{ position: 'relative', width: 280, height: 300, margin: '0 auto' }}>
      {/* Glow background */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,75,51,0.12) 0%, transparent 70%)',
        }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Orbit dots */}
      <OrbitDot delay={0} radius={120} size={7} color="#ff6600" />
      <OrbitDot delay={1.3} radius={100} size={5} color="#3b82f6" />
      <OrbitDot delay={2.6} radius={130} size={5} color="#10b981" />

      {/* Floating suitcase */}
      <motion.div
        style={{ position: 'absolute', inset: 0 }}
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
      >
        <SmartSuitcase />
      </motion.div>

      {/* Scan beam */}
      <ScanBeam />

      {/* Status badge */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,75,51,0.92)',
          color: 'white',
          fontSize: 11,
          fontWeight: 700,
          padding: '4px 14px',
          borderRadius: 20,
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 12px rgba(255,75,51,0.4)',
        }}
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ✓ SMART VERIFIED
      </motion.div>
    </div>
  );
}

// --- Main Component ---

export default function LandingPage({ navigation }) {
  const onGetStarted = () => navigation.navigate('Login', { showSignUp: true });
  const onAgentLogin = () => navigation.navigate('Login', { showSignUp: false });
  const onGuestLogin = () => navigation.navigate('Guest');

  // Grid background pattern
  const gridPattern = (
    <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_4rem]">
      <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_500px_at_50%_200px,#fff,transparent)]"></div>
    </div>
  );

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white text-slate-900 font-sans">
      {gridPattern}

      {/* --- Header / Navbar --- */}
      <header className="sticky top-0 z-50 w-full border-b border-transparent bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoIcon className="h-9 w-9 text-brand" />
            <span className="text-xl font-bold tracking-tight text-slate-900">Smart Luggage</span>
            <div className="hidden rounded-md bg-brand/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-brand sm:block">
              AGENT
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onAgentLogin}
              className="hidden text-sm font-semibold text-slate-600 hover:text-slate-900 sm:block"
            >
              Log In
            </button>
            <button
              onClick={onGetStarted}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brandDark hover:shadow-md active:scale-95"
            >
              Register as Agent
            </button>
          </div>
        </div>
      </header>

      {/* --- Hero Section --- */}
      <main className="mx-auto mt-12 w-full max-w-7xl px-6 pb-20 pt-8 sm:mt-20">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">

          {/* Left: Text content */}
          <motion.div
            className="flex-1 max-w-2xl"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* Badge */}
            <motion.div
              className="mb-8 inline-flex items-center rounded-full border border-brand/20 bg-brand/5 px-4 py-2 shadow-sm"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <span className="flex h-2 w-2 rounded-full bg-brand"></span>
              <span className="ml-3 text-sm font-medium text-brand">
                Official Agent Portal — Smart Luggage System
              </span>
            </motion.div>

            {/* Heading */}
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-7xl">
              Handle Luggage.
              <br />
              <span className="text-brand">Build Trust.</span>
              <br />
              Earn Reliably.
            </h1>

            {/* Subtext */}
            <p className="mt-8 max-w-2xl text-lg text-slate-600 sm:text-xl">
              Join a verified network of airline luggage agents. Manage pickups, deliveries, and digital check-ins through one secure, professional platform designed for field agents.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                onClick={onGetStarted}
                className="group flex items-center justify-center gap-2 rounded-xl bg-brand px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-brandDark hover:shadow-brand/30 active:scale-95"
              >
                <RocketIcon className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                Register as Agent
              </button>
              <button
                onClick={onAgentLogin}
                className="group flex items-center justify-center gap-2 rounded-xl bg-brand/5 px-8 py-4 text-lg font-semibold text-slate-900 ring-1 ring-inset ring-slate-200 transition-all hover:bg-white hover:shadow-md active:scale-95"
              >
                Agent Login
                <ArrowRightIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={onGuestLogin}
                className="mt-4 text-sm font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-4 sm:mt-0"
              >
                Continue as Guest
              </button>
            </div>
          </motion.div>

          {/* Right: Animated Suitcase */}
          <motion.div
            className="flex-shrink-0 w-full max-w-xs lg:max-w-sm"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
          >
            <AnimatedSuitcaseHero />
          </motion.div>
        </div>

        {/* --- Features Footer Section --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="mt-12 flex flex-row gap-4 overflow-x-auto pb-6 sm:mt-24 sm:grid sm:grid-cols-3 sm:gap-8 sm:overflow-visible"
        >
          {/* Feature 1 */}
          <div className="group min-w-[260px] flex-1 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
              <LockIcon className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">KYC Verified</h3>
            <p className="text-sm leading-relaxed text-slate-500">
              Rigorous identity verification to ensure a trusted network of professional agents.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group min-w-[260px] flex-1 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <SmartphoneIcon className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">Mobile-First</h3>
            <p className="text-sm leading-relaxed text-slate-500">
              Complete app for managing check-ins, tracking, and earnings from anywhere.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group min-w-[260px] flex-1 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4 12 14.01l-3-3" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">Secure Handover</h3>
            <p className="text-sm leading-relaxed text-slate-500">
              OTP-verified exchanges ensure luggage safety at every step of the journey.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
