const express = require("express");
const multer = require("multer");
const router = express.Router();
const db = require("../config/db");
const { sendMailboxEmail } = require("../utils/mailboxMail");
const {
  syncMailboxInbox,
  getInitials,
  getAvatarColor,
  formatMailboxTime,
  buildPreview,
  moveMessageToImapTrash,
} = require("../utils/mailboxSync");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

function mapAttachmentRow(row) {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mime_type,
    size: row.size_bytes,
    isInline: Boolean(row.is_inline),
    isImage: String(row.mime_type || "").startsWith("image/"),
    url: `/api/mailbox/attachments/${row.id}`,
  };
}

function mapMessageRow(row, attachments = []) {
  const isSent = row.folder === "sent" || row.direction === "outbound";
  const senderName = isSent
    ? row.to_email || "Unknown recipient"
    : row.from_name || "Unknown";
  const senderEmail = isSent ? row.to_email : row.from_email;
  const timestamp = row.sent_at || row.received_at || row.created_at;

  return {
    id: row.id,
    folder: row.folder,
    direction: row.direction,
    sender: isSent ? `To: ${senderName}` : senderName,
    senderEmail: senderEmail || "",
    initials: getInitials(senderName),
    color: getAvatarColor(senderName),
    time: formatMailboxTime(timestamp),
    subject: row.subject || "(No subject)",
    preview: row.preview || buildPreview(row.body_text),
    unread: row.folder === "inbox" && !row.is_read,
    body: String(row.body_text || "")
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean),
    bodyHtml: row.body_html || null,
    attachments,
    inReplyTo: row.in_reply_to,
    receivedAt: timestamp,
    adminReply: row.admin_reply || null,
    repliedAt: row.replied_at ? formatMailboxTime(row.replied_at) : null,
    hasReplied: Boolean(row.admin_reply),
  };
}

function fetchAttachmentsForMessages(messageIds, callback) {
  if (!messageIds.length) return callback(null, {});

  const placeholders = messageIds.map(() => "?").join(",");
  const query = `
    SELECT id, message_id, filename, mime_type, size_bytes, is_inline
    FROM mailbox_attachments
    WHERE message_id IN (${placeholders})
    ORDER BY id ASC
  `;

  db.query(query, messageIds, (err, rows) => {
    if (err) return callback(err);

    const grouped = {};
    (rows || []).forEach((row) => {
      if (!grouped[row.message_id]) grouped[row.message_id] = [];
      grouped[row.message_id].push(mapAttachmentRow(row));
    });
    callback(null, grouped);
  });
}

