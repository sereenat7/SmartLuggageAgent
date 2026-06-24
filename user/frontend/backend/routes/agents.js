const express = require("express");
const { Buffer } = require("buffer");
const { latLngToCell, gridDistance } = require("h3-js");
const router = express.Router();
const db = require("../db");
const { computeAgentSchedule, PICKUP_PREP_BUFFER_MIN } = require("../utils/agentSchedule");

const H3_RESOLUTION = 8;
const DEFAULT_CITY_SPEED_KMPH = 28;
// const PICKUP_PREP_BUFFER_MIN = 5;


const VEHICLE_WEIGHT_MAP = {
  bike: 10,
  bicycle: 10,
  motorcycle: 15,
  scooter: 15,
  auto: 30,
  'auto-rickshaw': 30,
  autorickshaw: 30,
  car: 50,
  sedan: 50,
  hatchback: 50,
  suv: 80,
  van: 100,
  minivan: 100,
  truck: 300,
  'mini truck': 200,
  'mini-truck': 200,
};

const vehicleWeightFromType = (vehicleType) => {
  if (!vehicleType) return null;
  return VEHICLE_WEIGHT_MAP[vehicleType.toLowerCase().trim()] ?? null;
};

const resolveAgentCapacityKg = (agentRow) => {
  const explicit = toNumberOrNull(agentRow?.max_weight_kg ?? agentRow?.maxWeightKg);
  const byVehicle = vehicleWeightFromType(agentRow?.vehicle_type ?? agentRow?.vehicleType);
  if (Number.isFinite(explicit) && Number.isFinite(byVehicle)) {
    return Math.max(explicit, byVehicle);
  }
  return byVehicle ?? explicit ?? 25;
};

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "No token provided" });
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [phone] = decoded.split(":");
    req.phone = phone;
    next();
  } catch (_err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

const getUserByPhone = (phone) =>
  new Promise((resolve, reject) => {
    const searchPhone = `%${phone.replace("+91", "")}`;
    db.query("SELECT id, name, phone FROM users WHERE phone LIKE ? LIMIT 1", [searchPhone], (err, rows) => {
      if (err) return reject(err);
      resolve(rows?.[0] || null);
    });
  });

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseDeclinedAgentIds = (value) => {
  if (!value) return [];
  const parsed = String(value)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  return Array.from(new Set(parsed));
};

const serializeDeclinedAgentIds = (ids) => {
  const normalized = Array.from(
    new Set((ids || []).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0))
  );
  return normalized.length ? normalized.join(',') : null;
};

