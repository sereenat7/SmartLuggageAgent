const express = require("express");
const router = express.Router();
const db = require("../config/db");

const AVATAR_COLORS = [
  "#a78bfa",
  "#f87171",
  "#fb923c",
  "#f472b6",
  "#38bdf8",
  "#4ade80",
  "#fbbf24",
  "#c084fc",
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

function formatReviewDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatReviewText(category, message) {
  const trimmedMessage = String(message || "").trim();
  const trimmedCategory = String(category || "").trim();
  if (trimmedCategory) return `${trimmedCategory}: '${trimmedMessage}'`;
  return trimmedMessage;
}

function mapReviewRow(row) {
  const name = row.user_name || "User";
  return {
    id: row.id,
    name,
    initials: getInitials(name),
    color: getAvatarColor(name),
    rating: Number(row.rating) || 0,
    date: formatReviewDate(row.created_at),
    text: formatReviewText(row.category, row.message),
    category: row.category || null,
    message: row.message,
    phone: row.user_phone || null,
  };
}

router.get("/", (req, res) => {
  db.query(
    `SELECT id, user_name, user_phone, category, rating, message, created_at
     FROM reviews ORDER BY created_at DESC`,
    (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch reviews" });
      }
      return res.json({
        success: true,
        reviews: (results || []).map(mapReviewRow),
      });
    }
  );
});

module.exports = router;