function saveSentMessage({ to, subject, body, inReplyTo, attachments }, callback) {
  const fromEmail = process.env.SMTP_USER?.trim() || "";
  const preview = buildPreview(body);
  const insertQuery = `
    INSERT INTO mailbox_messages (
      external_id, folder, direction, from_name, from_email, to_email,
      subject, body_text, preview, is_read, in_reply_to, sent_at
    ) VALUES (?, 'sent', 'outbound', ?, ?, ?, ?, ?, ?, 1, ?, NOW())
  `;

  const externalId = `sent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  db.query(
    insertQuery,
    [
      externalId,
      "Smart Luggage Support",
      fromEmail,
      to,
      subject,
      body,
      preview,
      inReplyTo || null,
    ],
    (err, result) => {
      if (err) return callback(err);

      const messageId = result.insertId;
      if (!attachments.length) return callback(null, messageId);

      const attachmentQuery = `
        INSERT INTO mailbox_attachments (
          message_id, filename, mime_type, size_bytes, content_base64, is_inline
        ) VALUES (?, ?, ?, ?, ?, 0)
      `;

      let pending = attachments.length;
      let attachmentError = null;

      attachments.forEach((file) => {
        db.query(
          attachmentQuery,
          [
            messageId,
            file.filename,
            file.mimeType,
            file.size,
            file.content.toString("base64"),
          ],
          (attachErr) => {
            if (attachErr && !attachmentError) attachmentError = attachErr;
            pending -= 1;
            if (pending === 0) callback(attachmentError, messageId);
          }
        );
      });
    }
  );
}

router.get("/unread-count", (req, res) => {
  const query = `
    SELECT COUNT(*) AS count
    FROM mailbox_messages
    WHERE folder = 'inbox' AND is_read = 0
  `;

  db.query(query, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Failed to count unread mail" });
    }
    return res.json({ success: true, count: Number(rows?.[0]?.count ?? 0) });
  });
});

router.post("/sync", async (req, res) => {
  try {
    const result = await syncMailboxInbox();
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/messages", (req, res) => {
  const folder = String(req.query.folder || "inbox");
  const allowed = ["inbox", "sent", "trash"];
  if (!allowed.includes(folder)) {
    return res.status(400).json({ success: false, message: "Invalid folder" });
  }

  const query = `
    SELECT id, folder, direction, from_name, from_email, to_email, subject,
           body_text, body_html, preview, is_read, in_reply_to, admin_reply, replied_at,
           received_at, sent_at, created_at
    FROM mailbox_messages
    WHERE folder = ?
    ORDER BY COALESCE(received_at, sent_at, created_at) DESC
    LIMIT 200
  `;

  db.query(query, [folder], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Failed to fetch messages" });
    }

    const messageIds = (rows || []).map((row) => row.id);
    fetchAttachmentsForMessages(messageIds, (attachErr, grouped) => {
      if (attachErr) {
        return res.status(500).json({ success: false, message: "Failed to fetch attachments" });
      }

      return res.json({
        success: true,
        messages: (rows || []).map((row) => mapMessageRow(row, grouped[row.id] || [])),
      });
    });
  });
});

router.get("/messages/:id", (req, res) => {
  const messageId = Number(req.params.id);
  if (!Number.isFinite(messageId)) {
    return res.status(400).json({ success: false, message: "Invalid message id" });
  }

  const query = `
    SELECT id, folder, direction, from_name, from_email, to_email, subject,
           body_text, body_html, preview, is_read, in_reply_to, admin_reply, replied_at,
           received_at, sent_at, created_at
    FROM mailbox_messages
    WHERE id = ?
    LIMIT 1
  `;

  db.query(query, [messageId], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Failed to load message" });
    }
    if (!rows?.length) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const row = rows[0];
    const attachQuery = `
      SELECT id, message_id, filename, mime_type, size_bytes, is_inline
      FROM mailbox_attachments
      WHERE message_id = ?
      ORDER BY id ASC
    `;

    db.query(attachQuery, [messageId], (attachErr, attachments) => {
      if (attachErr) {
        return res.status(500).json({ success: false, message: "Failed to load attachments" });
      }

      if (row.folder === "inbox" && !row.is_read) {
        db.query("UPDATE mailbox_messages SET is_read = 1 WHERE id = ?", [messageId]);
      }

      return res.json({
        success: true,
        message: mapMessageRow(
          { ...row, is_read: 1 },
          (attachments || []).map(mapAttachmentRow)
        ),
      });
    });
  });
});

router.patch("/messages/:id/folder", (req, res) => {
  const messageId = Number(req.params.id);
  const folder = String(req.body?.folder || "").trim();
  const allowed = ["inbox", "sent", "trash"];

  if (!Number.isFinite(messageId) || !allowed.includes(folder)) {
    return res.status(400).json({ success: false, message: "Invalid request" });
  }

  db.query(
    "SELECT id, folder, direction, imap_uid FROM mailbox_messages WHERE id = ? LIMIT 1",
    [messageId],
    async (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Failed to load message" });
      }
      if (!rows?.length) {
        return res.status(404).json({ success: false, message: "Message not found" });
      }

      const row = rows[0];

      if (folder === "trash" && row.direction === "inbound" && row.imap_uid) {
        await moveMessageToImapTrash(row.imap_uid);
      }

      db.query("UPDATE mailbox_messages SET folder = ? WHERE id = ?", [folder, messageId], (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ success: false, message: "Failed to update folder" });
        }
        return res.json({ success: true, message: "Folder updated" });
      });
    }
  );
});

router.delete("/messages/:id", (req, res) => {
  const messageId = Number(req.params.id);
  if (!Number.isFinite(messageId)) {
    return res.status(400).json({ success: false, message: "Invalid message id" });
  }

  db.query(
    "SELECT id, folder FROM mailbox_messages WHERE id = ? LIMIT 1",
    [messageId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Failed to load message" });
      }
      if (!rows?.length) {
        return res.status(404).json({ success: false, message: "Message not found" });
      }
      if (rows[0].folder !== "trash") {
        return res.status(400).json({ success: false, message: "Only messages in Trash can be deleted permanently" });
      }

      db.query("DELETE FROM mailbox_attachments WHERE message_id = ?", [messageId], (attachErr) => {
        if (attachErr) {
          return res.status(500).json({ success: false, message: "Failed to delete attachments" });
        }

        db.query("DELETE FROM mailbox_messages WHERE id = ?", [messageId], (deleteErr) => {
          if (deleteErr) {
            return res.status(500).json({ success: false, message: "Failed to delete message" });
          }
          return res.json({ success: true, message: "Message deleted" });
        });
      });
    }
  );
});

router.get("/attachments/:id", (req, res) => {
  const attachmentId = Number(req.params.id);
  if (!Number.isFinite(attachmentId)) {
    return res.status(400).json({ success: false, message: "Invalid attachment id" });
  }

  db.query(
    "SELECT filename, mime_type, content_base64 FROM mailbox_attachments WHERE id = ? LIMIT 1",
    [attachmentId],
    (err, rows) => {
      if (err || !rows?.length) {
        return res.status(404).json({ success: false, message: "Attachment not found" });
      }

      const attachment = rows[0];
      const buffer = Buffer.from(attachment.content_base64 || "", "base64");
      res.setHeader("Content-Type", attachment.mime_type || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(attachment.filename || "attachment")}"`
      );
      return res.send(buffer);
    }
  );
});

