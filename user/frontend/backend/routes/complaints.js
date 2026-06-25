const express = require("express");
const router = express.Router();
const db = require("../db");
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

const PRIORITY_BY_ISSUE = {
  "Lost luggage": "High",
  "Delayed pickup": "Medium",
  "Damaged luggage": "High",
  "Payment issue": "High",
  "App bug": "Low",
  Other: "Medium",
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
  const query = `SELECT COUNT(*) AS count FROM complaints WHERE status = 'Open'`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("[Complaints] Count failed:", err.message);
      return res.status(500).json({ success: false, message: "Failed to count complaints" });
    }

    return res.json({
      success: true,
      count: Number(results?.[0]?.count ?? 0),
    });
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
      console.error("[Complaints] Fetch failed:", err.message);
      return res.status(500).json({ success: false, message: "Failed to fetch complaints" });
    }

    return res.json({
      success: true,
      complaints: (results || []).map(mapComplaintRow),
    });
  });
});

router.post("/", (req, res) => {
  const { name, email, phone, issueType, customIssueType, message } = req.body;

  const userName = String(name || "User").trim() || "User";
  const userEmail = email ? String(email).trim().toLowerCase() : null;
  const userPhone = phone ? String(phone).trim() : null;
  const issue = String(issueType || "").trim();
  const customIssue = customIssueType ? String(customIssueType).trim() : null;
  const complaintMessage = String(message || "").trim();

  if (!issue) {
    return res.status(400).json({ success: false, message: "Issue type is required" });
  }

  if (!complaintMessage) {
    return res.status(400).json({ success: false, message: "Message is required" });
  }

  if (issue === "Other" && !customIssue) {
    return res.status(400).json({ success: false, message: "Please specify the issue" });
  }

  const priority = PRIORITY_BY_ISSUE[issue] || "Medium";

  const insertQuery = `
    INSERT INTO complaints (
      user_name, user_email, user_phone, issue_type, custom_issue_type, message, priority, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')
  `;

  db.query(
    insertQuery,
    [userName, userEmail, userPhone, issue, customIssue, complaintMessage, priority],
    (err, result) => {
      if (err) {
        console.error("[Complaints] Save failed:", err.message);
        return res.status(500).json({ success: false, message: "Failed to submit complaint" });
      }

      const selectQuery = `
        SELECT id, user_name, issue_type, custom_issue_type, message, priority, status,
               admin_reply, replied_at, created_at
        FROM complaints
        WHERE id = ?
        LIMIT 1
      `;

      db.query(selectQuery, [result.insertId], (selectErr, rows) => {
        if (selectErr || !rows?.length) {
          return res.json({ success: true, message: "Complaint submitted successfully" });
        }

        console.log("[Complaints] Saved complaint", result.insertId, "from", userName);
        return res.status(201).json({
          success: true,
          message: "Complaint submitted successfully",
          complaint: mapComplaintRow(rows[0]),
        });
      });
    }
  );
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

  const selectQuery = `
    SELECT id, user_name, user_email, user_phone, issue_type, custom_issue_type, message, status
    FROM complaints
    WHERE id = ?
    LIMIT 1
  `;

  db.query(selectQuery, [complaintId], async (err, rows) => {
    if (err) {
      console.error("[Complaints] Reply lookup failed:", err.message);
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

    let emailResult = { sent: false };

    try {
      emailResult = await sendComplaintEmail({
        to: complaint.user_email,
        name: complaint.user_name,
        issueType: issueLabel,
        replyMessage,
      });
    } catch (emailErr) {
      console.error("[Complaints] Email failed:", emailErr.message);
      emailResult = { sent: false, reason: emailErr.message };
    }

    if (!emailResult.sent) {
      return res.status(502).json({
        success: false,
        message:
          emailResult.reason?.includes("not configured")
            ? "Email is not configured. Add SMTP_USER and SMTP_PASS in backend .env (Gmail App Password)."
            : `Email could not be sent: ${emailResult.reason || "unknown error"}`,
        emailSent: false,
      });
    }

    const updateQuery = `
      UPDATE complaints
      SET admin_reply = ?, replied_at = NOW(), status = 'In Review'
      WHERE id = ?
    `;

    db.query(updateQuery, [replyMessage, complaintId], (updateErr) => {
      if (updateErr) {
        console.error("[Complaints] Reply save failed:", updateErr.message);
        return res.status(500).json({ success: false, message: "Reply sent but failed to save" });
      }

      const fetchUpdated = `
        SELECT id, user_name, issue_type, custom_issue_type, message, priority, status,
               admin_reply, replied_at, created_at
        FROM complaints
        WHERE id = ?
        LIMIT 1
      `;

      db.query(fetchUpdated, [complaintId], (fetchErr, updatedRows) => {
        if (fetchErr || !updatedRows?.length) {
          return res.json({
            success: true,
            message: "Reply sent via email",
            emailSent: true,
          });
        }

        return res.json({
          success: true,
          message: "Reply sent via email",
          emailSent: true,
          complaint: mapComplaintRow(updatedRows[0]),
        });
      });
    });
  });
});

module.exports = router;
