const express = require("express");
const router = express.Router();
const db = require("../config/db");

const AVATAR_COLORS = [
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#38bdf8",
  "#4ade80",
  "#f87171",
  "#fbbf24",
  "#22d3ee",
];

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

function formatPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return String(phone || "").trim() || "—";
}

function mapUserRow(row) {
  const bookings = Number(row.bookings ?? 0);
  const createdAt = row.created_at ? new Date(row.created_at) : null;
  const isRecent =
    createdAt &&
    !Number.isNaN(createdAt.getTime()) &&
    Date.now() - createdAt.getTime() < 30 * 24 * 60 * 60 * 1000;

  return {
    id: row.id,
    name: row.name || "Unknown",
    initials: getInitials(row.name),
    color: getAvatarColor(row.name),
    email: row.email || "—",
    phone: formatPhone(row.phone),
    bookings,
    status: bookings > 0 || isRecent ? "Active" : "Inactive",
    createdAt: row.created_at,
  };
}

router.get("/", (req, res) => {
  const query = `
    SELECT
      u.id,
      u.name,
      u.phone,
      u.email,
      u.created_at,
      (
        SELECT COUNT(*)
        FROM bookings b
        WHERE b.phone = u.phone
           OR REPLACE(REPLACE(REPLACE(b.phone, ' ', ''), '-', ''), '+', '') =
              REPLACE(REPLACE(REPLACE(u.phone, ' ', ''), '-', ''), '+', '')
      ) AS bookings
    FROM users u
    ORDER BY u.created_at DESC
  `;

  db.query(query, (err, rows) => {
    if (err) {
      console.error("[Users] Failed to fetch users:", err.message);
      return res.status(500).json({ success: false, message: "Failed to fetch users" });
    }

    return res.json({
      success: true,
      users: (rows || []).map(mapUserRow),
      count: rows?.length ?? 0,
    });
  });
});

module.exports = router;
