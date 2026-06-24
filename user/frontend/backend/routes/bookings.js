const express = require("express");
const { latLngToCell, gridDistance } = require("h3-js");
const router = express.Router();
const db = require("../db");
const { computeAgentSchedule } = require("../utils/agentSchedule");
const {
  BOOKING_STATUS,
  resolveCanonicalStatus,
  advanceBookingStatus,
} = require("../utils/bookingStatus");

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
    // Handle DD/MM/YYYY from the frontend (en-GB locale)
    if (date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const [day, month, year] = date.split('/');
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    // Try to parse and reformat
    try {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return null;
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

// Helper function to normalize booking status for client apps
const getBookingStatus = (status) => resolveCanonicalStatus(status);

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

const TRACKING_STATUSES = {
  confirmed: BOOKING_STATUS.CONFIRMED,
  pending: BOOKING_STATUS.CONFIRMED,
  agent_assigned: BOOKING_STATUS.AGENT_ASSIGNED,
  in_progress: BOOKING_STATUS.IN_PROGRESS,
  on_the_way: BOOKING_STATUS.ON_THE_WAY,
  completed: BOOKING_STATUS.COMPLETED,
};

const normalizeTrackingValue = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');

const normalizeBookingStatus = (value) => resolveCanonicalStatus(value);

const respondWithAdvancedBooking = async (res, bookingId, targetStatus, extraSets, prefix, logLabel) => {
  try {
    const result = await advanceBookingStatus(db, bookingId, targetStatus, extraSets);
    const booking = attachTrackingQr(result.booking);
    console.log(`${prefix} ${logLabel}:`, {
      bookingId,
      status: booking.status,
      advanced: result.advanced,
      idempotent: result.idempotent,
    });
    return res.json({ success: true, booking });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (error.code === 'INVALID_TRANSITION') {
      return res.status(409).json({
        success: false,
        message: error.message,
        currentStatus: error.current,
        targetStatus: error.target,
      });
    }
    console.error(`${prefix} error:`, error);
    return res.status(500).json({ success: false, message: 'Failed to update booking status' });
  }
};

const buildTrackingQrPayload = (booking, qrType) => {
  const bookingId = booking?.id;
  const phone = normalizeTrackingValue(booking?.phone || booking?.user_phone || '');
  const pickupAddress = normalizeTrackingValue(booking?.pickup_address || booking?.pickupAddress || '');
  const dropAddress = normalizeTrackingValue(booking?.drop_address || booking?.dropAddress || '');
  const pickupTime = normalizeTrackingValue(booking?.pickup_time || booking?.timeSlot || '');
  const target = qrType === 'delivery' ? dropAddress : pickupAddress;

  return `SL|${bookingId}|${qrType}|${target}|${phone}|${pickupTime}`;
};

const attachTrackingQr = (booking) => ({
  ...booking,
  tracking_qr: {
    pickup: buildTrackingQrPayload(booking, 'pickup'),
    delivery: buildTrackingQrPayload(booking, 'delivery'),
  },
});

const sendUpdatedBooking = (res, bookingId, prefix, logLabel) => {
  db.query('SELECT * FROM bookings WHERE id = ?', [bookingId], (err2, rows) => {
    if (err2 || !rows.length) {
      console.error(`${prefix} Failed to fetch updated booking:`, err2);
      return res.status(500).json({ success: false, message: 'Booking updated but fetch failed' });
    }

    const booking = attachTrackingQr(rows[0]);
    console.log(`${prefix} ${logLabel}:`, { bookingId, status: booking.status });
    return res.json({ success: true, booking });
  });
};

const releaseAgentSessionForBooking = (bookingId, callback) => {
  db.query(
    `SELECT agent_id FROM agent_sessions WHERE booking_id = ? AND status = 'active' LIMIT 1`,
    [bookingId],
    (sessionErr, sessions) => {
      if (sessionErr) {
        console.warn('[SessionRelease] lookup failed:', sessionErr.message);
        return callback?.();
      }

      db.query(
        `UPDATE agent_sessions
         SET status = 'completed', end_time = CURRENT_TIMESTAMP
         WHERE booking_id = ? AND status = 'active'`,
        [bookingId],
        (closeErr) => {
          if (closeErr) {
            console.warn('[SessionRelease] close failed:', closeErr.message);
            return callback?.();
          }

          const agentId = sessions?.[0]?.agent_id;
          if (!agentId) return callback?.();

          db.query(
            `SELECT COUNT(*) AS cnt FROM agent_sessions WHERE agent_id = ? AND status = 'active'`,
            [agentId],
            (countErr, countRows) => {
              if (countErr || !countRows?.length) return callback?.();
              if (Number(countRows[0].cnt) > 0) return callback?.();

              db.query(
                `UPDATE support_agents SET status = 'available', current_user_id = NULL WHERE agent_id = ?`,
                [agentId],
                () => callback?.()
              );
            }
          );
        }
      );
    }
  );
};

const repairOrphanQueuedBookings = () =>
  new Promise((resolve, reject) => {
    db.query(
      `UPDATE bookings
       SET status = 'on_the_way', assignment_status = 'on_the_way'
       WHERE status IN ('picked_up', 'pickup_completed', 'en_route', 'picked')
         AND status <> 'cancelled'`,
      (legacyPickupErr) => {
        if (legacyPickupErr) {
          console.warn('[InboxRepair] Legacy pickup status normalize failed:', legacyPickupErr.message);
        }

        db.query(
          `UPDATE bookings
           SET status = 'completed', assignment_status = 'completed'
           WHERE status = 'delivered'
             AND status <> 'cancelled'`,
          (legacyDeliveredErr) => {
            if (legacyDeliveredErr) {
              console.warn('[InboxRepair] Legacy delivered status normalize failed:', legacyDeliveredErr.message);
            }

            db.query(
              `UPDATE bookings
               SET status = 'confirmed', assignment_status = 'confirmed'
               WHERE payment_status = 'completed'
                 AND status IN ('queued', 'pending', 'scheduled')`,
              (normalizeErr) => {
                if (normalizeErr) {
                  console.warn('[InboxRepair] Legacy status normalize failed:', normalizeErr.message);
                }

                db.query(
                  `SELECT b.id, b.phone
                   FROM bookings b
                   LEFT JOIN agent_queue aq ON aq.booking_id = b.id AND aq.status = 'waiting'
                   WHERE b.status = 'confirmed'
                     AND b.payment_status = 'completed'
                     AND b.assignment_status = 'confirmed'
                     AND aq.id IS NULL
                     AND b.assigned_agent_id IS NULL
                   ORDER BY b.created_at DESC
                   LIMIT 20`,
                  async (err, rows) => {
                    if (err) return reject(err);
                    for (const row of rows || []) {
                      try {
                        await queueBookingForAgentDashboard(row.id, row.phone);
                        console.log('[InboxRepair] Re-queued orphan booking', row.id);
                      } catch (repairErr) {
                        console.warn('[InboxRepair] Failed for booking', row.id, repairErr?.message);
                      }
                    }
                    resolve();
                  }
                );
              }
            );
          }
        );
      }
    );
  });

const isTrackingQrMatch = (booking, qrType, qrValue) => {
  const expected = buildTrackingQrPayload(booking, qrType);
  const received = String(qrValue || '').trim();
  if (!received) return false;
  return received === expected;
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
                    assigned_at = COALESCE(assigned_at, CURRENT_TIMESTAMP),
                   assignment_due_at = COALESCE(?, assignment_due_at),
                   agent_eta_minutes = ?,
                   agent_leave_by_at = ?,
                   pickup_h3_index = ?
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
          `UPDATE bookings
           SET assigned_at = COALESCE(assigned_at, CURRENT_TIMESTAMP),
               status = CASE
                 WHEN status IN ('pending', 'scheduled', 'queued') THEN 'confirmed'
                 ELSE status
               END,
               assignment_status = CASE
                 WHEN assignment_status IN ('pending', 'scheduled', 'queued') THEN 'confirmed'
                 ELSE assignment_status
               END
           WHERE id = ?`,
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

const getUserIdByPhone = (phone) =>
  new Promise((resolve, reject) => {
    const variants = getPhoneVariants(phone);
    if (!variants.length) {
      return resolve(null);
    }

    const placeholders = variants.map(() => '?').join(',');
    db.query(
      `SELECT id FROM users WHERE phone IN (${placeholders}) ORDER BY id DESC LIMIT 1`,
      variants,
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows?.[0]?.id ?? null);
      }
    );
  });

// Create booking
router.post("/create", verifyToken, async (req, res) => {
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
    const userId = await getUserIdByPhone(req.phone);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User account not found for booking' });
    }

    const query = `
      INSERT INTO bookings (
        user_id, phone, username, is_international, is_domestic, airline_name, flight_number, terminal,
        departure_city, departure_airport, arrival_city, arrival_airport, departure_date, departure_time, arrival_date, arrival_time,
        bag_count, bag_weight, is_fragile, is_checkin, pincode, 
        pickup_address, pickup_latitude, pickup_longitude, pickup_time,
        drop_address, drop_latitude, drop_longitude,
        photos, additional_info, assignment_due_at, assignment_status, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      query,
      [
        userId,
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
router.get("/inbox", async (req, res) => {
  try {
    await repairOrphanQueuedBookings();
  } catch (repairErr) {
    console.warn('[Inbox] Orphan queue repair failed:', repairErr?.message);
  }

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
           b.drop_address, b.drop_latitude, b.drop_longitude, b.pickup_time, b.departure_date,
           b.bag_count, b.bag_weight, b.airline_name, b.flight_number, b.photos,
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
      },
    });
  });
});

// Agent profile for tracking (must be registered before /:bookingId)
router.get("/agent-profile/:bookingId", verifyToken, (req, res) => {
  const { bookingId } = req.params;
  const phone = req.phone;

  let phonesToTry = [phone];
  if (phone && phone.startsWith('+91')) {
    phonesToTry.push(phone.substring(3));
  } else if (phone && phone.length === 10 && !phone.startsWith('0')) {
    phonesToTry.push('+91' + phone);
  }

  const placeholders = phonesToTry.map(() => '?').join(' OR b.phone = ');
  const query = `
    SELECT b.assigned_agent_id,
           COALESCE(a.agent_id, s.agent_id) AS agent_id,
           COALESCE(a.name, s_agent.name) AS agent_name,
           COALESCE(a.phone, s_agent.phone) AS agent_phone,
           COALESCE(a.latitude, s_agent.latitude) AS agent_latitude,
           COALESCE(a.longitude, s_agent.longitude) AS agent_longitude,
           COALESCE(a.vehicle_type, s_agent.vehicle_type) AS agent_vehicle_type
    FROM bookings b
    LEFT JOIN support_agents a ON a.agent_id = b.assigned_agent_id
    LEFT JOIN agent_sessions s ON s.booking_id = b.id AND s.status = 'active'
    LEFT JOIN support_agents s_agent ON s_agent.agent_id = s.agent_id
    WHERE b.id = ? AND (b.phone = ${placeholders})
    LIMIT 1
  `;

  db.query(query, [bookingId, ...phonesToTry], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to load agent profile' });
    }
    if (!results.length || !results[0].agent_id) {
      return res.status(404).json({ success: false, message: 'Agent not found for this booking' });
    }
    const row = results[0];
    const name = String(row.agent_name || '').trim();
    return res.json({
      success: true,
      agent: {
        agentId: row.agent_id,
        id: row.agent_id,
        name: name || null,
        phone: row.agent_phone || null,
        latitude: row.agent_latitude,
        longitude: row.agent_longitude,
        vehicleType: row.agent_vehicle_type,
        vehicleNumber: row.agent_vehicle_type,
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

  const placeholders = phonesToTry.map(() => '?').join(' OR b.phone = ');
  const query = `
    SELECT b.*,
           COALESCE(a.agent_id, s.agent_id) AS resolved_agent_id,
           COALESCE(a.name, s_agent.name) AS agent_name,
           COALESCE(a.phone, s_agent.phone) AS agent_phone,
           COALESCE(a.latitude, s_agent.latitude) AS agent_latitude,
           COALESCE(a.longitude, s_agent.longitude) AS agent_longitude,
           COALESCE(a.vehicle_type, s_agent.vehicle_type) AS agent_vehicle_type
    FROM bookings b
    LEFT JOIN support_agents a ON a.agent_id = b.assigned_agent_id
    LEFT JOIN agent_sessions s ON s.booking_id = b.id AND s.status = 'active'
    LEFT JOIN support_agents s_agent ON s_agent.agent_id = s.agent_id
    WHERE b.id = ? AND (b.phone = ${placeholders})
  `;
  
  db.query(query, [bookingId, ...phonesToTry], (err, results) => {
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
    res.json({ success: true, booking: bookingData });
  });
});

// Get user bookings
router.get("/", verifyToken, (req, res) => {
  repairOrphanQueuedBookings().catch((repairErr) => {
    console.warn('[BookingsList] Orphan queue repair failed:', repairErr?.message);
  });

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

// === SIMPLIFIED BOOKING FLOW ===

// Accept booking - agent accepts a booking and gets assigned
router.patch('/accept/:bookingId', async (req, res) => {
  const { bookingId } = req.params;
  const { agentId } = req.body;

  if (!bookingId || !agentId) {
    return res.status(400).json({ success: false, message: 'Missing bookingId or agentId' });
  }

  return respondWithAdvancedBooking(
    res,
    bookingId,
    BOOKING_STATUS.AGENT_ASSIGNED,
    {
      assigned_agent_id: agentId,
      assigned_at: 'RAW:COALESCE(assigned_at, CURRENT_TIMESTAMP)',
    },
    '[BookingAccept]',
    'Booking assigned to agent'
  );
});

router.patch('/start/:bookingId', async (req, res) => {
  const { bookingId } = req.params;
  const agentId = Number(req.body?.agentId) || null;

  if (!bookingId) {
    return res.status(400).json({ success: false, message: 'Missing bookingId' });
  }

  const extraSets = {
    assigned_at: 'RAW:COALESCE(assigned_at, CURRENT_TIMESTAMP)',
    pickup_started_at: 'RAW:COALESCE(pickup_started_at, CURRENT_TIMESTAMP)',
  };
  if (agentId) {
    extraSets.assigned_agent_id = agentId;
  }

  await respondWithAdvancedBooking(
    res,
    bookingId,
    BOOKING_STATUS.IN_PROGRESS,
    extraSets,
    '[BookingStart]',
    'Booking marked in_progress'
  );

  if (agentId) {
    db.query(
      `INSERT INTO agent_sessions (user_id, booking_id, agent_id, status, start_time)
       SELECT b.user_id, b.id, ?, 'active', CURRENT_TIMESTAMP
       FROM bookings b
       WHERE b.id = ?
         AND NOT EXISTS (
           SELECT 1 FROM agent_sessions s
           WHERE s.booking_id = b.id AND s.status = 'active'
         )
       LIMIT 1`,
      [agentId, bookingId],
      (sessionErr) => {
        if (sessionErr) {
          console.warn('[BookingStart] Session sync warning:', sessionErr.message);
        }
      }
    );
  }
});

router.post('/verify-qr/:bookingId', (req, res) => {
  const { bookingId } = req.params;
  const { qrType, qrValue } = req.body || {};

  if (!bookingId || !qrType || !qrValue) {
    return res.status(400).json({ success: false, message: 'Missing bookingId, qrType, or qrValue' });
  }

  const normalizedType = normalizeTrackingValue(qrType);
  if (!['pickup', 'delivery'].includes(normalizedType)) {
    return res.status(400).json({ success: false, message: 'Invalid QR type' });
  }

  db.query('SELECT * FROM bookings WHERE id = ?', [bookingId], (err, rows) => {
    if (err) {
      console.error('[BookingQR] DB error:', err);
      return res.status(500).json({ success: false, message: 'Failed to verify QR' });
    }

    const booking = rows?.[0];
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const currentStatus = resolveCanonicalStatus(booking.status);
    if (normalizedType === 'pickup' && currentStatus !== BOOKING_STATUS.IN_PROGRESS) {
      return res.status(409).json({ success: false, message: 'Pickup QR can only be verified in_progress' });
    }
    if (normalizedType === 'delivery' && currentStatus !== BOOKING_STATUS.ON_THE_WAY) {
      return res.status(409).json({ success: false, message: 'Delivery QR can only be verified on_the_way' });
    }

    if (!isTrackingQrMatch(booking, normalizedType, qrValue)) {
      return res.status(400).json({ success: false, message: 'Invalid QR code' });
    }

    const nextStatus = normalizedType === 'pickup' ? BOOKING_STATUS.ON_THE_WAY : BOOKING_STATUS.COMPLETED;
    const extraSets = normalizedType === 'pickup'
      ? { pickup_completed_at: 'RAW:COALESCE(pickup_completed_at, CURRENT_TIMESTAMP)' }
      : { delivered_at: 'RAW:COALESCE(delivered_at, CURRENT_TIMESTAMP)' };

    advanceBookingStatus(db, bookingId, nextStatus, extraSets)
      .then(() => {
        if (normalizedType === 'delivery') {
          releaseAgentSessionForBooking(bookingId, () => {
            sendUpdatedBooking(res, bookingId, '[BookingQR]', `QR verified and status updated to ${nextStatus}`);
          });
          return;
        }
        sendUpdatedBooking(res, bookingId, '[BookingQR]', `QR verified and status updated to ${nextStatus}`);
      })
      .catch((updateErr) => {
        if (updateErr.code === 'INVALID_TRANSITION') {
          return res.status(409).json({ success: false, message: updateErr.message });
        }
        console.error('[BookingQR] Update error:', updateErr);
        return res.status(500).json({ success: false, message: 'Failed to update status after QR verification' });
      });
  });
});

// Mark booking as picked up (Pickup Confirmed → On the Way)
router.patch('/pickup/:bookingId', async (req, res) => {
  const { bookingId } = req.params;

  if (!bookingId) {
    return res.status(400).json({ success: false, message: 'Missing bookingId' });
  }

  return respondWithAdvancedBooking(
    res,
    bookingId,
    BOOKING_STATUS.ON_THE_WAY,
    {
      pickup_completed_at: 'RAW:COALESCE(pickup_completed_at, CURRENT_TIMESTAMP)',
    },
    '[BookingPickup]',
    'Booking marked on_the_way'
  );
});

// Mark booking as delivered (Delivery completed → Completed)
router.patch('/delivered/:bookingId', async (req, res) => {
  const { bookingId } = req.params;

  if (!bookingId) {
    return res.status(400).json({ success: false, message: 'Missing bookingId' });
  }

  try {
    await advanceBookingStatus(db, bookingId, BOOKING_STATUS.COMPLETED, {
      delivered_at: 'RAW:COALESCE(delivered_at, CURRENT_TIMESTAMP)',
    });
    releaseAgentSessionForBooking(bookingId, () => {
      sendUpdatedBooking(res, bookingId, '[BookingDelivered]', 'Booking marked completed');
    });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (error.code === 'INVALID_TRANSITION') {
      return res.status(409).json({ success: false, message: error.message });
    }
    console.error('[BookingDelivered] error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update delivery status' });
  }
});

// Cancel booking endpoint - supports different cancellation flows based on booking status
router.post('/cancel/:bookingId', verifyToken, (req, res) => {
  const { bookingId } = req.params;
  const phone = req.phone;
  const { reason } = req.body || {};

  if (!bookingId) {
    return res.status(400).json({ success: false, message: 'Missing bookingId' });
  }

  // Fetch the booking
  const bookingQuery = 'SELECT * FROM bookings WHERE id = ? AND phone = ?';
  db.query(bookingQuery, [bookingId, phone], (err, rows) => {
    if (err) {
      console.error('[BookingCancel] DB error:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch booking' });
    }

    if (!rows || !rows.length) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = rows[0];
    const currentStatus = normalizeBookingStatus(booking.status || booking.booking_status);
    const currentAssignmentStatus = normalizeBookingStatus(booking.assignment_status);

    // Block cancellation for on_the_way, completed, cancelled
    if (
      currentStatus === TRACKING_STATUSES.on_the_way ||
      currentStatus === TRACKING_STATUSES.completed ||
      currentStatus === 'cancelled' ||
      currentAssignmentStatus === TRACKING_STATUSES.on_the_way ||
      currentAssignmentStatus === TRACKING_STATUSES.completed ||
      currentAssignmentStatus === 'cancelled'
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking in ${currentStatus || currentAssignmentStatus} status`,
        cancellable: false
      });
    }

    // Calculate cancellation fee and refund based on status
    let cancellationFee = 0;
    let refundAmount = booking.amount || 0;
    let cancellationDistance = 0;
    let breakdownDetails = null;

    const totalAmount = booking.amount || 0;

    if (currentStatus === TRACKING_STATUSES.confirmed || currentStatus === 'queued' || currentStatus === 'pending') {
      // Booking Confirmed - within 2 minutes of creation
      const createdAt = new Date(booking.created_at).getTime();
      const now = Date.now();
      const minutesElapsed = (now - createdAt) / (1000 * 60);

      if (minutesElapsed > 2) {
        return res.status(400).json({
          success: false,
          message: 'Booking can only be cancelled within 2 minutes of creation',
          cancellable: false,
          minutesElapsed: Math.floor(minutesElapsed)
        });
      }

      cancellationFee = 0;
      refundAmount = totalAmount;
      breakdownDetails = {
        status: 'Booking Confirmed',
        timeSinceCreation: `${minutesElapsed.toFixed(1)} minutes`,
        distanceTravelled: '0 km',
        cancellationFeeFormula: '₹0',
        cancellationFee: 0,
        totalAmountPaid: totalAmount,
        refundAmount: refundAmount
      };
    } else if (currentStatus === TRACKING_STATUSES.agent_assigned) {
      // Agent Assigned - calculate distance travelled
      const agentId = booking.assigned_agent_id;

      if (!agentId) {
        cancellationFee = 0;
        refundAmount = Math.max(totalAmount - cancellationFee, 0);
        breakdownDetails = {
          status: 'Agent Assigned',
          distanceTravelled: '0 km',
          cancellationFeeFormula: '₹0',
          cancellationFee: 0,
          totalAmountPaid: totalAmount,
          refundAmount: refundAmount
        };
      } else {
        // Fetch agent's current location
        const agentQuery = 'SELECT latitude, longitude FROM support_agents WHERE agent_id = ?';
        db.query(agentQuery, [agentId], (agentErr, agentRows) => {
          if (agentErr || !agentRows || !agentRows.length) {
            cancellationFee = 0;
            refundAmount = Math.max(totalAmount - cancellationFee, 0);
            return finalizeCancellation({
              distanceTravelled: 0,
              distanceKm: 0,
              cancellationFee,
              refundAmount,
              breakdownDetails: {
                status: 'Agent Assigned',
                distanceTravelled: '0 km',
                cancellationFeeFormula: '₹0',
                cancellationFee,
                totalAmountPaid: totalAmount,
                refundAmount
              }
            });
          }

          const agent = agentRows[0];
          const agentLat = agent.latitude;
          const agentLng = agent.longitude;
          const pickupLat = booking.pickup_latitude;
          const pickupLng = booking.pickup_longitude;

          if (!agentLat || !agentLng || !pickupLat || !pickupLng) {
            cancellationFee = 0;
            refundAmount = Math.max(totalAmount - cancellationFee, 0);
            return finalizeCancellation({
              distanceTravelled: 0,
              distanceKm: 0,
              cancellationFee,
              refundAmount,
              breakdownDetails: {
                status: 'Agent Assigned',
                distanceTravelled: '0 km',
                cancellationFeeFormula: '₹0',
                cancellationFee,
                totalAmountPaid: totalAmount,
                refundAmount
              }
            });
          }

          // Calculate distance between agent and pickup location
          const distanceKm = haversineKm(agentLat, agentLng, pickupLat, pickupLng);
          cancellationDistance = distanceKm;

          cancellationFee = Math.round(distanceKm * 10);
          if (cancellationFee < 0) cancellationFee = 0;
          refundAmount = Math.max(totalAmount - cancellationFee, 0);

          breakdownDetails = {
            status: 'Agent Assigned',
            distanceTravelled: `${distanceKm.toFixed(2)} km`,
            cancellationFeeFormula: `₹10 × ${distanceKm.toFixed(2)} km`,
            cancellationFee: cancellationFee,
            totalAmountPaid: totalAmount,
            refundAmount: refundAmount
          };

          finalizeCancellation({
            distanceTravelled: distanceKm,
            distanceKm: distanceKm,
            cancellationFee,
            refundAmount,
            breakdownDetails
          });
        });
        return;
      }
    } else if (currentStatus === TRACKING_STATUSES.in_progress) {
      // Agent has reached pickup location
      cancellationFee = 150;
      refundAmount = Math.max(totalAmount - cancellationFee, 0);
      cancellationDistance = 0; // Already reached location

      breakdownDetails = {
        status: 'In Progress',
        distanceTravelled: '0 km',
        cancellationFeeFormula: '₹150',
        cancellationFee: cancellationFee,
        totalAmountPaid: totalAmount,
        refundAmount: refundAmount
      };
    }

    // If we reach here for 'pending', 'queued', 'in_progress', or agent_assigned with no agent data, finalize
    if (
      currentStatus === TRACKING_STATUSES.confirmed ||
      currentStatus === 'queued' ||
      currentStatus === 'pending' ||
      currentStatus === TRACKING_STATUSES.in_progress ||
      (currentStatus === TRACKING_STATUSES.agent_assigned && !booking.assigned_agent_id)
    ) {
      finalizeCancellation({
        distanceTravelled: cancellationDistance,
        distanceKm: cancellationDistance,
        cancellationFee,
        refundAmount,
        breakdownDetails
      });
    }

    // Helper function to finalize cancellation
    function finalizeCancellation(details) {
      const cancelQuery = `
        UPDATE bookings 
        SET status = 'cancelled',
            assignment_status = 'cancelled',
            cancellation_fee = ?,
            refund_amount = ?,
            cancellation_distance = ?,
            cancelled_by = 'customer',
            cancellation_reason = ?,
            cancelled_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.query(
        cancelQuery,
        [
          details.cancellationFee,
          details.refundAmount,
          details.distanceTravelled,
          reason || 'Customer initiated cancellation',
          bookingId
        ],
        (cancelErr, cancelResult) => {
          if (cancelErr) {
            console.error('[BookingCancel] Update error:', cancelErr);
            return res.status(500).json({ success: false, message: 'Failed to cancel booking' });
          }

          if (!cancelResult.affectedRows) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
          }

          // Remove any pending queue request for this booking so the agent request disappears.
          db.query('DELETE FROM agent_queue WHERE booking_id = ?', [bookingId], (queueErr) => {
            if (queueErr) {
              console.warn('[BookingCancel] Failed to remove booking from agent queue:', queueErr);
            } else {
              console.log('[BookingCancel] Removed booking', bookingId, 'from agent queue');
            }
          });

          // If there's an assigned agent, set their status back to Available
          if (booking.assigned_agent_id) {
            const agentUpdateQuery = `
              UPDATE support_agents 
              SET status = 'available', current_user_id = NULL
              WHERE agent_id = ?
            `;
            db.query(agentUpdateQuery, [booking.assigned_agent_id], (agentErr) => {
              if (agentErr) {
                console.warn('[BookingCancel] Failed to update agent status:', agentErr);
              } else {
                console.log('[BookingCancel] Agent', booking.assigned_agent_id, 'status set back to available');
              }
            });
          }

          // Fetch and return updated booking
          db.query('SELECT * FROM bookings WHERE id = ?', [bookingId], (err2, rows2) => {
            if (err2 || !rows2 || !rows2.length) {
              console.error('[BookingCancel] Failed to fetch updated booking:', err2);
              return res.status(500).json({
                success: true,
                message: 'Booking cancelled successfully',
                bookingId,
                cancellationDetails: {
                  cancellationFee: details.cancellationFee,
                  refundAmount: details.refundAmount,
                  breakdown: details.breakdownDetails
                }
              });
            }

            const updatedBooking = attachTrackingQr(rows2[0]);
            res.json({
              success: true,
              message: 'Booking cancelled successfully',
              booking: updatedBooking,
              cancellationDetails: {
                cancellationFee: details.cancellationFee,
                refundAmount: details.refundAmount,
                breakdown: details.breakdownDetails
              }
            });
          });
        }
      );
    }
  });
});

module.exports = router;
module.exports.queueBookingForAgentDashboard = queueBookingForAgentDashboard;