const parseWeightKg = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const matches = text.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length === 0) return null;
  const lower = text.toLowerCase();
  if (lower.includes('-')) {
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

const toDateOrNull = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const parsePickupDateTime = (departureDate, pickupTime) => {
  if (!departureDate || !pickupTime) return null;
  const datePart = String(departureDate).trim();
  const timePart = String(pickupTime).trim();
  if (!datePart || !timePart) return null;
  const twelveHour = timePart.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    const ampm = twelveHour[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    const candidate = new Date(datePart);
    if (Number.isNaN(candidate.getTime())) return null;
    candidate.setHours(hours, minutes, 0, 0);
    return candidate;
  }
  const asDate = new Date(`${datePart} ${timePart}`);
  return Number.isNaN(asDate.getTime()) ? null : asDate;
};

const getLatestBookingContextForPhone = async (phone) => {
  const searchPhone = `%${String(phone || "").replace("+91", "")}`;
  const rows = await runQuery(
    `SELECT pickup_latitude, pickup_longitude, pickup_address,
            bag_weight, bag_count, is_fragile, is_checkin, created_at
     FROM bookings
     WHERE phone LIKE ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [searchPhone]
  );
  return rows[0] || null;
};

const toBoolean = (value) => {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
};

const scoreAgent = ({
  distanceKm, h3Distance, activeSessions, lastAssignedAt,
  requiredWeightKg, maxWeightKg, fragileRequired, supportsFragile,
  checkinRequired, supportsCheckin,
}) => {
  const safeH3Distance = Number.isFinite(h3Distance) ? h3Distance : 8;
  const loadPenalty = Number(activeSessions || 0) * 2.5;
  const requiredWeight = Number.isFinite(requiredWeightKg) ? requiredWeightKg : 0;
  const maxWeight = Number.isFinite(maxWeightKg) ? maxWeightKg : 20;
  const overweightBy = Math.max(0, requiredWeight - maxWeight);
  const capacityPenalty = overweightBy > 0 ? (1000 + overweightBy * 20) : 0;
  const fragilePenalty = fragileRequired && !supportsFragile ? 500 : 0;
  const checkinPenalty = checkinRequired && !supportsCheckin ? 350 : 0;
  let recencyPenalty = 0;
  if (lastAssignedAt) {
    const minutes = Math.max(0, (Date.now() - new Date(lastAssignedAt).getTime()) / 60000);
    recencyPenalty = 1 / (1 + minutes / 30);
  }
  return distanceKm * 1.0 + safeH3Distance * 0.8 + loadPenalty + recencyPenalty + capacityPenalty + fragilePenalty + checkinPenalty;
};

const greedyRankAgents = (candidates, limit, context = {}) => {
  const pool = [...candidates];
  const selected = [];
  const simulatedLoad = new Map(pool.map((c) => [c.agentId, c.activeSessions]));

  while (pool.length && selected.length < limit) {
    let bestIdx = 0;
    let bestScore = Infinity;
    for (let i = 0; i < pool.length; i += 1) {
      const item = pool[i];
      const score = scoreAgent({
        distanceKm: item.distanceKm,
        h3Distance: item.h3Distance,
        activeSessions: simulatedLoad.get(item.agentId) || 0,
        lastAssignedAt: item.lastAssignedAt,
        requiredWeightKg: context.requiredWeightKg,
        maxWeightKg: item.maxWeightKg,
        fragileRequired: context.fragileRequired,
        supportsFragile: item.supportsFragile,
        checkinRequired: context.checkinRequired,
        supportsCheckin: item.supportsCheckin,
      });
      if (score < bestScore) { bestScore = score; bestIdx = i; }
    }
    const chosen = pool.splice(bestIdx, 1)[0];
    const currentLoad = simulatedLoad.get(chosen.agentId) || 0;
    simulatedLoad.set(chosen.agentId, currentLoad + 1);
    const fit = Number.isFinite(context.requiredWeightKg) && Number.isFinite(chosen.maxWeightKg)
      ? context.requiredWeightKg <= chosen.maxWeightKg
      : true;
    selected.push({
      ...chosen,
      fit,
      score: Number(bestScore.toFixed(3)),
      matching: {
        requiredWeightKg: Number.isFinite(context.requiredWeightKg) ? context.requiredWeightKg : null,
        maxWeightKg: Number.isFinite(chosen.maxWeightKg) ? chosen.maxWeightKg : null,
        fragileRequired: Boolean(context.fragileRequired),
        supportsFragile: Boolean(chosen.supportsFragile),
        checkinRequired: Boolean(context.checkinRequired),
        supportsCheckin: Boolean(chosen.supportsCheckin),
      },
    });
  }
  return selected;
};

const getBestAgentIdForBooking = async (bookingId, options = {}) => {
  const excludedAgentIds = Array.from(
    new Set((options.excludedAgentIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
  );
  const bookingRows = await runQuery(
    `SELECT id, pickup_latitude, pickup_longitude, bag_weight, is_fragile, is_checkin
     FROM bookings WHERE id = ? LIMIT 1`,
    [bookingId]
  );
  if (!bookingRows.length) return null;
  const booking = bookingRows[0];
  const userLat = toNumberOrNull(booking.pickup_latitude);
  const userLng = toNumberOrNull(booking.pickup_longitude);
  if (userLat === null || userLng === null) return null;
  const userH3 = latLngToCell(userLat, userLng, H3_RESOLUTION);
  const requiredWeightKg = parseWeightKg(booking.bag_weight);
  const fragileRequired = toBoolean(booking.is_fragile);
  const checkinRequired = toBoolean(booking.is_checkin);
  const rows = await runQuery(
    `SELECT a.agent_id, a.name, a.phone, a.status, a.latitude, a.longitude, a.h3_index, a.last_assigned_at,
            a.vehicle_type, a.max_weight_kg, a.supports_fragile, a.supports_checkin,
            COUNT(s.session_id) AS active_sessions
     FROM support_agents a
     LEFT JOIN agent_sessions s ON s.agent_id = a.agent_id AND s.status = 'active'
     WHERE a.status = 'available'
       AND a.latitude IS NOT NULL
       AND a.longitude IS NOT NULL
       ${excludedAgentIds.length ? `AND a.agent_id NOT IN (${excludedAgentIds.map(() => '?').join(',')})` : ''}
     GROUP BY a.agent_id, a.name, a.phone, a.status, a.latitude, a.longitude, a.h3_index,
              a.last_assigned_at, a.vehicle_type, a.max_weight_kg, a.supports_fragile, a.supports_checkin`,
    excludedAgentIds,
  );
  const candidates = rows.map((row) => {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    const agentH3 = row.h3_index || latLngToCell(lat, lng, H3_RESOLUTION);
    let h3Distance = null;
    try { h3Distance = gridDistance(userH3, agentH3); } catch (_e) { h3Distance = null; }
    return {
      agentId: row.agent_id, name: row.name, phone: row.phone,
      distanceKm: Number(haversineKm(userLat, userLng, lat, lng).toFixed(3)),
      h3Distance, activeSessions: Number(row.active_sessions || 0),
      lastAssignedAt: row.last_assigned_at, vehicleType: row.vehicle_type || null,
      maxWeightKg: resolveAgentCapacityKg(row),
      supportsFragile: Number(row.supports_fragile || 0) === 1,
      supportsCheckin: Number(row.supports_checkin || 0) === 1,
    };
  });
  const ranked = greedyRankAgents(candidates, 1, { requiredWeightKg, fragileRequired, checkinRequired });
  return ranked.find((candidate) => candidate.fit !== false)?.agentId || null;
};

router.post("/register-agent", async (req, res) => {
  const { name, phone, maxWeightKg, supportsFragile, supportsCheckin } = req.body || {};
  const maxWeight = toNumberOrNull(maxWeightKg) || 25;
  const fragile = toBoolean(supportsFragile);
  const checkin = toBoolean(supportsCheckin);
  if (!name) return res.status(400).json({ success: false, message: "Agent name is required" });
  try {
    await runQuery(
      `INSERT INTO support_agents (name, phone, status, current_user_id, max_weight_kg, supports_fragile, supports_checkin)
       VALUES (?, ?, 'available', NULL, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), status = 'available', current_user_id = NULL,
         max_weight_kg = VALUES(max_weight_kg), supports_fragile = VALUES(supports_fragile),
         supports_checkin = VALUES(supports_checkin)`,
      [name, phone || null, maxWeight, fragile === null ? 1 : (fragile ? 1 : 0), checkin === null ? 1 : (checkin ? 1 : 0)]
    );
    const rows = await runQuery(
      "SELECT agent_id, name, phone, status, current_user_id FROM support_agents WHERE phone <=> ? OR (phone IS NULL AND ? IS NULL) ORDER BY agent_id DESC LIMIT 1",
      [phone || null, phone || null]
    );
    return res.json({ success: true, agent: rows[0] });
  } catch (error) {
    console.error("register-agent error:", error);
    return res.status(500).json({ success: false, message: "Failed to register agent" });
  }
});

router.post("/agent-login", async (req, res) => {
  const { agentId, phone, name, latitude, longitude, maxWeightKg, supportsFragile, supportsCheckin, vehicleType } = req.body || {};
  const lat = toNumberOrNull(latitude);
  const lng = toNumberOrNull(longitude);
  const maxWeight = vehicleWeightFromType(vehicleType) ?? toNumberOrNull(maxWeightKg);
  const fragile = toBoolean(supportsFragile);
  const checkin = toBoolean(supportsCheckin);
  const h3Index = lat !== null && lng !== null ? latLngToCell(lat, lng, H3_RESOLUTION) : null;
  const vType = vehicleType ? vehicleType.trim() : null;
  if (!agentId && !phone && !name) {
    return res.status(400).json({ success: false, message: "Provide agentId or phone/name" });
  }
  try {
    if (agentId) {
      await runQuery(
        `UPDATE support_agents
         SET status = 'available', current_user_id = NULL,
             latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
             h3_index = COALESCE(?, h3_index), vehicle_type = COALESCE(?, vehicle_type),
             max_weight_kg = COALESCE(?, max_weight_kg),
             supports_fragile = COALESCE(?, supports_fragile),
             supports_checkin = COALESCE(?, supports_checkin),
             location_updated_at = CASE WHEN ? IS NULL OR ? IS NULL THEN location_updated_at ELSE CURRENT_TIMESTAMP END
         WHERE agent_id = ?`,
        [lat, lng, h3Index, vType, maxWeight, fragile === null ? null : (fragile ? 1 : 0), checkin === null ? null : (checkin ? 1 : 0), lat, lng, agentId]
      );
      const rows = await runQuery(
        "SELECT agent_id, name, phone, status, current_user_id FROM support_agents WHERE agent_id = ? LIMIT 1",
        [agentId]
      );
      return res.json({ success: true, agent: rows[0] || null });
    }
    await runQuery(
      `INSERT INTO support_agents (name, phone, status, current_user_id, latitude, longitude, h3_index, vehicle_type, max_weight_kg, supports_fragile, supports_checkin, location_updated_at)
       VALUES (?, ?, 'available', NULL, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL OR ? IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), status = 'available', current_user_id = NULL,
         latitude = COALESCE(VALUES(latitude), latitude), longitude = COALESCE(VALUES(longitude), longitude),
         h3_index = COALESCE(VALUES(h3_index), h3_index), vehicle_type = COALESCE(VALUES(vehicle_type), vehicle_type),
         max_weight_kg = COALESCE(VALUES(max_weight_kg), max_weight_kg),
         supports_fragile = COALESCE(VALUES(supports_fragile), supports_fragile),
         supports_checkin = COALESCE(VALUES(supports_checkin), supports_checkin),
         location_updated_at = CASE WHEN VALUES(latitude) IS NULL OR VALUES(longitude) IS NULL THEN location_updated_at ELSE CURRENT_TIMESTAMP END`,
      [name || "Agent", phone || null, lat, lng, h3Index, vType, maxWeight,
       fragile === null ? null : (fragile ? 1 : 0), checkin === null ? null : (checkin ? 1 : 0), lat, lng]
    );
    const rows = await runQuery(
      "SELECT agent_id, name, phone, status, current_user_id FROM support_agents WHERE phone <=> ? OR (phone IS NULL AND ? IS NULL) ORDER BY agent_id DESC LIMIT 1",
      [phone || null, phone || null]
    );
    return res.json({ success: true, agent: rows[0] || null });
  } catch (error) {
    console.error("agent-login error:", error);
    return res.status(500).json({ success: false, message: "Failed to mark agent available" });
  }
});

router.post("/agent-location", async (req, res) => {
  const { agentId, phone, name, latitude, longitude, vehicleType } = req.body || {};
  const lat = toNumberOrNull(latitude);
  const lng = toNumberOrNull(longitude);
  if (lat === null || lng === null) {
    return res.status(400).json({ success: false, message: "latitude and longitude are required" });
  }
  const h3Index = latLngToCell(lat, lng, H3_RESOLUTION);
  const vType = vehicleType ? vehicleType.trim() : null;
  const derivedWeight = vehicleWeightFromType(vehicleType);
  let lookupPhone = phone || null;
  const lookupName = name || "Agent";
  try {
    if (agentId) {
      const updateResult = await runQuery(
        `UPDATE support_agents
         SET latitude = ?, longitude = ?, h3_index = ?, location_updated_at = CURRENT_TIMESTAMP,
             name = COALESCE(?, name), status = 'available',
             vehicle_type = COALESCE(?, vehicle_type), max_weight_kg = COALESCE(?, max_weight_kg)
         WHERE agent_id = ?`,
        [lat, lng, h3Index, name || null, vType, derivedWeight, agentId]
      );
      if (updateResult?.affectedRows) {
        const rows = await runQuery(
          "SELECT agent_id, name, phone, status, latitude, longitude, h3_index, location_updated_at FROM support_agents WHERE agent_id = ? LIMIT 1",
          [agentId]
        );
        return res.json({ success: true, agent: rows[0] });
      }
      if (!lookupPhone && lookupName) {
        const phoneByName = await runQuery(
          "SELECT phone FROM agents WHERE full_name = ? ORDER BY id DESC LIMIT 1",
          [lookupName]
        );
        if (phoneByName.length) lookupPhone = phoneByName[0].phone || null;
      }
    }
    if (!lookupPhone && !lookupName) {
      return res.status(400).json({ success: false, message: "Provide agentId or phone/name" });
    }
    await runQuery(
      `INSERT INTO support_agents (name, phone, status, current_user_id, latitude, longitude, h3_index, vehicle_type, max_weight_kg, location_updated_at)
       VALUES (?, ?, 'available', NULL, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), status = 'available', current_user_id = NULL,
         latitude = VALUES(latitude), longitude = VALUES(longitude), h3_index = VALUES(h3_index),
         vehicle_type = COALESCE(VALUES(vehicle_type), vehicle_type),
         max_weight_kg = COALESCE(VALUES(max_weight_kg), max_weight_kg),
         location_updated_at = CURRENT_TIMESTAMP`,
      [lookupName, lookupPhone, lat, lng, h3Index, vType, derivedWeight]
    );
    const rows = await runQuery(
      "SELECT agent_id, name, phone, status, latitude, longitude, h3_index, location_updated_at FROM support_agents WHERE phone <=> ? OR (phone IS NULL AND ? IS NULL) ORDER BY agent_id DESC LIMIT 1",
      [lookupPhone, lookupPhone]
    );
    return res.json({ success: true, agent: rows[0] || null });
  } catch (error) {
    console.error("agent-location error:", error);
    return res.status(500).json({ success: false, message: "Failed to update agent location" });
  }
});

router.post("/recommend-nearby", verifyToken, async (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.body?.limit || 3), 10));
  let userLat = toNumberOrNull(req.body?.latitude);
  let userLng = toNumberOrNull(req.body?.longitude);
  let requiredWeightKg = parseWeightKg(req.body?.bagWeightKg ?? req.body?.bagWeight);
  let fragileRequired = toBoolean(req.body?.isFragile);
  let checkinRequired = toBoolean(req.body?.isCheckin);
  try {
    const latestBooking = await getLatestBookingContextForPhone(req.phone);
    if (userLat === null || userLng === null) {
      if (latestBooking?.pickup_latitude && latestBooking?.pickup_longitude) {
        userLat = Number(latestBooking.pickup_latitude);
        userLng = Number(latestBooking.pickup_longitude);
      }
    }
    if (requiredWeightKg === null && latestBooking?.bag_weight !== undefined && latestBooking?.bag_weight !== null) {
      requiredWeightKg = parseWeightKg(latestBooking.bag_weight);
    }
    if (fragileRequired === null) fragileRequired = Boolean(latestBooking?.is_fragile);
    if (checkinRequired === null) checkinRequired = Boolean(latestBooking?.is_checkin);
    if (userLat === null || userLng === null) {
      return res.status(400).json({
        success: false,
        message: "Pickup location not found. Send latitude/longitude or create a booking with pickup coordinates.",
      });
    }
    const userH3 = latLngToCell(userLat, userLng, H3_RESOLUTION);
    const rows = await runQuery(
      `SELECT a.agent_id, a.name, a.phone, a.status, a.latitude, a.longitude, a.h3_index, a.last_assigned_at,
              a.vehicle_type, a.max_weight_kg, a.supports_fragile, a.supports_checkin,
              COUNT(s.session_id) AS active_sessions
       FROM support_agents a
       LEFT JOIN agent_sessions s ON s.agent_id = a.agent_id AND s.status = 'active'
       WHERE a.status = 'available' AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
       GROUP BY a.agent_id, a.name, a.phone, a.status, a.latitude, a.longitude, a.h3_index,
         a.last_assigned_at, a.vehicle_type, a.max_weight_kg, a.supports_fragile, a.supports_checkin`
    );
    const candidates = rows.map((row) => {
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      const agentH3 = row.h3_index || latLngToCell(lat, lng, H3_RESOLUTION);
      let h3Distance = null;
      try { h3Distance = gridDistance(userH3, agentH3); } catch (_e) { h3Distance = null; }
      return {
        agentId: row.agent_id, name: row.name, phone: row.phone,
        distanceKm: Number(haversineKm(userLat, userLng, lat, lng).toFixed(3)),
        h3Distance, activeSessions: Number(row.active_sessions || 0),
        lastAssignedAt: row.last_assigned_at, vehicleType: row.vehicle_type || null,
        maxWeightKg: resolveAgentCapacityKg(row),
        supportsFragile: Number(row.supports_fragile || 0) === 1,
        supportsCheckin: Number(row.supports_checkin || 0) === 1,
        latitude: lat, longitude: lng, h3Index: agentH3,
      };
    });
    const recommended = greedyRankAgents(candidates, limit, { requiredWeightKg, fragileRequired, checkinRequired });
    return res.json({
      success: true,
      strategy: { h3Resolution: H3_RESOLUTION, algorithm: "greedy-load-balanced" },
      userLocation: { latitude: userLat, longitude: userLng, h3Index: userH3 },
      requestContext: {
        requiredWeightKg: Number.isFinite(requiredWeightKg) ? requiredWeightKg : null,
        fragileRequired: Boolean(fragileRequired),
        checkinRequired: Boolean(checkinRequired),
      },
      recommended,
      bestAgent: recommended[0] || null,
    });
  } catch (error) {
    console.error("recommend-nearby error:", error);
    return res.status(500).json({ success: false, message: "Failed to rank nearby agents" });
  }
});

router.post("/assign-best-agent", verifyToken, async (req, res) => {
  try {
    const user = await getUserByPhone(req.phone);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const limit = Math.max(1, Math.min(Number(req.body?.limit || 5), 10));
    let userLat = toNumberOrNull(req.body?.latitude);
    let userLng = toNumberOrNull(req.body?.longitude);
    let requiredWeightKg = parseWeightKg(req.body?.bagWeightKg ?? req.body?.bagWeight);
    let fragileRequired = toBoolean(req.body?.isFragile);
    let checkinRequired = toBoolean(req.body?.isCheckin);
    const latestBooking = await getLatestBookingContextForPhone(req.phone);
    if ((userLat === null || userLng === null) && latestBooking?.pickup_latitude && latestBooking?.pickup_longitude) {
      userLat = Number(latestBooking.pickup_latitude);
      userLng = Number(latestBooking.pickup_longitude);
    }
    if (requiredWeightKg === null && latestBooking?.bag_weight !== undefined && latestBooking?.bag_weight !== null) {
      requiredWeightKg = parseWeightKg(latestBooking.bag_weight);
    }
    if (fragileRequired === null) fragileRequired = Boolean(latestBooking?.is_fragile);
    if (checkinRequired === null) checkinRequired = Boolean(latestBooking?.is_checkin);
    if (userLat === null || userLng === null) {
      await runQuery(
        `INSERT INTO agent_queue (user_id, preferred_agent_id, status)
         VALUES (?, NULL, 'waiting')
         ON DUPLICATE KEY UPDATE preferred_agent_id = NULL, declined_agent_ids = NULL, updated_at = CURRENT_TIMESTAMP`,
        [user.id]
      );
      return res.json({ success: true, assigned: false, queued: true, message: "No pickup coordinates found. Added to queue." });
    }
    const userH3 = latLngToCell(userLat, userLng, H3_RESOLUTION);
    const rows = await runQuery(
      `SELECT a.agent_id, a.name, a.phone, a.status, a.latitude, a.longitude, a.h3_index, a.last_assigned_at,
              a.vehicle_type, a.max_weight_kg, a.supports_fragile, a.supports_checkin,
              COUNT(s.session_id) AS active_sessions
       FROM support_agents a
       LEFT JOIN agent_sessions s ON s.agent_id = a.agent_id AND s.status = 'active'
       WHERE a.status = 'available' AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
       GROUP BY a.agent_id, a.name, a.phone, a.status, a.latitude, a.longitude, a.h3_index,
           a.last_assigned_at, a.vehicle_type, a.max_weight_kg, a.supports_fragile, a.supports_checkin`
    );
    const candidates = rows.map((row) => {
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      const agentH3 = row.h3_index || latLngToCell(lat, lng, H3_RESOLUTION);
      let h3Distance = null;
      try { h3Distance = gridDistance(userH3, agentH3); } catch (_e) { h3Distance = null; }
      return {
        agentId: row.agent_id, name: row.name, phone: row.phone,
        distanceKm: Number(haversineKm(userLat, userLng, lat, lng).toFixed(3)),
        h3Distance, activeSessions: Number(row.active_sessions || 0),
        lastAssignedAt: row.last_assigned_at, vehicleType: row.vehicle_type || null,
        maxWeightKg: resolveAgentCapacityKg(row),
        supportsFragile: Number(row.supports_fragile || 0) === 1,
        supportsCheckin: Number(row.supports_checkin || 0) === 1,
      };
    });
    const ranked = greedyRankAgents(candidates, limit, { requiredWeightKg, fragileRequired, checkinRequired });
    let assignedSession = null;
    for (const candidate of ranked) {
      if (candidate.fit === false) continue;
      const updateResult = await runQuery(
        `UPDATE support_agents SET status = 'busy', current_user_id = ?, last_assigned_at = CURRENT_TIMESTAMP
         WHERE agent_id = ? AND status = 'available'`,
        [user.id, candidate.agentId]
      );
      if (!updateResult.affectedRows) continue;
      const sessionResult = await runQuery(
        `INSERT INTO agent_sessions (user_id, agent_id, status, start_time) VALUES (?, ?, 'active', CURRENT_TIMESTAMP)`,
        [user.id, candidate.agentId]
      );
      assignedSession = {
        sessionId: sessionResult.insertId, agentId: candidate.agentId,
        agentName: candidate.name, agentPhone: candidate.phone, score: candidate.score,
      };
      break;
    }
    if (!assignedSession) {
      await runQuery(
        `INSERT INTO agent_queue (user_id, preferred_agent_id, status)
         VALUES (?, NULL, 'waiting')
         ON DUPLICATE KEY UPDATE preferred_agent_id = NULL, declined_agent_ids = NULL, updated_at = CURRENT_TIMESTAMP`,
        [user.id]
      );
      return res.json({ success: true, assigned: false, queued: true, message: "No fit available agent right now. Added to queue.", ranked });
    }
    await runQuery("DELETE FROM agent_queue WHERE user_id = ? AND status = 'waiting'", [user.id]);
    return res.json({ success: true, assigned: true, queued: false, message: "Best-fit agent assigned", session: assignedSession, ranked });
  } catch (error) {
    console.error("assign-best-agent error:", error);
    return res.status(500).json({ success: false, message: "Failed to assign best agent" });
  }
});

router.post("/request-agent", verifyToken, async (req, res) => {
  let user;
  try {
    const preferredAgentId = Number(req.body?.preferredAgentId) || null;
    const bookingId = Number(req.body?.bookingId) || null;
    user = await getUserByPhone(req.phone);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    let resolvedPreferredAgentId = preferredAgentId;
    if (!resolvedPreferredAgentId && bookingId) {
      resolvedPreferredAgentId = await getBestAgentIdForBooking(bookingId);
    }
    await runQuery(
      `INSERT INTO agent_queue (user_id, booking_id, preferred_agent_id, status)
       VALUES (?, ?, ?, 'waiting')
       ON DUPLICATE KEY UPDATE booking_id = VALUES(booking_id), preferred_agent_id = VALUES(preferred_agent_id),
         declined_agent_ids = NULL, updated_at = CURRENT_TIMESTAMP`,
      [user.id, bookingId, resolvedPreferredAgentId]
    );
    return res.json({
      success: true, assigned: false, queued: true,
      preferredAgentId: resolvedPreferredAgentId,
      message: "Request queued. Waiting for an agent to accept.",
    });
  } catch (error) {
    console.error("request-agent error:", error);
    return res.status(500).json({ success: false, message: "Failed to request agent" });
  }
});

router.get("/inbox", async (req, res) => {
  try {
    let currentAgentId = Number(req.query?.agentId) || Number(req.query?.agent_id) || null;
    const currentAgentPhoneRaw = req.query?.phone || req.query?.mobile || req.query?.agentPhone || null;

    if (currentAgentId) {
      const agentRows = await runQuery(
        "SELECT agent_id FROM support_agents WHERE agent_id = ? OR current_user_id = ? LIMIT 1",
        [currentAgentId, currentAgentId]
      );
      if (agentRows.length) {
        currentAgentId = Number(agentRows[0].agent_id) || null;
      }
    }

    if (!currentAgentId && currentAgentPhoneRaw) {
      const digits = String(currentAgentPhoneRaw).replace(/\D+/g, "");
      const lastTen = digits.slice(-10);
      if (lastTen) {
        const phoneAgentRows = await runQuery(
          `SELECT agent_id FROM support_agents
           WHERE REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', '') LIKE ?
           ORDER BY agent_id ASC LIMIT 1`,
          [`%${lastTen}`]
        );
        if (phoneAgentRows.length) {
          currentAgentId = Number(phoneAgentRows[0].agent_id) || null;
        }
      }
    }
    let currentAgentCoords = null;
    if (currentAgentId) {
      const agentRows = await runQuery(
        "SELECT latitude, longitude FROM support_agents WHERE agent_id = ? LIMIT 1",
        [currentAgentId]
      );
      if (agentRows.length) {
        const lat = toNumberOrNull(agentRows[0].latitude);
        const lng = toNumberOrNull(agentRows[0].longitude);
        if (lat !== null && lng !== null) currentAgentCoords = { lat, lng };
      }
    }
    const waitingRows = await runQuery(
      `SELECT q.id, q.user_id, q.booking_id, q.preferred_agent_id, q.declined_agent_ids, q.status, q.requested_at,
              u.name, u.phone,
              b.pickup_time, b.departure_date, b.bag_count, b.bag_weight, b.pickup_address,
              b.pickup_latitude, b.pickup_longitude, b.drop_address, b.airline_name, b.flight_number,
              b.assignment_due_at, b.agent_eta_minutes, b.agent_leave_by_at, b.pickup_h3_index, b.assigned_agent_id,
              b.photos
       FROM agent_queue q
       JOIN users u ON u.id = q.user_id
       LEFT JOIN bookings b ON b.id = q.booking_id
       WHERE q.status = 'waiting'
         AND q.requested_at >= DATE_SUB(NOW(), INTERVAL 2 DAY)
       ORDER BY q.requested_at ASC`
    );
    const visibleWaiting = [];
    for (const row of waitingRows) {
      const declinedAgentIds = parseDeclinedAgentIds(row.declined_agent_ids);
      let targetAgentId = Number(row.preferred_agent_id) || null;
      if (!targetAgentId && row.booking_id) {
        targetAgentId = await getBestAgentIdForBooking(row.booking_id, { excludedAgentIds: declinedAgentIds });
        if (targetAgentId) {
          // ✅ FIXED: was queue_id, correct column is id
          await runQuery(
            `UPDATE agent_queue SET preferred_agent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [targetAgentId, row.id]
          );
        }
      }
      if (currentAgentId && targetAgentId && targetAgentId !== currentAgentId) continue;
      const pickupLat = toNumberOrNull(row.pickup_latitude);
      const pickupLng = toNumberOrNull(row.pickup_longitude);
      const storedTravelEta = toNumberOrNull(row.agent_eta_minutes);
      const storedLeaveBy = toDateOrNull(row.agent_leave_by_at);
      const targetPickupAt =
        toDateOrNull(row.assignment_due_at) || parsePickupDateTime(row.departure_date, row.pickup_time);

      let distanceKm = null;
      let travelEtaMinutes = storedTravelEta;
      let leaveByAt = storedLeaveBy;

      if (currentAgentCoords && pickupLat !== null && pickupLng !== null) {
        distanceKm = Number(
          haversineKm(currentAgentCoords.lat, currentAgentCoords.lng, pickupLat, pickupLng).toFixed(2)
        );
        const liveSchedule = computeAgentSchedule({
          pickupLatitude: pickupLat,
          pickupLongitude: pickupLng,
          agentLatitude: currentAgentCoords.lat,
          agentLongitude: currentAgentCoords.lng,
          departureDate: row.departure_date,
          pickupTime: row.pickup_time,
        });
        if (!Number.isFinite(travelEtaMinutes)) {
          travelEtaMinutes = liveSchedule.travelEtaMinutes;
        }
        if (!leaveByAt) {
          leaveByAt = liveSchedule.leaveByAt;
        }
      }

      const etaMinutes =
        Number.isFinite(travelEtaMinutes) ? travelEtaMinutes + PICKUP_PREP_BUFFER_MIN : null;
      const urgencyMinutes = leaveByAt ? Math.round((leaveByAt.getTime() - Date.now()) / 60000) : null;
      visibleWaiting.push({
        ...row,
        preferred_agent_id: targetAgentId || row.preferred_agent_id,
        declined_agent_ids: serializeDeclinedAgentIds(declinedAgentIds),
        distance_km: distanceKm,
        travel_eta_minutes: travelEtaMinutes,
        eta_minutes: etaMinutes,
        pickup_h3_index: row.pickup_h3_index || null,
        target_pickup_at: targetPickupAt ? targetPickupAt.toISOString() : null,
        leave_by_at: leaveByAt ? leaveByAt.toISOString() : null,
        urgency_minutes: urgencyMinutes,
      });
    }
    visibleWaiting.sort((a, b) => {
      const aUrgency = Number.isFinite(a.urgency_minutes) ? a.urgency_minutes : Number.POSITIVE_INFINITY;
      const bUrgency = Number.isFinite(b.urgency_minutes) ? b.urgency_minutes : Number.POSITIVE_INFINITY;
      if (aUrgency !== bUrgency) return aUrgency - bUrgency;
      const aEta = Number.isFinite(a.eta_minutes) ? a.eta_minutes : Number.POSITIVE_INFINITY;
      const bEta = Number.isFinite(b.eta_minutes) ? b.eta_minutes : Number.POSITIVE_INFINITY;
      if (aEta !== bEta) return aEta - bEta;
      const aDistance = Number.isFinite(a.distance_km) ? a.distance_km : Number.POSITIVE_INFINITY;
      const bDistance = Number.isFinite(b.distance_km) ? b.distance_km : Number.POSITIVE_INFINITY;
      if (aDistance !== bDistance) return aDistance - bDistance;
      return new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime();
    });
    const activeSql = currentAgentId
      ? `SELECT s.session_id, s.user_id, s.agent_id, s.booking_id, s.start_time, a.name AS agent_name, a.phone AS agent_phone,
              u.name AS user_name, u.phone AS user_phone,
              b.pickup_address, b.pickup_latitude, b.pickup_longitude,
              b.drop_address, b.drop_latitude, b.drop_longitude,
              b.pickup_time, b.departure_date, b.bag_count, b.bag_weight,
              b.airline_name, b.flight_number, b.assignment_due_at, b.photos,
              b.status, b.pickup_verified, b.pickup_verified_at, b.pickup_verified_by_agent_name, b.delivery_verified_at
          FROM agent_sessions s
          JOIN support_agents a ON a.agent_id = s.agent_id
          JOIN users u ON u.id = s.user_id
          LEFT JOIN bookings b ON b.id = s.booking_id
          WHERE s.status = 'active' AND s.agent_id = ? ORDER BY s.start_time DESC`
      : `SELECT s.session_id, s.user_id, s.agent_id, s.booking_id, s.start_time, a.name AS agent_name, a.phone AS agent_phone,
              u.name AS user_name, u.phone AS user_phone,
              b.pickup_address, b.pickup_latitude, b.pickup_longitude,
              b.drop_address, b.drop_latitude, b.drop_longitude,
              b.pickup_time, b.departure_date, b.bag_count, b.bag_weight,
              b.airline_name, b.flight_number, b.assignment_due_at, b.photos,
              b.status, b.pickup_verified, b.pickup_verified_at, b.pickup_verified_by_agent_name, b.delivery_verified_at
          FROM agent_sessions s
          JOIN support_agents a ON a.agent_id = s.agent_id
          JOIN users u ON u.id = s.user_id
          LEFT JOIN bookings b ON b.id = s.booking_id
          WHERE s.status = 'active' ORDER BY s.start_time DESC`;
    const activeRows = await runQuery(activeSql, currentAgentId ? [currentAgentId] : []);
    return res.json({
      success: true,
      waiting: visibleWaiting.map((row) => {
        let photosArray = null;
        if (row.photos) {
          try {
            photosArray = JSON.parse(row.photos);
          } catch (e) {
            photosArray = row.photos;
          }
        }
        return {
          queueId: row.id,
          userId: row.user_id,
          bookingId: row.booking_id,
          preferredAgentId: row.preferred_agent_id,
          name: row.name, phone: row.phone,
          requestedAt: row.requested_at,
          pickupTime: row.pickup_time, departureDate: row.departure_date,
          bagCount: row.bag_count, bagWeight: row.bag_weight,
          pickupAddress: row.pickup_address,
          pickupLatitude: row.pickup_latitude, pickupLongitude: row.pickup_longitude,
          dropAddress: row.drop_address, airlineName: row.airline_name,
          flightNumber: row.flight_number, assignmentDueAt: row.assignment_due_at,
          distanceKm: row.distance_km,
          travelEtaMinutes: row.travel_eta_minutes,
          etaMinutes: row.eta_minutes,
          pickupH3Index: row.pickup_h3_index,
          targetPickupAt: row.target_pickup_at,
          leaveByAt: row.leave_by_at,
          urgencyMinutes: row.urgency_minutes,
          photos: photosArray,
        };
      }),
      activeSessions: activeRows.map((row) => {
        let photosArray = null;
        if (row.photos) {
          try {
            photosArray = JSON.parse(row.photos);
          } catch (e) {
            photosArray = row.photos;
          }
        }
        return {
          sessionId: row.session_id, userId: row.user_id, agentId: row.agent_id,
          startTime: row.start_time, agentName: row.agent_name, agentPhone: row.agent_phone,
          userName: row.user_name, userPhone: row.user_phone,
          bookingId: row.booking_id,
          pickupAddress: row.pickup_address, pickupLatitude: row.pickup_latitude,
          pickupLongitude: row.pickup_longitude, dropAddress: row.drop_address,
          dropLatitude: row.drop_latitude, dropLongitude: row.drop_longitude,
          pickupTime: row.pickup_time, departureDate: row.departure_date,
          bagCount: row.bag_count, bagWeight: row.bag_weight,
          airlineName: row.airline_name, flightNumber: row.flight_number,
          assignmentDueAt: row.assignment_due_at,
          status: row.status,
          pickupVerified: Boolean(row.pickup_verified),
          pickupVerifiedAt: row.pickup_verified_at,
          pickupVerifiedByAgentName: row.pickup_verified_by_agent_name,
          deliveryVerifiedAt: row.delivery_verified_at,
          photos: photosArray,
        };
      }),
    });
  } catch (error) {
    console.error("inbox error:", error);
    return res.status(500).json({ success: false, message: "Failed to load inbox" });
  }
});

