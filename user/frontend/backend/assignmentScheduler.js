const { latLngToCell, gridDistance } = require("h3-js");
const db = require("./db");

const H3_RESOLUTION = 8;
const SCHEDULER_INTERVAL_MS = 60 * 1000;

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

const parseWeightKg = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

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

const vehicleWeightFromType = (vehicleType) => {
  if (!vehicleType) return null;
  return VEHICLE_WEIGHT_MAP[String(vehicleType).toLowerCase().trim()] ?? null;
};

const resolveAgentCapacityKg = (agentRow) => {
  const explicit = toNumberOrNull(agentRow?.max_weight_kg ?? agentRow?.maxWeightKg);
  const byVehicle = vehicleWeightFromType(agentRow?.vehicle_type ?? agentRow?.vehicleType);

  // If both are present, trust the larger value so vehicle-type capacity is not capped by old defaults.
  if (Number.isFinite(explicit) && Number.isFinite(byVehicle)) {
    return Math.max(explicit, byVehicle);
  }

  return byVehicle ?? explicit ?? 25;
};

const toBoolean = (value) => {
  if (value === true || value === false) return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
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

const scoreAgent = ({
  distanceKm,
  h3Distance,
  activeSessions,
  lastAssignedAt,
  requiredWeightKg,
  maxWeightKg,
  fragileRequired,
  supportsFragile,
  checkinRequired,
  supportsCheckin,
}) => {
  const safeH3Distance = Number.isFinite(h3Distance) ? h3Distance : 8;
  const loadPenalty = Number(activeSessions || 0) * 2.5;

  const requiredWeight = Number.isFinite(requiredWeightKg) ? requiredWeightKg : 0;
  const maxWeight = Number.isFinite(maxWeightKg) ? maxWeightKg : 20;
  const overweightBy = Math.max(0, requiredWeight - maxWeight);
  const capacityPenalty = overweightBy > 0 ? 1000 + overweightBy * 20 : 0;

  const fragilePenalty = fragileRequired && !supportsFragile ? 500 : 0;
  const checkinPenalty = checkinRequired && !supportsCheckin ? 350 : 0;

  let recencyPenalty = 0;
  if (lastAssignedAt) {
    const minutes = Math.max(0, (Date.now() - new Date(lastAssignedAt).getTime()) / 60000);
    recencyPenalty = 1 / (1 + minutes / 30);
  }

  return distanceKm * 1.0 + safeH3Distance * 0.8 + loadPenalty + recencyPenalty + capacityPenalty + fragilePenalty + checkinPenalty;
};

const greedyRankAgents = (candidates, context = {}) => {
  const pool = [...candidates];
  const selected = [];
  const simulatedLoad = new Map(pool.map((item) => [item.agentId, item.activeSessions]));

  while (pool.length) {
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

      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
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
    });
  }

  return selected;
};

