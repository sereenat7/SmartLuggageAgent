const express = require("express");
const { latLngToCell, gridDistance } = require("h3-js");
const router = express.Router();
const db = require("../db");
const { computeAgentSchedule } = require("../utils/agentSchedule");
const { attachQrDataToBooking, createBookingQrManifest, verifyQrPayload, isDestinationUnlocked } = require("../utils/bookingQr");
const { getVerificationStatus, formatBookingForVerification, createVerificationLog } = require("../utils/verificationService");

const H3_RESOLUTION = 8;
const AGENT_STALE_MINUTES = 15;

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseWeightKg = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  const matches = text.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length === 0) return null;

  if (text.includes("-")) {
    const upperBound = Number(matches[matches.length - 1]);
    return Number.isFinite(upperBound) ? upperBound : null;
  }

  const numeric = Number(matches[0]);
  return Number.isFinite(numeric) ? numeric : null;
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Helper function to format dates as YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return null;
  if (typeof date === 'string') {
    date = date.trim();
    // If already in YYYY-MM-DD format, return as is
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
    
    // Handle DD/MM/YYYY format (from frontend)
    if (date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const parts = date.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    
    // Try to parse and reformat
    try {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {
      return null;
    }
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return null;
};

// Helper function to normalize booking status for client apps
const getBookingStatus = (status) => {
  if (!status) return 'pending';
  const s = String(status).toLowerCase().trim();
  if (s === 'picked_up' || s === 'picked') return 'picked';
  if (s === 'in-progress' || s === 'assigned') return 'assigned';
  if (s === 'in_transit' || s === 'in transit') return 'in transit';
  return s;
};

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

// Helper function to format times as HH:MM:SS
const formatTime = (time) => {
  if (!time) return null;
  if (typeof time === 'string') {
    time = time.trim();
    // If already in HH:MM:SS format, return as is
    if (time.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
      const parts = time.split(':');
      const h = parts[0].padStart(2, '0');
      return `${h}:${parts[1]}:${parts[2]}`;
    }
    // If in HH:MM format, add :00
    if (time.match(/^\d{1,2}:\d{2}$/)) {
      const parts = time.split(':');
      const h = parts[0].padStart(2, '0');
      return `${h}:${parts[1]}:00`;
    }
    // Handle AM/PM formats, e.g. "3:44 pm", "12:14 PM", "03:44 PM"
    const ampmMatch = time.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1]);
      const minutes = ampmMatch[2];
      const ampm = ampmMatch[3].toLowerCase();
      
      if (ampm === 'pm' && hours < 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }
      
      const formattedHours = String(hours).padStart(2, '0');
      return `${formattedHours}:${minutes}:00`;
    }
    
    // Fallback if it contains something else but has HH:MM, try to parse
    // e.g. "3:44" (without am/pm)
    const matchSimple = time.match(/^(\d{1,2}):(\d{2})/);
    if (matchSimple) {
      const formattedHours = matchSimple[1].padStart(2, '0');
      return `${formattedHours}:${matchSimple[2]}:00`;
    }
  }
  return null;
};

const VEHICLE_WEIGHT_MAP = {
  bike: 10,
  bicycle: 10,
  motorcycle: 15,
  scooter: 15,
  auto: 30,
  "auto-rickshaw": 30,
  autorickshaw: 30,
  car: 50,
  sedan: 50,
  hatchback: 50,
  suv: 80,
  van: 100,
  minivan: 100,
  truck: 300,
  "mini truck": 200,
  "mini-truck": 200,
};

const resolveAgentCapacityKg = (agentRow) => {
  const explicit = toNumberOrNull(agentRow?.max_weight_kg);
  const byVehicle = agentRow?.vehicle_type
    ? VEHICLE_WEIGHT_MAP[String(agentRow.vehicle_type).toLowerCase().trim()] ?? null
    : null;

  if (Number.isFinite(explicit) && Number.isFinite(byVehicle)) {
    return Math.max(explicit, byVehicle);
  }
  return byVehicle ?? explicit ?? 25;
};

const normalizePickupDateTime = (departureDate, pickupTime) => {
  if (!departureDate || !pickupTime) {
    return null;
  }

  const dateText = String(departureDate).trim();
  const timeText = String(pickupTime).trim();
  if (!dateText || !timeText) {
    return null;
  }

  // Format: "YYYY-MM-DD HH:MM:SS" for MySQL DATETIME
  // departureDate should be in format like "2026-04-23" or "04/23/2026"
  let date = dateText;
  
  // If date is in MM/DD/YYYY format, convert to YYYY-MM-DD
  if (dateText.includes('/')) {
    const [month, day, year] = dateText.split('/');
    date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  
  // Convert 12-hour format (e.g., "5:30 PM") to 24-hour format
  let time = timeText;
  if (timeText.includes('AM') || timeText.includes('PM')) {
    const isPM = timeText.includes('PM');
    const cleanTime = timeText.replace(/\s*(AM|PM)/i, '').trim();
    const [hours, minutes] = cleanTime.split(':');
    let hour = parseInt(hours, 10);
    const minute = minutes ? parseInt(minutes, 10) : 0;
    
    if (isPM && hour !== 12) {
      hour += 12;
    } else if (!isPM && hour === 12) {
      hour = 0;
    }
    
    time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  } else {
    // Already in 24-hour format or just HH:MM
    time = timeText.length === 5 ? `${timeText}:00` : timeText;
  }
  
  return `${date} ${time}`;
};

const getPhoneVariants = (phone) => {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D+/g, "");
  const lastTen = digits.slice(-10);

  const variants = new Set();
  if (raw) variants.add(raw);
  if (digits) variants.add(digits);
  if (lastTen) {
    variants.add(lastTen);
    variants.add(`+91${lastTen}`);
  }

  return Array.from(variants).filter(Boolean);
};

