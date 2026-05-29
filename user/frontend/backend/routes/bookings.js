const express = require("express");
const { latLngToCell, gridDistance } = require("h3-js");
const router = express.Router();
const db = require("../db");
const { computeAgentSchedule } = require("../utils/agentSchedule");

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
    // If already in YYYY-MM-DD format, return as is
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
    // Try to parse and reformat
    try {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    } catch (e) {
      return null;
    }
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return null;
};

// Helper function to format times as HH:MM:SS
const formatTime = (time) => {
  if (!time) return null;
  const timeText = String(time).trim();
  if (!timeText) return null;

  // Convert 12-hour format (e.g., "5:30 PM") to 24-hour format
  if (timeText.includes('AM') || timeText.includes('PM')) {
    const isPM = timeText.toUpperCase().includes('PM');
    const cleanTime = timeText.replace(/\s*(AM|PM)/i, '').trim();
    const parts = cleanTime.split(':');
    let hour = parseInt(parts[0], 10);
    const minute = parts[1] ? parseInt(parts[1], 10) : 0;
    
    if (isPM && hour !== 12) {
      hour += 12;
    } else if (!isPM && hour === 12) {
      hour = 0;
    }
    
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  }

  // If already in HH:MM:SS format, return as is
  if (timeText.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
    const [h, m, s] = timeText.split(':');
    return `${String(h).padStart(2, '0')}:${m}:${s}`;
  }

  // If in HH:MM format, add :00
  if (timeText.match(/^\d{1,2}:\d{2}$/)) {
    const [h, m] = timeText.split(':');
    return `${String(h).padStart(2, '0')}:${m}:00`;
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
    const phoneVariants = getPhoneVariants(phone);
    if (!phoneVariants.length) {
      return resolve({ queued: false, reason: "missing-phone" });
    }

    const placeholders = phoneVariants.map(() => "?").join(",");
    const userSql = `SELECT id FROM users WHERE phone IN (${placeholders}) LIMIT 1`;

    db.query(userSql, phoneVariants, (userErr, users) => {
      if (userErr) return reject(userErr);
      const userId = users?.[0]?.id;
      if (!userId) {
        return resolve({ queued: false, reason: "user-not-found" });
      }

      const bestAgentSql = `
        SELECT b.id, b.pickup_latitude, b.pickup_longitude, b.bag_weight,
               b.departure_date, b.pickup_time,
               a.agent_id, a.name, a.latitude, a.longitude, a.h3_index, a.vehicle_type, a.max_weight_kg,
               a.location_updated_at
        FROM bookings b
        LEFT JOIN support_agents a ON a.status = 'available'
          AND a.latitude IS NOT NULL
          AND a.longitude IS NOT NULL
        WHERE b.id = ?
      `;

      db.query(bestAgentSql, [bookingId], (bestErr, rows) => {
        if (bestErr) return reject(bestErr);

        const booking = rows?.[0];
        const userLat = toNumberOrNull(booking?.pickup_latitude);
        const userLng = toNumberOrNull(booking?.pickup_longitude);
        const requiredWeightKg = parseWeightKg(booking?.bag_weight);

        let preferredAgentId = null;
        if (booking && userLat !== null && userLng !== null) {
          const userH3 = latLngToCell(userLat, userLng, H3_RESOLUTION);
          let bestScore = Number.POSITIVE_INFINITY;
          const rankedCandidates = [];

          for (const row of rows) {
            if (!row?.agent_id) continue;

            const aLat = toNumberOrNull(row.latitude);
            const aLng = toNumberOrNull(row.longitude);
            if (aLat === null || aLng === null) continue;

            const maxWeightKg = resolveAgentCapacityKg(row);
            if (Number.isFinite(requiredWeightKg) && Number.isFinite(maxWeightKg) && requiredWeightKg > maxWeightKg) {
              continue;
            }

            let h3Distance = 8;
            let agentH3 = null;
            try {
              agentH3 = row.h3_index || latLngToCell(aLat, aLng, H3_RESOLUTION);
              h3Distance = gridDistance(userH3, agentH3);
            } catch (_e) {
              h3Distance = 8;
              agentH3 = null;
            }

            const distanceKm = haversineKm(userLat, userLng, aLat, aLng);
            let freshnessPenalty = 1200;
            if (row.location_updated_at) {
              const minutesSinceUpdate = Math.max(
                0,
                (Date.now() - new Date(row.location_updated_at).getTime()) / 60000
              );

              freshnessPenalty = minutesSinceUpdate <= AGENT_STALE_MINUTES
                ? minutesSinceUpdate * 0.1
                : 1000 + (minutesSinceUpdate - AGENT_STALE_MINUTES);
            }

            const score = distanceKm + Number(h3Distance || 0) * 0.8 + freshnessPenalty;

            rankedCandidates.push({
              agentId: Number(row.agent_id),
              name: row.name || 'Agent',
              agentH3,
              h3Distance,
              distanceKm: Number(distanceKm.toFixed(3)),
              score: Number(score.toFixed(3)),
              vehicleType: row.vehicle_type || null,
              maxWeightKg,
            });

            if (score < bestScore) {
              bestScore = score;
              preferredAgentId = Number(row.agent_id);
            }
          }

          rankedCandidates.sort((a, b) => a.score - b.score);
          logBookingH3Scenarios({
            bookingId,
            userH3,
            rankedCandidates,
          });

          const bestCandidate = rankedCandidates[0] || null;
          const bestAgentRow = bestCandidate
            ? rows.find((row) => Number(row.agent_id) === Number(bestCandidate.agentId))
            : null;

          if (bestCandidate && bestAgentRow) {
            const schedule = computeAgentSchedule({
              pickupLatitude: userLat,
              pickupLongitude: userLng,
              agentLatitude: toNumberOrNull(bestAgentRow.latitude),
              agentLongitude: toNumberOrNull(bestAgentRow.longitude),
              departureDate: booking.departure_date,
              pickupTime: booking.pickup_time,
              agentH3Index: bestAgentRow.h3_index,
            });

            const pickupAtSql = schedule.pickupAt
              ? schedule.pickupAt.toISOString().slice(0, 19).replace("T", " ")
              : null;
            const leaveBySql = schedule.leaveByAt
              ? schedule.leaveByAt.toISOString().slice(0, 19).replace("T", " ")
              : null;

            db.query(
              `UPDATE bookings
               SET assigned_agent_id = ?,
                   assignment_due_at = COALESCE(?, assignment_due_at),
                   agent_eta_minutes = ?,
                   agent_leave_by_at = ?,
                   pickup_h3_index = ?,
                   assignment_status = 'queued'
               WHERE id = ?`,
              [
                preferredAgentId,
                pickupAtSql,
                schedule.travelEtaMinutes,
                leaveBySql,
                schedule.userH3,
                bookingId,
              ],
              (scheduleErr) => {
                if (scheduleErr) {
                  console.error("[H3] Failed to persist schedule on booking:", scheduleErr.message);
                } else {
                  console.log(
                    `[H3] Booking ${bookingId}: travelEta=${schedule.travelEtaMinutes}min ` +
                    `leaveBy=${leaveBySql || "n/a"} pickupAt=${pickupAtSql || "n/a"} ` +
                    `h3Distance=${schedule.h3Distance} userH3=${schedule.userH3}`
                  );
                }
              }
            );
          }
        }

      const queueSql = `
        INSERT INTO agent_queue (user_id, booking_id, preferred_agent_id, status)
        VALUES (?, ?, ?, 'waiting')
        ON DUPLICATE KEY UPDATE
          booking_id = VALUES(booking_id),
          preferred_agent_id = VALUES(preferred_agent_id),
          declined_agent_ids = NULL,
          status = 'waiting',
          updated_at = CURRENT_TIMESTAMP
      `;

      db.query(queueSql, [userId, bookingId, preferredAgentId], (queueErr) => {
        if (queueErr) return reject(queueErr);

        db.query(
          `UPDATE bookings SET status = 'queued', assignment_status = 'queued' WHERE id = ?`,
          [bookingId],
          (bookingErr) => {
            if (bookingErr) return reject(bookingErr);
            resolve({ queued: true, userId, preferredAgentId });
          }
        );
      });
      });
    });
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
        photos, additional_info, assignment_due_at, assignment_status, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
             b.departure_city, b.arrival_city
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
          status: 'in-progress',
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
    res.json({
      success: true,
      customer: {
        name: row.user_name || row.username || "Customer",
        phone: row.user_phone || row.phone || "",
        pickupAddress: row.pickup_address || "",
        pickupLatitude: row.pickup_latitude,
        pickupLongitude: row.pickup_longitude,
      },
    });
  });
});

// Get booking - REQUIRES TOKEN
router.get("/:bookingId", verifyToken, (req, res) => {
  const { bookingId } = req.params;
  const phone = req.phone;

  const query = "SELECT * FROM bookings WHERE id = ? AND phone = ?";
  db.query(query, [bookingId, phone], (err, results) => {
    if (err) {
      return res.json({ success: false, message: "DB Error", error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    res.json({ success: true, booking: results[0] });
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
    res.json({ success: true, bookings: results });
  });
});

module.exports = router;
module.exports.queueBookingForAgentDashboard = queueBookingForAgentDashboard;