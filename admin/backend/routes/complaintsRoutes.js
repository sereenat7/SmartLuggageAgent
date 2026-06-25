const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { sendComplaintEmail } = require("../utils/notify");

const AVATAR_COLORS = [
  "#f472b6",
  "#ec4899",
  "#22d3ee",
  "#a78bfa",
  "#4ade80",
  "#fb923c",
  "#f87171",
  "#fbbf24",
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

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function mapComplaintRow(row) {
  const issueLabel = row.custom_issue_type || row.issue_type;
  const text = `${issueLabel}: ${row.message}`;

  return {
    id: row.id,
    name: row.user_name,
    initials: getInitials(row.user_name),
    color: getAvatarColor(row.user_name),
    referenceId: `CMP-${String(row.id).padStart(4, "0")}`,
    issueType: issueLabel,
    text,
    priority: row.priority,
    status: row.status,
    date: formatDate(row.created_at),
    adminReply: row.admin_reply || null,
    repliedAt: row.replied_at ? formatDate(row.replied_at) : null,
  };
}

router.get("/count", (req, res) => {
  db.query(`SELECT COUNT(*) AS count FROM complaints WHERE status = 'Open'`, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Failed to count complaints" });
    }
    return res.json({ success: true, count: Number(results?.[0]?.count ?? 0) });
  });
});

router.get("/", (req, res) => {
  const query = `
    SELECT id, user_name, issue_type, custom_issue_type, message, priority, status,
           admin_reply, replied_at, created_at
    FROM complaints
    ORDER BY created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Failed to fetch complaints" });
    }
    return res.json({
      success: true,
      complaints: (results || []).map(mapComplaintRow),
    });
  });
});

router.post("/:id/reply", async (req, res) => {
  const complaintId = Number(req.params.id);
  const replyMessage = String(req.body?.message || "").trim();

  if (!Number.isFinite(complaintId)) {
    return res.status(400).json({ success: false, message: "Invalid complaint id" });
  }

  if (!replyMessage) {
    return res.status(400).json({ success: false, message: "Reply message is required" });
  }

  db.query(
    `SELECT id, user_name, user_email, issue_type, custom_issue_type, message, status
     FROM complaints WHERE id = ? LIMIT 1`,
    [complaintId],
    async (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Failed to load complaint" });
      }
      if (!rows?.length) {
        return res.status(404).json({ success: false, message: "Complaint not found" });
      }

      const complaint = rows[0];
      const issueLabel = complaint.custom_issue_type || complaint.issue_type;

      if (!complaint.user_email?.trim()) {
        return res.status(400).json({
          success: false,
          message: "This complaint has no email on file.",
          emailSent: false,
        });
      }

      const emailResult = await sendComplaintEmail({
        to: complaint.user_email,
        name: complaint.user_name,
        issueType: issueLabel,
        replyMessage,
      });

      if (!emailResult.sent) {
        return res.status(502).json({
          success: false,
          message: emailResult.reason?.includes("not configured")
            ? "Email is not configured. Add SMTP_USER and SMTP_PASS in admin/backend/.env"
            : `Email could not be sent: ${emailResult.reason || "unknown error"}`,
          emailSent: false,
        });
      }

      db.query(
        `UPDATE complaints SET admin_reply = ?, replied_at = NOW(), status = 'In Review' WHERE id = ?`,
        [replyMessage, complaintId],
        (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ success: false, message: "Reply sent but failed to save" });
          }

          db.query(
            `SELECT id, user_name, issue_type, custom_issue_type, message, priority, status,
                    admin_reply, replied_at, created_at
             FROM complaints WHERE id = ? LIMIT 1`,
            [complaintId],
            (fetchErr, updatedRows) => {
              if (fetchErr || !updatedRows?.length) {
                return res.json({ success: true, message: "Reply sent via email", emailSent: true });
              }
              return res.json({
                success: true,
                message: "Reply sent via email",
                emailSent: true,
                complaint: mapComplaintRow(updatedRows[0]),
              });
            }
          );
        }
      );
    }
  );
});

module.exports = router;