const logBookingH3Scenarios = ({ bookingId, userH3, rankedCandidates }) => {
  const ranked = Array.isArray(rankedCandidates) ? rankedCandidates : [];

  if (!ranked.length) {
    console.log(`[H3 TEST] Booking ${bookingId}: no available agents for ranking`);
    return;
  }

  const first = ranked[0];
  console.log(`[H3 TEST] Booking ${bookingId} Scenario 1: 1 user + 1 best agent`);
  console.log(`  userH3=${userH3}`);
  console.log(`  bestAgentId=${first.agentId} bestAgentName=${first.name} bestAgentH3=${first.agentH3}`);
  console.log(`  h3HexDistance=${first.h3Distance} distanceKm=${first.distanceKm} score=${first.score}`);
  console.log(first.h3Distance === 0
    ? '  result=agent is in the same H3 hexagon'
    : '  result=agent is in a nearby H3 hexagon');

  console.log(`[H3 TEST] Booking ${bookingId} Scenario 2: 1 user + multiple agents`);
  ranked.slice(0, 5).forEach((candidate, index) => {
    console.log(
      `  rank=${index + 1} agentId=${candidate.agentId} name=${candidate.name} ` +
      `h3HexDistance=${candidate.h3Distance} distanceKm=${candidate.distanceKm} score=${candidate.score} ` +
      `vehicle=${candidate.vehicleType || 'unknown'} maxWeightKg=${candidate.maxWeightKg}`
    );
  });
};