router.post("/respond-request", async (req, res) => {
  const { queueId, action, agentId, agentName, agentPhone } = req.body || {};
  if (!queueId || !action) {
    return res.status(400).json({ success: false, message: "queueId and action are required" });
  }
  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action" });
  }
  try {
    let resolvedAgentId = Number(agentId) || null;
    if (resolvedAgentId) {
      const agentRows = await runQuery("SELECT agent_id FROM support_agents WHERE agent_id = ? LIMIT 1", [resolvedAgentId]);
      if (!agentRows.length) resolvedAgentId = null;
    }
    if (!resolvedAgentId && agentPhone) {
      await runQuery(
        `INSERT INTO support_agents (name, phone, status, current_user_id) VALUES (?, ?, 'available', NULL)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [agentName || "Agent", agentPhone]
      );
      const rows = await runQuery("SELECT agent_id FROM support_agents WHERE phone = ? LIMIT 1", [agentPhone]);
      resolvedAgentId = rows[0]?.agent_id || null;
    }
    if (!resolvedAgentId) return res.status(404).json({ success: false, message: "Agent not found" });
    const queueRows = await runQuery(
      `SELECT q.id, q.user_id, q.booking_id, q.preferred_agent_id, q.status, u.name, u.phone,
              q.declined_agent_ids, b.bag_weight
       FROM agent_queue q
       JOIN users u ON u.id = q.user_id
       LEFT JOIN bookings b ON b.id = q.booking_id
       WHERE q.id = ? LIMIT 1`,      // ✅ FIXED: was q.queue_id
      [queueId]
    );
    if (!queueRows.length) return res.status(404).json({ success: false, message: "Request not found" });
    const request = queueRows[0];
    if (request.preferred_agent_id && Number(request.preferred_agent_id) !== Number(resolvedAgentId)) {
      return res.status(403).json({
        success: false,
        message: `This request is reserved for agent ${request.preferred_agent_id}`,
      });
    }
    if (action === 'accept') {
      const requiredWeightKg = parseWeightKg(request.bag_weight);
      if (Number.isFinite(requiredWeightKg)) {
        const agentCapacityRows = await runQuery(
          "SELECT vehicle_type, max_weight_kg FROM support_agents WHERE agent_id = ? LIMIT 1",
          [resolvedAgentId]
        );
        if (!agentCapacityRows.length) return res.status(404).json({ success: false, message: "Agent not found" });
        const maxCapacityKg = resolveAgentCapacityKg(agentCapacityRows[0]);
        if (requiredWeightKg > maxCapacityKg) {
          return res.status(409).json({
            success: false,
            message: `Package weight ${requiredWeightKg}kg exceeds this agent capacity (${maxCapacityKg}kg)`
          });
        }
      }
    }
    if (request.status !== 'waiting') {
      return res.status(409).json({ success: false, message: "Request is no longer waiting" });
    }
    if (action === 'decline') {
      const declinedAgentIds = parseDeclinedAgentIds(request.declined_agent_ids);
      declinedAgentIds.push(Number(resolvedAgentId));
      const declinedSerialized = serializeDeclinedAgentIds(declinedAgentIds);
      let nextAgentId = null;
      if (request.booking_id) {
        nextAgentId = await getBestAgentIdForBooking(request.booking_id, { excludedAgentIds: declinedAgentIds });
      }
      // ✅ FIXED: was WHERE queue_id = ?
      await runQuery(
        `UPDATE agent_queue SET preferred_agent_id = ?, declined_agent_ids = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'waiting'`,
        [nextAgentId, declinedSerialized, queueId]
      );
      return res.json({
        success: true, action: 'declined',
        reassigned: Boolean(nextAgentId), nextPreferredAgentId: nextAgentId,
        message: nextAgentId
          ? `Request declined${agentName ? ` by ${agentName}` : ''}. Reassigned to next agent.`
          : `Request declined${agentName ? ` by ${agentName}` : ''}. Waiting for next available fit.`,
      });
    }
    const existingSessionRows = await runQuery(
      `SELECT session_id, agent_id, start_time FROM agent_sessions
       WHERE user_id = ? AND booking_id = ? AND status = 'active' ORDER BY start_time DESC LIMIT 1`,
      [request.user_id, request.booking_id]
    );
    if (existingSessionRows.length > 0) {
      // ✅ FIXED: was WHERE queue_id = ?
      await runQuery(
        "DELETE FROM agent_queue WHERE id = ? AND status = 'waiting'",
        [queueId]
      );
      return res.json({
        success: true, action: 'accepted',
        message: 'Request already has an active session',
        session: {
          sessionId: existingSessionRows[0].session_id, bookingId: request.booking_id,
          userId: request.user_id, userName: request.name, userPhone: request.phone,
          agentId: existingSessionRows[0].agent_id,
        },
      });
    }
    const updateResult = await runQuery(
      `UPDATE support_agents SET status = 'busy', current_user_id = ?, last_assigned_at = CURRENT_TIMESTAMP
       WHERE agent_id = ? AND status = 'available'`,
      [request.user_id, resolvedAgentId]
    );
    if (!updateResult.affectedRows) {
      return res.status(409).json({ success: false, message: "Agent is not available" });
    }
    const sessionResult = await runQuery(
      `INSERT INTO agent_sessions (user_id, booking_id, agent_id, status, start_time)
       VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
      [request.user_id, request.booking_id, resolvedAgentId]
    );
    if (request.booking_id) {
      await runQuery(
        "UPDATE bookings SET status = 'assigned', assignment_status = 'assigned' WHERE id = ?",
        [request.booking_id]
      );
    }
    // ✅ FIXED: was WHERE queue_id = ?
    await runQuery(
      "DELETE FROM agent_queue WHERE id = ? AND status = 'waiting'",
      [queueId]
    );
    return res.json({
      success: true, action: 'accepted',
      message: `Request accepted${agentName ? ` by ${agentName}` : ''}`,
      session: {
        sessionId: sessionResult.insertId, bookingId: request.booking_id,
        userId: request.user_id, userName: request.name, userPhone: request.phone,
        agentId: resolvedAgentId,
      },
    });
  } catch (error) {
    console.error("respond-request error:", error);
    return res.status(500).json({ success: false, message: "Failed to update request" });
  }
});