router.post("/send", upload.array("attachments", 5), async (req, res) => {
  const to = String(req.body?.to || "").trim();
  const subject = String(req.body?.subject || "").trim();
  const body = String(req.body?.message || req.body?.body || "").trim();

  if (!to || !subject || !body) {
    return res.status(400).json({ success: false, message: "To, subject, and message are required" });
  }

  const files = (req.files || []).map((file) => ({
    filename: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    content: file.buffer,
  }));

  try {
    await sendMailboxEmail({ to, subject, text: body, attachments: files });

    saveSentMessage({ to, subject, body, attachments: files }, (saveErr, messageId) => {
      if (saveErr) {
        console.error("[Mailbox] Sent mail saved with error:", saveErr.message);
        return res.json({
          success: true,
          message: "Email sent successfully",
          messageId: null,
        });
      }

      const fetchQuery = `
        SELECT id, folder, direction, from_name, from_email, to_email, subject,
               body_text, body_html, preview, is_read, in_reply_to, admin_reply, replied_at,
               received_at, sent_at, created_at
        FROM mailbox_messages
        WHERE id = ?
        LIMIT 1
      `;

      db.query(fetchQuery, [messageId], (fetchErr, rows) => {
        if (fetchErr || !rows?.length) {
          return res.json({
            success: true,
            message: "Email sent successfully",
            messageId,
          });
        }

        return res.json({
          success: true,
          message: "Email sent successfully",
          messageId,
          savedMessage: mapMessageRow(rows[0], []),
        });
      });
    });
  } catch (error) {
    return res.status(502).json({ success: false, message: error.message });
  }
});

router.post("/messages/:id/reply", upload.array("attachments", 5), async (req, res) => {
  const messageId = Number(req.params.id);
  const body = String(req.body?.message || req.body?.body || "").trim();

  if (!Number.isFinite(messageId) || !body) {
    return res.status(400).json({ success: false, message: "Message id and reply body are required" });
  }

  const query = `
    SELECT id, from_email, from_name, subject, external_id, in_reply_to
    FROM mailbox_messages
    WHERE id = ?
    LIMIT 1
  `;

  db.query(query, [messageId], async (err, rows) => {
    if (err || !rows?.length) {
      return res.status(404).json({ success: false, message: "Original message not found" });
    }

    const original = rows[0];
    const to = original.from_email;
    if (!to) {
      return res.status(400).json({ success: false, message: "Original sender email is missing" });
    }

    const subject = String(original.subject || "").startsWith("Re:")
      ? original.subject
      : `Re: ${original.subject || "Your message"}`;

    const files = (req.files || []).map((file) => ({
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      content: file.buffer,
    }));

    try {
      await sendMailboxEmail({
        to,
        subject,
        text: body,
        inReplyTo: original.external_id,
        references: original.in_reply_to || original.external_id,
        attachments: files,
      });

      db.query(
        "UPDATE mailbox_messages SET is_read = 1, admin_reply = ?, replied_at = NOW() WHERE id = ?",
        [body, messageId]
      );

      saveSentMessage(
        {
          to,
          subject,
          body,
          inReplyTo: original.external_id,
          attachments: files,
        },
        (saveErr) => {
          if (saveErr) console.error("[Mailbox] Reply save failed:", saveErr.message);

          const fetchUpdated = `
            SELECT id, folder, direction, from_name, from_email, to_email, subject,
                   body_text, body_html, preview, is_read, in_reply_to, admin_reply, replied_at,
                   received_at, sent_at, created_at
            FROM mailbox_messages
            WHERE id = ?
            LIMIT 1
          `;

          db.query(fetchUpdated, [messageId], (fetchErr, updatedRows) => {
            if (fetchErr || !updatedRows?.length) {
              return res.json({ success: true, message: "Reply sent successfully" });
            }

            const attachQuery = `
              SELECT id, message_id, filename, mime_type, size_bytes, is_inline
              FROM mailbox_attachments
              WHERE message_id = ?
              ORDER BY id ASC
            `;

            db.query(attachQuery, [messageId], (attachErr, attachments) => {
              const mapped = mapMessageRow(
                updatedRows[0],
                (attachments || []).map(mapAttachmentRow)
              );
              return res.json({
                success: true,
                message: "Reply sent successfully",
                updatedMessage: mapped,
              });
            });
          });
        }
      );
    } catch (error) {
      return res.status(502).json({ success: false, message: error.message });
    }
  });
});

module.exports = router;