const queueBookingForAgentDashboard = (bookingId, phone) =>
  new Promise((resolve, reject) => {
    try {
      console.log(`[QUEUE] Attempting to queue booking ${bookingId} for phone: ${phone}`);
      
      const phoneVariants = getPhoneVariants(phone);
      if (!phoneVariants.length) {
        console.log(`[QUEUE] ❌ No phone variants found`);
        return resolve({ queued: false, reason: "missing-phone" });
      }

      const placeholders = phoneVariants.map(() => "?").join(",");
      const userSql = `SELECT id FROM users WHERE phone IN (${placeholders}) LIMIT 1`;

      db.query(userSql, phoneVariants, (userErr, users) => {
        if (userErr) {
          console.error(`[QUEUE] ❌ User lookup error:`, userErr.message);
          return reject(userErr);
        }
        
        const userId = users?.[0]?.id;
        if (!userId) {
          console.log(`[QUEUE] ⚠️ User not found for phone: ${phone}`);
          // Create a fallback: use null user_id but still queue the booking
          return queueWithAgent(null);
        }

        queueWithAgent(userId);
      });

      function queueWithAgent(userId) {
        // Get first available agent
        const agentSql = `
          SELECT agent_id FROM support_agents 
          WHERE status = 'available' 
          ORDER BY location_updated_at DESC 
          LIMIT 1
        `;

        db.query(agentSql, (agentErr, agents) => {
          if (agentErr) {
            console.error(`[QUEUE] ❌ Agent lookup error:`, agentErr.message);
            return reject(agentErr);
          }

          const preferredAgentId = agents?.[0]?.agent_id || null;
          console.log(`[QUEUE] Using Agent #${preferredAgentId || 'UNASSIGNED'}`);

          // Insert into agent_queue (SIMPLE AND RELIABLE)
          const queueSql = `
            INSERT INTO agent_queue (user_id, booking_id, preferred_agent_id, status, requested_at)
            VALUES (?, ?, ?, 'waiting', CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
              preferred_agent_id = VALUES(preferred_agent_id),
              status = 'waiting',
              requested_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          `;

          db.query(queueSql, [userId, bookingId, preferredAgentId], (queueErr) => {
            if (queueErr) {
              console.error(`[QUEUE] ❌ Failed to insert into agent_queue:`, queueErr.message);
              return reject(queueErr);
            }

            console.log(`[QUEUE] ✅ Booking ${bookingId} queued successfully`);

            // Update booking status (if not already queued)
            db.query(
              `UPDATE bookings SET status = 'queued', assignment_status = 'queued' WHERE id = ? AND status != 'queued'`,
              [bookingId],
              (bookingErr) => {
                if (bookingErr) {
                  console.error(`[QUEUE] ⚠️ Failed to update booking status:`, bookingErr.message);
                  // Still resolve because agent_queue insertion succeeded
                }
                resolve({ queued: true, userId, preferredAgentId });
              }
            );
          });
        });
      }
    } catch (error) {
      console.error(`[QUEUE] ❌ Unexpected error:`, error.message);
      reject(error);
    }
  });

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  
  // Decode base64 token to get phone
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [phone] = decoded.split(':');
    console.log('DEBUG: Token verification - extracted phone:', phone, 'from decoded:', decoded);
    req.phone = phone;
    next();
  } catch (err) {
    console.error('DEBUG: Token verification error:', err.message);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// Create booking
router.post("/create", verifyToken, (req, res) => {
  const {
    username,
    isInternational, 
    isDomestic, 
    airlineName, 
    flightNumber, 
    terminal,
    departureCity,
    departureAirport,
    arrivalCity,
    arrivalAirport,
    departureDate, 
    departureTime,
    arrivalDate,
    arrivalTime,
    bagCount, 
    bagWeight, 
    isFragile, 
    isCheckin,
    pincode, 
    pickupAddress, 
    pickupLatitude, 
    pickupLongitude, 
    pickupTime,
    dropAddress,
    dropLatitude,
    dropLongitude,
    photos, 
    additionalInfo
  } = req.body;

  const normalizedBagWeight = bagWeight ? String(bagWeight).trim().slice(0, 50) : null;
  
  // Only assign bookings with future pickup times
  // Parse pickup datetime and check if it's in the future
  const pickupDateTime = normalizePickupDateTime(departureDate, pickupTime);
  const now = new Date();
  let assignmentDueAt = null;
  
  if (pickupDateTime) {
    const pickupDate = new Date(pickupDateTime);
    if (pickupDate > now) {
      // Store scheduled pickup time; agent leave-by is computed after booking via H3 + ETA
      assignmentDueAt = pickupDate.toISOString().slice(0, 19).replace('T', ' ');
    }
  }

  console.log('DEBUG: Creating booking for phone:', req.phone);
  try {
    const query = `
      INSERT INTO bookings (
        phone, username, is_international, is_domestic, airline_name, flight_number, terminal,
        departure_city, departure_airport, arrival_city, arrival_airport, departure_date, departure_time, arrival_date, arrival_time,
        bag_count, bag_weight, is_fragile, is_checkin, pincode, 
        pickup_address, pickup_latitude, pickup_longitude, pickup_time,
        drop_address, drop_latitude, drop_longitude,
        photos, qr_manifest, additional_info, assignment_due_at, assignment_status, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      query,
      [
        req.phone,
        username,
        isInternational ? 1 : 0, 
        isDomestic !== false ? 1 : 0, 
        airlineName, 
        flightNumber, 
        terminal,
        departureCity,
        departureAirport,
        arrivalCity,
        arrivalAirport,
        formatDate(departureDate),
        formatTime(departureTime),
        formatDate(arrivalDate),
        formatTime(arrivalTime),
        bagCount || 1, 
        normalizedBagWeight, 
        isFragile ? 1 : 0,
        isCheckin ? 1 : 0, 
        pincode, 
        pickupAddress, 
        pickupLatitude, 
        pickupLongitude, 
        formatTime(pickupTime),
        dropAddress,
        dropLatitude,
        dropLongitude,
        photos ? JSON.stringify(photos) : null, 
        null,
        additionalInfo, 
        assignmentDueAt,
        'scheduled',
        'pending'
      ],
      async (err, result) => {
        if (err) {
          console.error("Booking Error:", err);
          return res.json({ success: false, message: "Failed to create booking", error: err.message });
        }

        console.log('DEBUG: Booking created successfully - ID:', result.insertId, 'for phone:', req.phone);

        db.query(
          "UPDATE bookings SET qr_manifest = ? WHERE id = ?",
          [JSON.stringify(createBookingQrManifest(result.insertId)), result.insertId],
          (qrErr) => {
            if (qrErr) {
              console.error('DEBUG: Failed to persist QR manifest:', qrErr.message);
            }
          }
        );

        let queuedNow = false;
        try {
          const queueResult = await queueBookingForAgentDashboard(result.insertId, req.phone);
          queuedNow = Boolean(queueResult?.queued);
          if (!queuedNow) {
            console.log('DEBUG: Booking created but not queued immediately:', queueResult?.reason || 'unknown');
          }
        } catch (queueErr) {
          // Keep booking creation successful even if queueing fails; scheduler can still pick it later.
          console.error('DEBUG: Immediate queue failed, scheduler fallback will apply:', queueErr.message);
        }

        res.json({
          success: true,
          message: queuedNow
            ? "Booking created successfully and queued for agent acceptance."
            : (assignmentDueAt
              ? "Booking created successfully. Agent assignment will be triggered near the pickup time."
              : "Booking created successfully"),
          bookingId: result.insertId,
          assignmentDueAt,
          queuedNow,
        });
      }
    );
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message
    });
  }
});

// Get pending bookings for agents (inbox) - NO TOKEN REQUIRED
// MUST come BEFORE /:bookingId so it matches first
router.get("/inbox", (req, res) => {
  const query = `
    SELECT aq.id as queueId, aq.status as queueStatus, b.id as bookingId, b.phone, b.username as name, 
           b.pickup_address, b.pickup_latitude, b.pickup_longitude, 
           b.pickup_time, b.bag_count, b.bag_weight, b.status, b.created_at,
           b.departure_city, b.arrival_city, b.departure_date,
           b.airline_name as airlineName, b.flight_number as flightNumber,
           b.terminal, b.is_fragile as isFragile, b.is_checkin as isCheckin,
           b.additional_info as additionalInfo
    FROM agent_queue aq
    JOIN bookings b ON b.id = aq.booking_id
    WHERE aq.status = 'waiting'
    ORDER BY b.created_at DESC
    LIMIT 50
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching pending bookings:", err);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch pending bookings", 
        error: err.message 
      });
    }

    const activeSessionsQuery = `
      SELECT s.session_id, s.user_id, s.agent_id, s.start_time,
             u.name AS userName, u.phone AS userPhone,
             a.name AS agentName, a.phone AS agentPhone,
             b.id AS bookingId,
             b.pickup_address, b.pickup_latitude, b.pickup_longitude,
             b.drop_address, b.drop_latitude, b.drop_longitude,
             b.pickup_time, b.departure_date, b.bag_count, b.bag_weight,
             b.airline_name, b.flight_number, b.additional_info, b.terminal,
             b.departure_city, b.arrival_city,
             b.status, b.pickup_verified, b.pickup_verified_at, b.pickup_verified_by_agent_name, b.delivery_verified_at
      FROM agent_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN support_agents a ON a.agent_id = s.agent_id
      LEFT JOIN bookings b ON b.id = s.booking_id
      WHERE s.status = 'active'
      ORDER BY s.start_time DESC
      LIMIT 50
    `;

    db.query(activeSessionsQuery, (sessionErr, sessionRows) => {
      if (sessionErr) {
        console.error("Error fetching active sessions:", sessionErr);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch active sessions",
          error: sessionErr.message
        });
      }

      console.log(`DEBUG: Found ${results.length} pending bookings for agents`);
    if (results.length === 0) {
      console.log('DEBUG: No pending requests. Checking database state...');
      db.query('SELECT COUNT(*) as cnt FROM agent_queue', (err2, counts) => {
        console.log('DEBUG: Total queue entries:', counts?.[0]?.cnt || 0);
      });
      db.query('SELECT COUNT(*) as cnt FROM bookings WHERE status IN ("pending", "queued")', (err3, counts2) => {
        console.log('DEBUG: Pending/queued bookings:', counts2?.[0]?.cnt || 0);
      });
    }
      res.json({ 
        success: true, 
        waiting: results || [],
        activeSessions: (sessionRows || []).map((row) => ({
          sessionId: row.session_id,
          bookingId: row.bookingId,
          userId: row.user_id,
          agentId: row.agent_id,
          startTime: row.start_time,
          userName: row.userName,
          userPhone: row.userPhone,
          agentName: row.agentName,
          agentPhone: row.agentPhone,
          pickupLocation: row.pickup_address,
          pickupLatitude: row.pickup_latitude,
          pickupLongitude: row.pickup_longitude,
          dropLocation: row.drop_address,
          dropLatitude: row.drop_latitude,
          dropLongitude: row.drop_longitude,
          timeSlot: row.pickup_time,
          departureDate: row.departure_date,
          luggage: row.bag_count,
          bagWeight: row.bag_weight,
          airlineName: row.airline_name,
          flightNumber: row.flight_number,
          terminal: row.terminal,
          departureCity: row.departure_city,
          arrivalCity: row.arrival_city,
          additionalInfo: row.additional_info,
          status: row.status,
          pickupVerified: Boolean(row.pickup_verified),
          pickupVerifiedAt: row.pickup_verified_at,
          pickupVerifiedByAgentName: row.pickup_verified_by_agent_name,
          deliveryVerifiedAt: row.delivery_verified_at
        }))
      });
    });
  });
});

