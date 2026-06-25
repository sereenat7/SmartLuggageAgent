const express = require("express");
const router = express.Router();
const db = require("../db");

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

  if (trimmedCategory) {
    return `${trimmedCategory}: '${trimmedMessage}'`;
  }

  return trimmedMessage;
}

function mapReviewRow(row) {
  const name = row.user_name || "User";
  const text = formatReviewText(row.category, row.message);

  return {
    id: row.id,
    name,
    initials: getInitials(name),
    color: getAvatarColor(name),
    rating: Number(row.rating) || 0,
    date: formatReviewDate(row.created_at),
    text,
    category: row.category || null,
    message: row.message,
    phone: row.user_phone || null,
  };
}

router.get("/", (req, res) => {
  const query = `
    SELECT id, user_name, user_phone, category, rating, message, created_at
    FROM reviews
    ORDER BY created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Failed to fetch reviews:", err.message);
      return res.status(500).json({ success: false, message: "Failed to fetch reviews" });
    }

    console.log(`[Reviews] Fetched ${results?.length || 0} review(s)`);

    return res.json({
      success: true,
      reviews: (results || []).map(mapReviewRow),
    });
  });
});

router.post("/", (req, res) => {
  const { name, phone, category, rating, message } = req.body;

  console.log("[Reviews] Incoming feedback:", {
    name,
    phone,
    category,
    rating,
    messageLength: String(message || "").trim().length,
  });

  const trimmedMessage = String(message || "").trim();
  const parsedRating = Number(rating);
  const trimmedCategory = category ? String(category).trim() : null;
  const userName = String(name || "User").trim() || "User";
  const userPhone = phone ? String(phone).trim() : null;

  if (!trimmedMessage) {
    return res.status(400).json({ success: false, message: "Feedback message is required" });
  }

  if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({ success: false, message: "A rating between 1 and 5 is required" });
  }

  const insertQuery = `
    INSERT INTO reviews (user_name, user_phone, category, rating, message)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    insertQuery,
    [userName, userPhone, trimmedCategory || null, parsedRating, trimmedMessage],
    (err, result) => {
      if (err) {
        console.error("Failed to save review:", err.message);
        return res.status(500).json({ success: false, message: "Failed to submit feedback" });
      }

      const selectQuery = `
        SELECT id, user_name, user_phone, category, rating, message, created_at
        FROM reviews
        WHERE id = ?
        LIMIT 1
      `;

      db.query(selectQuery, [result.insertId], (selectErr, rows) => {
        if (selectErr || !rows || rows.length === 0) {
          console.log("[Reviews] Saved feedback with id:", result.insertId);
          return res.json({
            success: true,
            message: "Feedback submitted successfully",
          });
        }

        console.log("[Reviews] Saved feedback with id:", result.insertId, "from", userName);

        return res.status(201).json({
          success: true,
          message: "Feedback submitted successfully",
          review: mapReviewRow(rows[0]),
        });
      });
    }
  );
});

module.exports = router;
