const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { resolveCanonicalStatus } = require("../utils/bookingStatus");

const AVATAR_COLORS = [
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#38bdf8",
  "#4ade80",
  "#f87171",
  "#fbbf24",
  "#c084fc",
];

const ADMIN_STATUS_LABELS = {
  confirmed: "Booking Confirmed",
  agent_assigned: "Agent Assigned",
  in_progress: "In Progress",
  on_the_way: "On the Way",
  completed: "Completed",
  cancelled: "Cancelled",
};

function getInitials(name) {
  const parts = String(name || "User")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getAvatarColor(name) {
  const value = String(name || "User");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatBookingId(id) {
  return `LUG-${String(id).padStart(4, "0")}`;
}

function formatPickup(row) {
  const pickup = String(row.pickup_address || "").trim();
  if (pickup) {
    return pickup.length > 48 ? `${pickup.slice(0, 45)}...` : pickup;
  }
  const airport = String(row.departure_airport || "").trim();
  if (airport) return airport;
  const city = String(row.departure_city || "").trim();
  if (city) return city;
  return "—";
}

function mapAdminStatus(rawStatus) {
  const canonical = resolveCanonicalStatus(rawStatus);
  return ADMIN_STATUS_LABELS[canonical] || canonical;
}

function getPaidAmount(row) {
  const amount = row.amount != null ? Number(row.amount) : null;
  if (!Number.isFinite(amount)) return null;

  const paymentStatus = String(row.payment_status || "").trim().toLowerCase();
  const wasPaid =
    ["completed", "paid", "success", "captured"].includes(paymentStatus) ||
    Boolean(row.razorpay_payment_id);

  return wasPaid ? amount : null;
}

function mapBookingRow(row) {
  const customerName = row.customer_name || row.username || "Customer";
  const payment = getPaidAmount(row);

  return {
    id: formatBookingId(row.id),
    bookingId: row.id,
    customer: {
      name: customerName,
      initials: getInitials(customerName),
      color: getAvatarColor(customerName),
    },
    agent: row.agent_name || "—",
    pickup: formatPickup(row),
    pickupFull: row.pickup_address || row.departure_airport || row.departure_city || "",
    status: mapAdminStatus(row.status),
    payment: Number.isFinite(payment) ? payment : null,
    paymentStatus: row.payment_status || "pending",
    createdAt: row.created_at,
  };
}

const LIST_QUERY = `
  SELECT
    b.id,
    b.username,
    b.phone,
    b.pickup_address,
    b.departure_airport,
    b.departure_city,
    b.status,
    b.payment_status,
    b.amount,
    b.razorpay_payment_id,
    b.created_at,
    b.assigned_agent_id,
    COALESCE(u.name, b.username) AS customer_name,
    COALESCE(sa.name, sa2.name) AS agent_name
  FROM bookings b
  LEFT JOIN users u ON REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') =
                        REPLACE(REPLACE(REPLACE(b.phone, '+', ''), '-', ''), ' ', '')
  LEFT JOIN support_agents sa ON sa.agent_id = b.assigned_agent_id
  LEFT JOIN agent_sessions s ON s.booking_id = b.id AND s.status = 'active'
  LEFT JOIN support_agents sa2 ON sa2.agent_id = s.agent_id
  ORDER BY b.created_at DESC
  LIMIT 200
`;

router.get("/count", (req, res) => {
  db.query(
    `SELECT COUNT(*) AS count FROM bookings WHERE status NOT IN ('cancelled', 'completed')`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Failed to count bookings" });
      }
      return res.json({ success: true, count: Number(rows?.[0]?.count ?? 0) });
    }
  );
});

router.get("/", (req, res) => {
  db.query(LIST_QUERY, (err, rows) => {
    if (err) {
      console.error("[AdminBookings] Failed to fetch bookings:", err.message);
      return res.status(500).json({ success: false, message: "Failed to fetch bookings" });
    }

    return res.json({
      success: true,
      bookings: (rows || []).map(mapBookingRow),
      count: rows?.length ?? 0,
    });
  });
});

module.exports = router;