// DEBUG: Check all bookings
router.get("/debug/all-bookings-with-queue", (req, res) => {
  const query = `
    SELECT b.id, b.status, b.username, b.pickup_time, b.created_at, 
           aq.id as queue_id, aq.status as queue_status
    FROM bookings b
    LEFT JOIN agent_queue aq ON aq.booking_id = b.id
    ORDER BY b.id DESC
    LIMIT 20
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.json({ success: false, error: err.message });
    }
    res.json({ success: true, bookings: results });
  });
});

// Customer + pickup details for agent map (no token — used by agent app after accept)
router.get("/agent-details/:bookingId", (req, res) => {
  const { bookingId } = req.params;
  const query = `
    SELECT b.id, b.username, b.phone, b.pickup_address, b.pickup_latitude, b.pickup_longitude,
           b.drop_address, b.drop_latitude, b.drop_longitude, b.pickup_time, b.departure_date,
           b.bag_count, b.bag_weight, b.airline_name, b.flight_number, b.photos,
           b.arrived_at, b.assignment_status, b.status, b.no_show_unlocked,
           (SELECT COUNT(*) FROM booking_messages WHERE booking_id = b.id AND sender = 'agent') AS agent_message_count,
           u.name AS user_name, u.phone AS user_phone
    FROM bookings b
    LEFT JOIN users u ON u.id = (
      SELECT u2.id FROM users u2
      WHERE REPLACE(REPLACE(REPLACE(u2.phone, '+', ''), '-', ''), ' ', '') =
            REPLACE(REPLACE(REPLACE(b.phone, '+', ''), '-', ''), ' ', '')
      LIMIT 1
    )
    WHERE b.id = ?
    LIMIT 1
  `;

  db.query(query, [bookingId], (err, results) => {
    if (err) {
      console.error("agent-details error:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch booking details" });
    }
    if (!results.length) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    const row = results[0];
    let photosArray = null;
    if (row.photos) {
      try {
        photosArray = JSON.parse(row.photos);
      } catch (e) {
        photosArray = row.photos;
      }
    }
    res.json({
      success: true,
      customer: {
        bookingId: row.id,
        name: row.user_name || row.username || "Customer",
        phone: row.user_phone || row.phone || "",
        pickupAddress: row.pickup_address || "",
        pickupLatitude: row.pickup_latitude,
        pickupLongitude: row.pickup_longitude,
        dropAddress: row.drop_address || "",
        dropLatitude: row.drop_latitude,
        dropLongitude: row.drop_longitude,
        pickupTime: row.pickup_time,
        departureDate: row.departure_date,
        bagCount: row.bag_count,
        bagWeight: row.bag_weight,
        airlineName: row.airline_name,
        flightNumber: row.flight_number,
        photos: photosArray,
        arrivedAt: row.arrived_at,
        assignmentStatus: row.assignment_status,
        status: row.status,
        noShowUnlocked: row.no_show_unlocked,
        agentMessageCount: row.agent_message_count || 0,
      },
    });
  });
});

// Get booking - REQUIRES TOKEN
router.get("/:bookingId", verifyToken, (req, res) => {
  const { bookingId } = req.params;
  const phone = req.phone;

  // Normalize phone number - try both formats (with and without +91)
  let phonesToTry = [phone];
  if (phone && phone.startsWith('+91')) {
    phonesToTry.push(phone.substring(3)); // Remove +91
  } else if (phone && phone.length === 10 && !phone.startsWith('0')) {
    phonesToTry.push('+91' + phone);
  }

  const placeholders = phonesToTry.map(() => '?').join(' OR phone = ');
  const query = `SELECT * FROM bookings WHERE id = ? AND (phone = ${placeholders})`;
  
  db.query(query, [bookingId, ...phonesToTry], async (err, results) => {
    if (err) {
      return res.json({ success: false, message: "DB Error", error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const bookingData = {
      ...results[0],
      booking_status: getBookingStatus(results[0].status),
    };

    try {
      const bookingWithQr = await attachQrDataToBooking(bookingData);
      res.json({ success: true, booking: bookingWithQr });
    } catch (qrErr) {
      console.error('DEBUG: Failed to attach QR data:', qrErr);
      res.json({ success: true, booking: bookingData });
    }
  });
});

// Get user bookings
router.get("/", verifyToken, (req, res) => {
  let phone = req.phone;
  console.log('DEBUG: Fetching bookings for phone:', phone);

  // Normalize phone number - try both formats (with and without +91)
  let phonesToTry = [phone];
  
  // If phone starts with +91, also try without the +91
  if (phone && phone.startsWith('+91')) {
    phonesToTry.push(phone.substring(3)); // Remove +91
  } 
  // If phone doesn't start with +91 but is 10 digits, also try with +91
  else if (phone && phone.length === 10 && !phone.startsWith('0')) {
    phonesToTry.push('+91' + phone);
  }
  
  console.log('DEBUG: Trying phone formats:', phonesToTry);

  // Query with OR condition to match either format
  const placeholders = phonesToTry.map(() => '?').join(' OR phone = ');
  const query = `SELECT * FROM bookings WHERE phone = ${placeholders} ORDER BY created_at DESC LIMIT 50`;
  
  console.log('DEBUG: Executing query with values:', phonesToTry);
  db.query(query, phonesToTry, (err, results) => {
    if (err) {
      console.error('DEBUG: Database query error:', err);
      return res.json({ success: false, message: "DB Error", error: err });
    }

    console.log('DEBUG: Query results - found', results.length, 'bookings');
    if (results.length > 0) {
      console.log('DEBUG: First booking phone:', results[0].phone);
    }
    const bookingsData = results.map(row => ({
      ...row,
      booking_status: getBookingStatus(row.status),
    }));
    res.json({ success: true, bookings: bookingsData });
  });
});

// Confirm pickup - NO TOKEN REQUIRED FOR AGENT
router.patch("/pickup/:bookingId", (req, res) => {
  const { bookingId } = req.params;
  const updateBookingQuery = "UPDATE bookings SET status = 'picked_up', assignment_status = 'picked_up' WHERE id = ?";
  db.query(updateBookingQuery, [bookingId], (err, result) => {
    if (err) {
      console.error("Pickup Error:", err);
      return res.status(500).json({ success: false, message: "DB Error updating booking status", error: err });
    }
    
    // Also update session status if needed
    const updateSessionQuery = "UPDATE agent_sessions SET status = 'active' WHERE booking_id = ? AND status = 'active'";
    db.query(updateSessionQuery, [bookingId], (sessionErr) => {
      if (sessionErr) {
        console.error("Session update error on pickup:", sessionErr);
      }
      res.json({ success: true, message: "Pickup confirmed successfully" });
    });
  });
});

// Mark delivered - NO TOKEN REQUIRED FOR AGENT
router.patch("/delivered/:bookingId", (req, res) => {
  const { bookingId } = req.params;
  const updateBookingQuery = "UPDATE bookings SET status = 'delivered', assignment_status = 'delivered' WHERE id = ?";
  db.query(updateBookingQuery, [bookingId], (err, result) => {
    if (err) {
      console.error("Delivery Error:", err);
      return res.status(500).json({ success: false, message: "DB Error updating booking status", error: err });
    }
    
    // Find agent session and free the agent
    const findSessionQuery = "SELECT session_id, agent_id FROM agent_sessions WHERE booking_id = ? AND status = 'active' LIMIT 1";
    db.query(findSessionQuery, [bookingId], (sessionErr, sessions) => {
      if (sessionErr || sessions.length === 0) {
        console.log("No active agent session found for booking:", bookingId);
        return res.json({ success: true, message: "Delivery confirmed, but no active agent session found" });
      }
      
      const { session_id, agent_id } = sessions[0];
      const completeSessionQuery = "UPDATE agent_sessions SET status = 'completed', end_time = CURRENT_TIMESTAMP WHERE session_id = ?";
      db.query(completeSessionQuery, [session_id], (completeErr) => {
        if (completeErr) console.error("Complete session error:", completeErr);
        
        const freeAgentQuery = "UPDATE support_agents SET status = 'available', current_user_id = NULL WHERE agent_id = ?";
        db.query(freeAgentQuery, [agent_id], (freeErr) => {
          if (freeErr) console.error("Free agent error:", freeErr);
          
          res.json({ success: true, message: "Delivery completed successfully" });
        });
      });
    });
  });
});

// DEBUG endpoint to see what camera is sending
router.post("/debug-qr/:bookingId", async (req, res) => {
  const { bookingId } = req.params;
  const qrValue = req.body?.qrValue;

  console.log('\n\n🔍 DEBUG-QR ENDPOINT');
  console.log('Raw QR Value:', qrValue);
  console.log('QR Value Type:', typeof qrValue);
  console.log('QR Value Length:', qrValue?.length);
  
  try {
    const parsed = JSON.parse(qrValue);
    console.log('✅ Successfully parsed as JSON');
    console.log('   Booking ID:', parsed.bookingId);
    console.log('   Phase:', parsed.phase);
    res.json({ success: true, debug: 'Valid JSON payload', parsed });
  } catch (e) {
    console.log('❌ NOT valid JSON:', e.message);
    res.json({ success: false, debug: 'Invalid JSON', error: e.message });
  }
});

router.post("/verify-qr/:bookingId", async (req, res) => {
  const { bookingId } = req.params;
  const qrType = String(req.body?.qrType || '').trim().toLowerCase();
  const qrValue = req.body?.qrValue;

  console.log('\n\n╔════════════════════════════════════════════╗');
  console.log('║   QR VERIFICATION ENDPOINT RECEIVED        ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('Booking ID:', bookingId);
  console.log('QR Type:', qrType);
  console.log('QR Value preview:', qrValue?.substring(0, 50) + '...' || 'MISSING');

  if (!['pickup', 'destination'].includes(qrType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid QR type',
      verificationStatus: {
        status: 'invalid',
        reason: 'Invalid QR type',
        message: 'The scanned QR code type is not valid for this booking',
      },
    });
  }

  try {
    const rows = await runQuery('SELECT * FROM bookings WHERE id = ? LIMIT 1', [bookingId]);
    if (!rows.length) {
      console.log('❌ Booking not found');
      return res.status(404).json({
        success: false,
        verificationStatus: { status: 'invalid', reason: 'QR does not exist' },
      });
    }

    console.log('✅ Booking found');
    console.log('   Status:', rows[0].status);
    console.log('   Has qr_manifest:', !!rows[0].qr_manifest);

    const booking = rows[0];
    const verification = verifyQrPayload({
      bookingId,
      qrType,
      qrValue,
      manifest: booking.qr_manifest,
      bookingRow: booking,
    });

    if (!verification.ok) {
      // Return verification failure details
      let verificationStatus;
      if (verification.message.includes('locked')) {
        verificationStatus = {
          status: 'locked',
          reason: 'Agent has not arrived',
          message: verification.message,
        };
      } else if (verification.message.includes('does not belong')) {
        verificationStatus = {
          status: 'invalid',
          reason: 'QR mismatch',
          message: verification.message,
        };
      } else if (verification.message.includes('signature')) {
        verificationStatus = {
          status: 'invalid',
          reason: 'Invalid signature',
          message: 'QR code appears to be tampered or expired',
        };
      } else {
        verificationStatus = {
          status: 'invalid',
          reason: 'Verification failed',
          message: verification.message,
        };
      }

      return res.status(400).json({
        success: false,
        verificationStatus,
      });
    }

    // Get comprehensive verification status
    const verificationStatus = getVerificationStatus(booking, qrType);
    const bookingDetails = formatBookingForVerification(booking, qrType);

    console.log('✅ QR VERIFICATION SUCCESSFUL');
    console.log('   Status:', verificationStatus.status);
    console.log('   Booking Details returned');

    return res.json({
      success: true,
      verificationStatus,
      booking: bookingDetails,
      bookingId,
      qrType,
      message: 'QR verified - awaiting confirmation',
    });
  } catch (error) {
    console.error('❌ verify-qr error:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      success: false,
      verificationStatus: { status: 'error', message: 'Verification service error' },
      error: error.message,
    });
  }
});

// New endpoint: Confirm QR verification after agent reviews details
router.post("/confirm-qr-verification/:bookingId", async (req, res) => {
  const { bookingId } = req.params;
  const { qrType, agentId, agentName } = req.body;

  if (!['pickup', 'destination'].includes(qrType)) {
    return res.status(400).json({ success: false, message: 'Invalid QR type' });
  }

  try {
    const rows = await runQuery('SELECT * FROM bookings WHERE id = ? LIMIT 1', [bookingId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = rows[0];

    if (qrType === 'pickup') {
      // Check if already verified
      if (booking.pickup_verified_at) {
        return res.status(400).json({
          success: false,
          message: 'Pickup already verified for this booking',
          previousVerification: {
            verifiedAt: booking.pickup_verified_at,
            agentId: booking.pickup_verified_by_agent_id,
          },
        });
      }

      // Update booking with pickup verification
      await runQuery(
        `UPDATE bookings SET
          status = 'picked_up',
          assignment_status = 'picked_up',
          pickup_verified = 1,
          pickup_verified_at = CURRENT_TIMESTAMP,
          pickup_verified_by_agent_id = ?,
          pickup_verified_by_agent_name = ?
         WHERE id = ?`,
        [agentId, agentName || null, bookingId]
      );
    } else {
      // Destination verification
      // Check if destination is unlocked
      if (!booking.destination_qr_unlocked_at) {
        return res.status(400).json({
          success: false,
          message: 'Destination QR is still locked',
        });
      }

      // Check if already verified
      if (booking.delivery_verified_at) {
        return res.status(400).json({
          success: false,
          message: 'Delivery already verified for this booking',
          previousVerification: {
            verifiedAt: booking.delivery_verified_at,
            agentId: booking.delivery_verified_by_agent_id,
          },
        });
      }

      // Update booking with delivery verification
      await runQuery(
        `UPDATE bookings SET
          status = 'delivered',
          assignment_status = 'delivered',
          delivery_verified_at = CURRENT_TIMESTAMP,
          delivery_verified_by_agent_id = ?
         WHERE id = ?`,
        [agentId, bookingId]
      );

      // Close active agent session
      const sessions = await runQuery(
        "SELECT session_id, agent_id FROM agent_sessions WHERE booking_id = ? AND status = 'active' LIMIT 1",
        [bookingId]
      );
      if (sessions.length) {
        const { session_id, agent_id } = sessions[0];
        await runQuery(
          "UPDATE agent_sessions SET status = 'completed', end_time = CURRENT_TIMESTAMP WHERE session_id = ?",
          [session_id]
        );
        await runQuery(
          "UPDATE support_agents SET status = 'available', current_user_id = NULL WHERE agent_id = ?",
          [agent_id]
        );
      }
    }

    // Fetch updated booking
    const updatedRows = await runQuery('SELECT * FROM bookings WHERE id = ? LIMIT 1', [bookingId]);
    const updatedBooking = updatedRows[0];

    return res.json({
      success: true,
      message: qrType === 'pickup' ? 'Pickup verified successfully' : 'Delivery verified successfully',
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        pickupVerified: Boolean(updatedBooking.pickup_verified),
        pickupVerifiedAt: updatedBooking.pickup_verified_at,
        pickupVerifiedByAgentId: updatedBooking.pickup_verified_by_agent_id,
        pickupVerifiedByAgentName: updatedBooking.pickup_verified_by_agent_name,
        verifiedAt: qrType === 'pickup' ? updatedBooking.pickup_verified_at : updatedBooking.delivery_verified_at,
        verifiedByAgentId: qrType === 'pickup' ? updatedBooking.pickup_verified_by_agent_id : updatedBooking.delivery_verified_by_agent_id,
        verifiedByAgentName: agentName,
      },
    });
  } catch (error) {
    console.error('confirm-qr-verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to confirm verification',
      error: error.message,
    });
  }
});

// Cancel booking with custom fee and refund calculations
router.post("/cancel/:bookingId", verifyToken, async (req, res) => {
  const { bookingId } = req.params;
  const { reason } = req.body;

  try {
    // 1. Fetch the booking
    const bookings = await runQuery("SELECT * FROM bookings WHERE id = ?", [bookingId]);
    if (!bookings.length) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    const booking = bookings[0];

    // Check if already completed or cancelled
    if (booking.status === 'completed' || booking.status === 'delivered') {
      return res.status(400).json({ success: false, message: "Cannot cancel a completed booking" });
    }
    if (booking.status === 'cancelled') {
      return res.json({ 
        success: true, 
        message: "Booking is already cancelled", 
        cancellationFee: Number(booking.cancellation_fee || 0),
        refundAmount: Number(booking.refund_amount || 0) 
      });
    }

    let cancellationFee = 0;
    let distanceTraveled = 0;

    // 2. If agent has marked arrival at pickup, charge flat ₹100 penalty
    if (booking.arrived_at) {
      cancellationFee = 100;
      console.log(`[CANCEL] Booking #${bookingId} - Agent has arrived at pickup. Flat ₹100 penalty charged.`);
    } else if (booking.assigned_agent_id) {
      const agentId = booking.assigned_agent_id;
      
      // Get agent's current location from support_agents
      const agents = await runQuery("SELECT latitude, longitude FROM support_agents WHERE agent_id = ?", [agentId]);
      if (agents.length > 0) {
        const agent = agents[0];
        const currentLat = toNumberOrNull(agent.latitude);
        const currentLng = toNumberOrNull(agent.longitude);
        const startLat = toNumberOrNull(booking.agent_start_lat);
        const startLng = toNumberOrNull(booking.agent_start_lng);

        console.log(`[CANCEL] Booking #${bookingId} - Agent Start: (${startLat}, ${startLng}), Live: (${currentLat}, ${currentLng})`);

        if (currentLat !== null && currentLng !== null && startLat !== null && startLng !== null) {
          // Calculate distance in km
          distanceTraveled = haversineKm(startLat, startLng, currentLat, currentLng);
          // If agent has moved more than 50 meters, charge ₹10/km, else ₹0
          if (distanceTraveled > 0.05) {
            cancellationFee = Number((distanceTraveled * 10).toFixed(2));
          }
        }
      }
    }

    const amountPaid = Number(booking.amount || 0);
    const refundAmount = Math.max(0, Number((amountPaid - cancellationFee).toFixed(2)));

    // 3. Update status and save cancellation details in the database
    await runQuery(
      `UPDATE bookings SET 
        status = 'cancelled', 
        assignment_status = 'cancelled', 
        cancellation_reason = ?,
        cancellation_fee = ?,
        refund_amount = ?
       WHERE id = ?`,
      [reason || 'User Cancelled', cancellationFee, refundAmount, bookingId]
    );

    // 4. Cancel the queue status for this booking
    await runQuery("UPDATE agent_queue SET status = 'cancelled' WHERE booking_id = ?", [bookingId]);

    // 5. If agent was assigned, free them up and terminate active session
    if (booking.assigned_agent_id) {
      const agentId = booking.assigned_agent_id;
      // Terminate active agent sessions
      await runQuery(
        "UPDATE agent_sessions SET status = 'completed', end_time = CURRENT_TIMESTAMP WHERE booking_id = ? AND status = 'active'",
        [bookingId]
      );
      // Free the agent
      await runQuery(
        "UPDATE support_agents SET status = 'available', current_user_id = NULL WHERE agent_id = ?",
        [agentId]
      );
    }

    console.log(`[CANCEL] Booking #${bookingId} Cancelled. Paid: ₹${amountPaid}, Fee: ₹${cancellationFee}, Refund: ₹${refundAmount}`);

    return res.json({
      success: true,
      message: "Booking cancelled successfully",
      cancellationFee,
      refundAmount,
      amountPaid,
      distanceTraveled: Number(distanceTraveled.toFixed(2))
    });

  } catch (error) {
    console.error("Cancel booking error:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel booking", error: error.message });
  }
});

// Submit rating and comment for completed booking
router.post("/rating/:bookingId", verifyToken, async (req, res) => {
  const { bookingId } = req.params;
  const { rating, comment } = req.body;

  if (rating === undefined || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
  }

  try {
    // Check if booking exists
    const bookings = await runQuery("SELECT * FROM bookings WHERE id = ?", [bookingId]);
    if (!bookings.length) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    
    // Verify booking status is delivered or completed
    const booking = bookings[0];
    const status = String(booking.status || '').toLowerCase().trim();
    if (status !== 'delivered' && status !== 'completed') {
      return res.status(400).json({ success: false, message: "Can only rate completed bookings" });
    }

    await runQuery(
      "UPDATE bookings SET rating = ?, rating_comment = ? WHERE id = ?",
      [rating, comment || null, bookingId]
    );

    return res.json({ success: true, message: "Rating submitted successfully" });
  } catch (error) {
    console.error("Submit rating error:", error);
    return res.status(500).json({ success: false, message: "Failed to submit rating", error: error.message });
  }
});

module.exports = router;
module.exports.queueBookingForAgentDashboard = queueBookingForAgentDashboard;