router.get("/assignment-status", verifyToken, async (req, res) => {
  try {
    const user = await getUserByPhone(req.phone);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const activeRows = await runQuery(
      `SELECT s.session_id, s.start_time, a.agent_id, a.name, a.phone, a.status
       FROM agent_sessions s
       JOIN support_agents a ON a.agent_id = s.agent_id
       WHERE s.user_id = ? AND s.status = 'active'
       ORDER BY s.start_time DESC LIMIT 1`,
      [user.id]
    );
    if (activeRows.length) {
      return res.json({
        success: true, assigned: true, queued: false,
        session: {
          sessionId: activeRows[0].session_id, startTime: activeRows[0].start_time,
          agent: { agentId: activeRows[0].agent_id, name: activeRows[0].name, phone: activeRows[0].phone, status: activeRows[0].status },
        },
      });
    }
    const queueRows = await runQuery(
      // ✅ FIXED: was SELECT queue_id
      "SELECT id, requested_at FROM agent_queue WHERE user_id = ? AND status = 'waiting' ORDER BY requested_at ASC LIMIT 1",
      [user.id]
    );
    if (queueRows.length) {
      return res.json({
        success: true, assigned: false, queued: true,
        queue: { queueId: queueRows[0].id, requestedAt: queueRows[0].requested_at },
      });
    }
    return res.json({ success: true, assigned: false, queued: false, message: "No active assignment" });
  } catch (error) {
    console.error("assignment-status error:", error);
    return res.status(500).json({ success: false, message: "Failed to get assignment status" });
  }
});