const getBestAgentForBooking = async (booking) => {
  const userLat = toNumberOrNull(booking.pickup_latitude);
  const userLng = toNumberOrNull(booking.pickup_longitude);

  if (userLat === null || userLng === null) {
    return null;
  }

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
    GROUP BY a.agent_id, a.name, a.phone, a.status, a.latitude, a.longitude, a.h3_index,
          a.last_assigned_at, a.vehicle_type, a.max_weight_kg, a.supports_fragile, a.supports_checkin`
  );

  const candidates = rows.map((row) => {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    const agentH3 = row.h3_index || latLngToCell(lat, lng, H3_RESOLUTION);

    let h3Distance = null;
    try {
      h3Distance = gridDistance(userH3, agentH3);
    } catch (_error) {
      h3Distance = null;
    }

    return {
      agentId: row.agent_id,
      name: row.name,
      phone: row.phone,
      distanceKm: Number(haversineKm(userLat, userLng, lat, lng).toFixed(3)),
      h3Distance,
      activeSessions: Number(row.active_sessions || 0),
      lastAssignedAt: row.last_assigned_at,
      vehicleType: row.vehicle_type || null,
      maxWeightKg: resolveAgentCapacityKg(row),
      supportsFragile: Number(row.supports_fragile || 0) === 1,
      supportsCheckin: Number(row.supports_checkin || 0) === 1,
    };
  });

  const ranked = greedyRankAgents(candidates, {
    requiredWeightKg,
    fragileRequired,
    checkinRequired,
  });

  return ranked.find((candidate) => candidate.fit !== false) || null;
};

const queueBookingForAgentDashboard = async (booking, bestAgent) => {
  const preferredAgentId = bestAgent?.agentId || null;

  const userRows = await runQuery(
    `SELECT id FROM users WHERE phone = ? OR phone = ? LIMIT 1`,
    [booking.phone, booking.phone?.startsWith("+91") ? booking.phone.slice(3) : `+91${booking.phone || ""}`]
  );

  const userId = userRows[0]?.id || null;
  if (!userId) {
    throw new Error(`User not found for phone ${booking.phone}`);
  }

  await runQuery(
    `INSERT INTO agent_queue (user_id, booking_id, preferred_agent_id, status)
     VALUES (?, ?, ?, 'waiting')
     ON DUPLICATE KEY UPDATE
       booking_id = VALUES(booking_id),
       preferred_agent_id = VALUES(preferred_agent_id),
       declined_agent_ids = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, booking.id, preferredAgentId]
  );

  await runQuery(
    `UPDATE bookings
     SET status = 'queued', assignment_status = 'queued', assigned_agent_id = ?
     WHERE id = ?`,
    [preferredAgentId, booking.id]
  );

  return {
    preferredAgentId,
  };
};

const processDueBookings = async () => {
  const dueBookings = await runQuery(
    `SELECT * FROM bookings
     WHERE status = 'pending'
       AND assignment_due_at IS NOT NULL
       AND assignment_due_at <= CURRENT_TIMESTAMP
       AND CONCAT(departure_date, ' ', 
         IF(LENGTH(pickup_time) = 5, CONCAT(pickup_time, ':00'), pickup_time)
       ) > NOW()
     ORDER BY assignment_due_at ASC
     LIMIT 25`
  );

  // console.log(`📋 [Scheduler] Found ${dueBookings.length} due bookings to assign (future pickups only - 5 min before)`);

  // Check available agents
  const availableAgents = await runQuery(
    `SELECT agent_id, name, phone, latitude, longitude, status 
     FROM support_agents 
     WHERE status = 'available' 
       AND latitude IS NOT NULL 
       AND longitude IS NOT NULL`
  );
  // console.log(`👥 [Scheduler] Available agents: ${availableAgents.length}`);
  // if (availableAgents.length > 0) {
  //   availableAgents.forEach(a => {
  //     console.log(`   - Agent ${a.agent_id}: ${a.name} (${a.phone}) at ${a.latitude}, ${a.longitude}`);
  //   });
  // }

  for (const booking of dueBookings) {
    try {
      const bestAgent = await getBestAgentForBooking(booking);
      await queueBookingForAgentDashboard(booking, bestAgent);
      if (bestAgent) {
        console.log(`✅ Booking ${booking.id} assigned to Agent ${bestAgent.agentId} (${bestAgent.name})`);
      } else {
        console.log(`⚠️ Booking ${booking.id} queued but NO agent found nearby`);
      }
    } catch (error) {
      console.error(`❌ Failed to queue booking ${booking.id}:`, error.message);
    }
  }
};

const startBookingAssignmentScheduler = () => {
  const runOnce = () => {
    processDueBookings().catch((error) => {
      console.error("Booking assignment scheduler error:", error.message);
    });
  };

  runOnce();
  const timer = setInterval(runOnce, SCHEDULER_INTERVAL_MS);
  return timer;
};

module.exports = {
  startBookingAssignmentScheduler,
};