const express = require("express");
const router = express.Router();
const db = require("../db");

const AVATAR_COLORS = [
  "#fb923c",
  "#f472b6",
  "#a78bfa",
  "#38bdf8",
  "#4ade80",
  "#f87171",
  "#fbbf24",
  "#c084fc",
];

function getInitials(name) {
  const parts = String(name || "Agent")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getAvatarColor(name) {
  const value = String(name || "Agent");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatBookingId(id) {
  if (!id) return null;
  return `LUG-${String(id).padStart(4, "0")}`;
}

function mapAgentStatus(dbStatus) {
  const status = String(dbStatus || "").trim().toLowerCase();
  if (status === "available" || status === "busy") return "Online";
  return "Offline";
}

function formatVehicle(vehicleType) {
  const value = String(vehicleType || "").trim();
  return value || "—";
}

function mapAgentRow(row) {
  const name = row.name || "Agent";
  const trips = Number(row.trips ?? 0);
  const earned = Number(row.earned ?? 0);
  const rating = row.avg_rating != null ? Number(row.avg_rating) : null;

  return {
    id: row.agent_id,
    name,
    initials: getInitials(name),
    color: getAvatarColor(name),
    city: row.city || "—",
    status: mapAgentStatus(row.status),
    rating: rating != null && !Number.isNaN(rating) ? Number(rating.toFixed(1)) : null,
    trips,
    earned,
    vehicle: formatVehicle(row.vehicle_type),
    bookingId: formatBookingId(row.active_booking_id),
  };
}

const LIST_QUERY = `
  SELECT
    a.agent_id,
    a.name,
    a.phone,
    a.status,
    a.vehicle_type,
    (
      SELECT COUNT(*)
      FROM bookings b
      WHERE b.assigned_agent_id = a.agent_id
    ) AS trips,
    (
      SELECT COALESCE(SUM(b.amount), 0)
      FROM bookings b
      WHERE b.assigned_agent_id = a.agent_id
        AND LOWER(COALESCE(b.payment_status, '')) IN ('completed', 'paid', 'success', 'captured')
    ) AS earned,
    (
      SELECT b.departure_city
      FROM bookings b
      WHERE b.assigned_agent_id = a.agent_id
        AND b.departure_city IS NOT NULL
        AND TRIM(b.departure_city) <> ''
      ORDER BY b.created_at DESC
      LIMIT 1
    ) AS city,
    (
      SELECT s.booking_id
      FROM agent_sessions s
      WHERE s.agent_id = a.agent_id
        AND s.status = 'active'
      ORDER BY s.start_time DESC
      LIMIT 1
    ) AS active_booking_id,
    NULL AS avg_rating
  FROM support_agents a
  WHERE LOWER(TRIM(COALESCE(a.name, ''))) NOT IN ('', 'agent')
     OR EXISTS (
       SELECT 1 FROM bookings b WHERE b.assigned_agent_id = a.agent_id LIMIT 1
     )
  ORDER BY a.created_at DESC
  LIMIT 200
`;

function displayValue(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function mapProfileRow(kycRow, agentAccount, supportAgent) {
  const idType = displayValue(kycRow?.id_type);
  const idNumber = displayValue(kycRow?.id_number);
  const id =
    idNumber !== "—"
      ? idType !== "—"
        ? `${idType}: ${idNumber}`
        : idNumber
      : "—";

  return {
    name: displayValue(kycRow?.full_name || agentAccount?.full_name || supportAgent?.name),
    id,
    idType: idType !== "—" ? idType : null,
    idNumber: idNumber !== "—" ? idNumber : null,
    phone: displayValue(kycRow?.phone || agentAccount?.mobile || supportAgent?.phone),
    email: displayValue(kycRow?.email),
    dateOfBirth: displayValue(kycRow?.date_of_birth),
    nationality: displayValue(kycRow?.nationality),
    city: displayValue(kycRow?.city),
    state: displayValue(kycRow?.state),
    vehicleType: displayValue(kycRow?.vehicle_type || supportAgent?.vehicle_type),
    vehicleModel: displayValue(kycRow?.vehicle_model),
    vehicleColor: displayValue(kycRow?.vehicle_color),
    licensePlate: displayValue(kycRow?.license_plate),
    hasKyc: Boolean(kycRow?.kyc_id),
    submittedAt: kycRow?.submitted_at || kycRow?.updated_at || null,
  };
}

router.get("/:agentId/profile", (req, res) => {
  const agentId = Number(req.params.agentId);
  if (!Number.isFinite(agentId)) {
    return res.status(400).json({ success: false, message: "Invalid agent id" });
  }

  db.query(
    "SELECT agent_id, name, phone, vehicle_type FROM support_agents WHERE agent_id = ? LIMIT 1",
    [agentId],
    (supportErr, supportRows) => {
      if (supportErr) {
        console.error("[AdminAgents] Failed to load support agent:", supportErr.message);
        return res.status(500).json({ success: false, message: "Failed to load agent" });
      }
      if (!supportRows?.length) {
        return res.status(404).json({ success: false, message: "Agent not found" });
      }

      const supportAgent = supportRows[0];
      const profileQuery = `
        SELECT
          k.id AS kyc_id,
          k.full_name,
          k.email,
          k.phone,
          k.date_of_birth,
          k.nationality,
          k.id_type,
          k.id_number,
          k.city,
          k.state,
          k.vehicle_type,
          k.vehicle_model,
          k.vehicle_color,
          k.license_plate,
          k.submitted_at,
          k.updated_at,
          a.id AS agent_account_id,
          a.full_name AS account_name,
          a.mobile AS account_mobile
        FROM agents a
        LEFT JOIN kyc k ON k.user_id = a.id
        WHERE (
          (? IS NOT NULL AND ? <> '' AND (
            a.mobile = ?
            OR REPLACE(REPLACE(REPLACE(a.mobile, '+', ''), '-', ''), ' ', '') =
               REPLACE(REPLACE(REPLACE(?, '+', ''), '-', ''), ' ', '')
          ))
          OR LOWER(TRIM(a.full_name)) = LOWER(TRIM(?))
        )
        ORDER BY k.updated_at DESC, a.id DESC
        LIMIT 1
      `;

      const phone = supportAgent.phone || "";
      db.query(
        profileQuery,
        [phone, phone, phone, phone, supportAgent.name || ""],
        (profileErr, profileRows) => {
          if (profileErr) {
            if (profileErr.code === "ER_NO_SUCH_TABLE") {
              return res.json({
                success: true,
                profile: mapProfileRow(null, null, supportAgent),
                message: "KYC tables not found. Agent has not completed KYC yet.",
              });
            }
            console.error("[AdminAgents] Failed to load KYC profile:", profileErr.message);
            return res.status(500).json({ success: false, message: "Failed to load agent profile" });
          }

          const match = profileRows?.[0] || null;
          const profile = mapProfileRow(match, match, supportAgent);

          return res.json({
            success: true,
            profile,
            message: profile.hasKyc ? "KYC profile loaded" : "No KYC submission found for this agent yet",
          });
        }
      );
    }
  );
});

router.get("/", (req, res) => {
  db.query(LIST_QUERY, (err, rows) => {
    if (err) {
      console.error("[AdminAgents] Failed to fetch agents:", err.message);
      return res.status(500).json({ success: false, message: "Failed to fetch agents" });
    }

    return res.json({
      success: true,
      agents: (rows || []).map(mapAgentRow),
      count: rows?.length ?? 0,
    });
  });
});

module.exports = router;
