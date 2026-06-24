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

const getBestAgentsForBooking = async (booking, limit = 3) => {
  const userLat = toNumberOrNull(booking.pickup_latitude);
  const userLng = toNumberOrNull(booking.pickup_longitude);

  if (userLat === null || userLng === null) {
    return [];
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
       AND (a.cooldown_until IS NULL OR a.cooldown_until <= CURRENT_TIMESTAMP)
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

  return ranked
    .filter((candidate) => candidate.fit !== false)
    .slice(0, limit);
};

const queueBookingForAgentDashboard = async (booking, bestAgents) => {
  const preferredAgentId = bestAgents[0]?.agentId || null;
  const broadcastedAgentIds = bestAgents.map(a => a.agentId).join(',');

  const userRows = await runQuery(
    `SELECT id FROM users WHERE phone = ? OR phone = ? LIMIT 1`,
    [booking.phone, booking.phone?.startsWith("+91") ? booking.phone.slice(3) : `+91${booking.phone || ""}`]
  );

  const userId = userRows[0]?.id || null;
  if (!userId) {
    throw new Error(`User not found for phone ${booking.phone}`);
  }

  await runQuery(
    `INSERT INTO agent_queue (user_id, booking_id, preferred_agent_id, broadcasted_agent_ids, status)
     VALUES (?, ?, ?, ?, 'waiting')
     ON DUPLICATE KEY UPDATE
       booking_id = VALUES(booking_id),
       preferred_agent_id = VALUES(preferred_agent_id),
       broadcasted_agent_ids = VALUES(broadcasted_agent_ids),
       declined_agent_ids = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, booking.id, preferredAgentId, broadcastedAgentIds]
  );

  await runQuery(
    `UPDATE bookings
     SET status = 'queued', assignment_status = 'queued', assigned_agent_id = ?
     WHERE id = ?`,
    [preferredAgentId, booking.id]
  );

  return {
    preferredAgentId,
    broadcastedAgentIds,
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

  for (const booking of dueBookings) {
    try {
      const bestAgents = await getBestAgentsForBooking(booking, 3);
      if (bestAgents.length > 0) {
        await queueBookingForAgentDashboard(booking, bestAgents);
        console.log(`✅ [BROADCAST] Booking ${booking.id} broadcasted to Agents: ${bestAgents.map(a => a.agentId).join(', ')}`);
      } else {
        console.log(`⚠️ Booking ${booking.id} queued but NO active agents found nearby`);
      }
    } catch (error) {
      console.error(`❌ Failed to queue booking ${booking.id}:`, error.message);
    }
  }
};

const manageAgentAvailabilityAndQueues = async () => {
  // 0. Auto-clear expired agent cooldowns
  await runQuery(
    `UPDATE support_agents 
     SET status = 'available', cooldown_until = NULL 
     WHERE status = 'inactive' AND cooldown_until IS NOT NULL AND cooldown_until <= CURRENT_TIMESTAMP`
  );

  // 1. Process active queues (status = 'waiting')
  const activeQueues = await runQuery(
    `SELECT q.id, q.booking_id, q.user_id, q.preferred_agent_id, q.broadcasted_agent_ids, q.declined_agent_ids, q.updated_at, q.requested_at,
            b.pickup_latitude, b.pickup_longitude, b.bag_weight, b.is_fragile, b.is_checkin, b.surge_bonus, b.amount, b.phone
     FROM agent_queue q
     JOIN bookings b ON b.id = q.booking_id
     WHERE q.status = 'waiting'`
  );

  for (const queue of activeQueues) {
    const nowMs = Date.now();
    const secondsWaiting = (nowMs - new Date(queue.updated_at).getTime()) / 1000;
    const totalSecondsInQueue = (nowMs - new Date(queue.requested_at).getTime()) / 1000;

    // --- A. Timeout & Re-routing (20 seconds) ---
    if (secondsWaiting >= 20) {
      console.log(`[TIMEOUT] Booking ID ${queue.booking_id} request timed out after 20s of no agent acceptance.`);
      
      const currentAgents = queue.broadcasted_agent_ids
        ? queue.broadcasted_agent_ids.split(',').map(id => Number(id.trim())).filter(Boolean)
        : (queue.preferred_agent_id ? [Number(queue.preferred_agent_id)] : []);
      
      const declinedAgentIds = queue.declined_agent_ids
        ? queue.declined_agent_ids.split(',').map(id => Number(id.trim())).filter(Boolean)
        : [];

      for (const agentId of currentAgents) {
        if (!declinedAgentIds.includes(agentId)) {
          await runQuery(
            `UPDATE support_agents 
             SET consecutive_ignored_count = consecutive_ignored_count + 1 
             WHERE agent_id = ?`,
            [agentId]
          );
          
          const agentRows = await runQuery(
            `SELECT consecutive_ignored_count, name FROM support_agents WHERE agent_id = ? LIMIT 1`,
            [agentId]
          );
          
          if (agentRows.length && agentRows[0].consecutive_ignored_count >= 3) {
            await runQuery(
              `UPDATE support_agents 
               SET status = 'inactive', cooldown_until = DATE_ADD(NOW(), INTERVAL 5 MINUTE), consecutive_ignored_count = 0 
               WHERE agent_id = ?`,
              [agentId]
            );
            console.log(`[COOLDOWN] Agent ID ${agentId} (${agentRows[0].name}) set to INACTIVE (cooldown) for 5 minutes due to 3 ignores/declines.`);
          } else if (agentRows.length) {
            console.log(`[IGNORE] Agent ID ${agentId} (${agentRows[0].name}) ignored request. Consecutive ignore count: ${agentRows[0].consecutive_ignored_count}`);
          }
          
          declinedAgentIds.push(agentId);
        }
      }

      const declinedSerialized = declinedAgentIds.join(',');
      const nextAgents = await getBestAgentsForBooking(queue, 3);
      const freshAgents = nextAgents.filter(a => !declinedAgentIds.includes(a.agentId));

      if (freshAgents.length > 0) {
        const nextPreferred = freshAgents[0].agentId;
        const nextBroadcast = freshAgents.map(a => a.agentId).join(',');
        
        await runQuery(
          `UPDATE agent_queue 
           SET preferred_agent_id = ?, broadcasted_agent_ids = ?, declined_agent_ids = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [nextPreferred, nextBroadcast, declinedSerialized, queue.id]
        );
        console.log(`[RE-ROUTE] Booking ID ${queue.booking_id} re-routed to new agents: ${nextBroadcast}`);
      } else {
        await runQuery(
          `UPDATE agent_queue 
           SET preferred_agent_id = NULL, broadcasted_agent_ids = NULL, declined_agent_ids = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [declinedSerialized, queue.id]
        );
        console.log(`[WAITING] Booking ID ${queue.booking_id} has no new available agents nearby. Retrying later.`);
      }
    }

    // --- B. Surge Incentives (gradual +10 Rs every 30 seconds) ---
    const expectedSurge = Math.min(100, Math.floor(totalSecondsInQueue / 30) * 10);
    const currentSurge = Number(queue.surge_bonus || 0);
    if (expectedSurge > currentSurge) {
      const addition = expectedSurge - currentSurge;
      await runQuery(
        `UPDATE bookings SET surge_bonus = ?, amount = amount + ? WHERE id = ?`,
        [expectedSurge, addition, queue.booking_id]
      );
      console.log(`[SURGE] Added +${addition} Rs surge incentive to booking ID ${queue.booking_id} due to non-acceptance. Total surge: ${expectedSurge} Rs.`);
    }
  }

  // 2. Process arrived bookings wait-timer warnings (Edge Case 4)
  const arrivedBookings = await runQuery(
    `SELECT id, arrived_at, user_notified_2m, user_warned_4m, no_show_unlocked, username
     FROM bookings
     WHERE status = 'in-progress' AND assignment_status = 'at_pickup' AND arrived_at IS NOT NULL`
  );

  for (const booking of arrivedBookings) {
    const elapsedSeconds = (Date.now() - new Date(booking.arrived_at).getTime()) / 1000;

    if (elapsedSeconds >= 120 && !booking.user_notified_2m) {
      await runQuery(`UPDATE bookings SET user_notified_2m = 1 WHERE id = ?`, [booking.id]);
      console.log(`[NOTIFY] [ALERT-2M] User '${booking.username}' (Booking ID ${booking.id}) absent for 2 minutes. Simulated push notification + IVR call triggered.`);
    }

    if (elapsedSeconds >= 240 && !booking.user_warned_4m) {
      await runQuery(`UPDATE bookings SET user_warned_4m = 1 WHERE id = ?`, [booking.id]);
      console.log(`[WARN] [ALERT-4M] User '${booking.username}' (Booking ID ${booking.id}) absent for 4 minutes. Critical warning sent: agent will leave in 1 minute.`);
    }

    if (elapsedSeconds >= 300 && !booking.no_show_unlocked) {
      await runQuery(`UPDATE bookings SET no_show_unlocked = 1 WHERE id = ?`, [booking.id]);
      console.log(`[UNLOCK-5M] Booking ID ${booking.id}: Countdown finished. 'No Show' cancellation option unlocked for the agent.`);
    }
  }

  // 3. Process agent availability & auto-offline (Edge Case 5)
  const activeAgents = await runQuery(
    `SELECT agent_id, name, status, location_updated_at, last_heartbeat_at, availability_check_sent_at
     FROM support_agents
     WHERE status IN ('available', 'busy', 'inactive')`
  );

  for (const agent of activeAgents) {
    const lastActivity = agent.last_heartbeat_at || agent.location_updated_at;
    if (!lastActivity) continue;

    const secondsIdle = (Date.now() - new Date(lastActivity).getTime()) / 1000;

    if (secondsIdle >= 600) { // 10 minutes
      if (!agent.availability_check_sent_at) {
        await runQuery(
          `UPDATE support_agents SET availability_check_sent_at = CURRENT_TIMESTAMP WHERE agent_id = ?`,
          [agent.agent_id]
        );
        console.log(`[IDLE CHECK] Agent ID ${agent.agent_id} (${agent.name}) idle for 10+ minutes. Sent availability confirmation request.`);
      } else {
        const secondsCheckWaiting = (Date.now() - new Date(agent.availability_check_sent_at).getTime()) / 1000;
        if (secondsCheckWaiting >= 60) {
          await runQuery(
            `UPDATE support_agents 
             SET status = 'offline', availability_check_sent_at = NULL, consecutive_ignored_count = 0 
             WHERE agent_id = ?`,
            [agent.agent_id]
          );
          console.log(`[AUTO OFFLINE] Agent ID ${agent.agent_id} (${agent.name}) failed availability response. Auto-set status to OFFLINE.`);
        }
      }
    }
  }
};

const startBookingAssignmentScheduler = () => {
  const runOnce = () => {
    processDueBookings().catch((error) => {
      console.error("Booking assignment scheduler error:", error.message);
    });
    manageAgentAvailabilityAndQueues().catch((error) => {
      console.error("Availability and queue management error:", error.message);
    });
  };

  runOnce();
  const timer = setInterval(runOnce, 10000); // 10 seconds interval
  return timer;
};

module.exports = {
  startBookingAssignmentScheduler,
  processDueBookings,
  manageAgentAvailabilityAndQueues,
  getBestAgentsForBooking,
  queueBookingForAgentDashboard
};