// H3 + schedule health for a booking (debug / verify H3 pipeline)
router.get("/h3-status/:bookingId", async (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "bookingId required" });
    }
    const rows = await runQuery(
      `SELECT b.id, b.pickup_latitude, b.pickup_longitude, b.departure_date, b.pickup_time,
              b.agent_eta_minutes, b.agent_leave_by_at, b.pickup_h3_index, b.assignment_due_at,
              b.assigned_agent_id, a.agent_id, a.latitude, a.longitude, a.h3_index
       FROM bookings b
       LEFT JOIN support_agents a ON a.agent_id = b.assigned_agent_id
       WHERE b.id = ? LIMIT 1`,
      [bookingId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    const row = rows[0];
    const schedule = computeAgentSchedule({
      pickupLatitude: row.pickup_latitude,
      pickupLongitude: row.pickup_longitude,
      agentLatitude: row.latitude,
      agentLongitude: row.longitude,
      departureDate: row.departure_date,
      pickupTime: row.pickup_time,
      agentH3Index: row.h3_index,
    });
    return res.json({
      success: true,
      h3Working: Boolean(schedule.userH3),
      stored: {
        pickupH3Index: row.pickup_h3_index,
        agentEtaMinutes: row.agent_eta_minutes,
        agentLeaveByAt: row.agent_leave_by_at,
        pickupScheduledAt: row.assignment_due_at,
        assignedAgentId: row.assigned_agent_id,
      },
      computed: {
        userH3: schedule.userH3,
        agentH3: schedule.agentH3,
        h3Distance: schedule.h3Distance,
        distanceKm: schedule.distanceKm,
        travelEtaMinutes: schedule.travelEtaMinutes,
        totalEtaWithBuffer: schedule.totalEtaMinutes,
        leaveByAt: schedule.leaveByAt ? schedule.leaveByAt.toISOString() : null,
        pickupAt: schedule.pickupAt ? schedule.pickupAt.toISOString() : null,
        bufferMinutes: PICKUP_PREP_BUFFER_MIN,
      },
    });
  } catch (error) {
    console.error("h3-status error:", error);
    return res.status(500).json({ success: false, message: "Failed to read H3 status" });
  }
});

// Agent arrived at pickup — keeps session active (used after map "Arrived" button)
router.patch("/arrived", async (req, res) => {
  const sessionId = Number(req.body?.sessionId) || null;
  const bookingId = Number(req.body?.bookingId) || null;
  const agentId = Number(req.body?.agentId) || null;
  try {
    let sessionRows = [];
    if (sessionId) {
      sessionRows = await runQuery(
        "SELECT session_id, agent_id, booking_id FROM agent_sessions WHERE session_id = ? AND status = 'active' LIMIT 1",
        [sessionId]
      );
    } else if (bookingId && agentId) {
      sessionRows = await runQuery(
        "SELECT session_id, agent_id, booking_id FROM agent_sessions WHERE booking_id = ? AND agent_id = ? AND status = 'active' ORDER BY start_time DESC LIMIT 1",
        [bookingId, agentId]
      );
    } else if (bookingId) {
      sessionRows = await runQuery(
        "SELECT session_id, agent_id, booking_id FROM agent_sessions WHERE booking_id = ? AND status = 'active' ORDER BY start_time DESC LIMIT 1",
        [bookingId]
      );
    }
    if (!sessionRows.length) {
      return res.status(404).json({ success: false, message: "No active session found" });
    }
    const session = sessionRows[0];
    try {
      await runQuery(
        "UPDATE bookings SET status = 'in-progress', assignment_status = 'at_pickup', destination_qr_unlocked_at = COALESCE(destination_qr_unlocked_at, CURRENT_TIMESTAMP) WHERE id = ?",
        [session.booking_id]
      );
    } catch (_bookingStatusErr) {
      // keep session active even if status enum differs
    }
    return res.json({
      success: true,
      message: "Arrived at pickup — open In Progress to view task details",
      session: {
        sessionId: session.session_id,
        bookingId: session.booking_id,
        agentId: session.agent_id,
        status: "active",
        phase: "at_pickup",
      },
    });
  } catch (error) {
    console.error("arrived error:", error);
    return res.status(500).json({ success: false, message: "Failed to mark arrival" });
  }
});

router.post("/complete-session", verifyToken, async (req, res) => {
  try {
    const user = await getUserByPhone(req.phone);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const activeRows = await runQuery(
      "SELECT session_id, agent_id FROM agent_sessions WHERE user_id = ? AND status = 'active' ORDER BY start_time DESC LIMIT 1",
      [user.id]
    );
    if (!activeRows.length) return res.status(404).json({ success: false, message: "No active session found" });
    const session = activeRows[0];
    await runQuery(
      "UPDATE agent_sessions SET status = 'completed', end_time = CURRENT_TIMESTAMP WHERE session_id = ?",
      [session.session_id]
    );
    await runQuery(
      "UPDATE support_agents SET status = 'available', current_user_id = NULL WHERE agent_id = ?",
      [session.agent_id]
    );
    return res.json({ success: true, message: "Session completed and agent is available now" });
  } catch (error) {
    console.error("complete-session error:", error);
    return res.status(500).json({ success: false, message: "Failed to complete session" });
  }
});

module.exports = router;