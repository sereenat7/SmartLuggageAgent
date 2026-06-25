const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const db = require("../config/db");
const { getSmtpCredentials } = require("./mailboxMail");

const AVATAR_COLORS = [
  "#f472b6",
  "#4ade80",
  "#fb923c",
  "#a78bfa",
  "#38bdf8",
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

function formatMailboxTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function buildPreview(text, max = 120) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "(No content)";
  return cleaned.length > max ? `${cleaned.slice(0, max)}...` : cleaned;
}

function insertMessage(message, attachments, callback) {
  const insertQuery = `
    INSERT INTO mailbox_messages (
      external_id, imap_uid, folder, direction, from_name, from_email, to_email,
      subject, body_text, body_html, preview, is_read, in_reply_to, received_at
    ) VALUES (?, ?, 'inbox', 'inbound', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `;

  db.query(
    insertQuery,
    [
      message.externalId,
      message.imapUid || null,
      message.fromName,
      message.fromEmail,
      message.toEmail,
      message.subject,
      message.bodyText,
      message.bodyHtml,
      message.preview,
      message.inReplyTo,
      message.receivedAt,
    ],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return callback(null, null);
        }
        return callback(err);
      }

      const messageId = result.insertId;
      if (!attachments.length) {
        return callback(null, messageId);
      }

      const attachmentQuery = `
        INSERT INTO mailbox_attachments (
          message_id, filename, mime_type, size_bytes, content_base64, is_inline, content_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      let pending = attachments.length;
      let attachmentError = null;

      attachments.forEach((attachment) => {
        db.query(
          attachmentQuery,
          [
            messageId,
            attachment.filename,
            attachment.mimeType,
            attachment.size,
            attachment.contentBase64,
            attachment.isInline ? 1 : 0,
            attachment.contentId,
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

function messageExists(externalId, callback) {
  db.query(
    "SELECT id FROM mailbox_messages WHERE external_id = ? LIMIT 1",
    [externalId],
    (err, rows) => {
      if (err) return callback(err, false);
      callback(null, rows.length > 0);
    }
  );
}

async function syncMailboxInbox() {
  const credentials = getSmtpCredentials();
  if (!credentials) {
    return { synced: 0, skipped: true, reason: "SMTP not configured" };
  }

  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: credentials,
    logger: false,
  });

  let synced = 0;
  const since = new Date();
  since.setDate(since.getDate() - 30);

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const uids = await client.search({ since });
      const uidList = Array.isArray(uids) ? uids.slice(-100) : [];

      for (const uid of uidList) {
        const downloaded = await client.fetchOne(
          uid,
          { source: true, envelope: true },
          { uid: true }
        );
        if (!downloaded?.source) continue;

        const parsed = await simpleParser(downloaded.source);
        const externalId = parsed.messageId || `imap-uid-${uid}`;
        const fromAddress = parsed.from?.value?.[0];
        const toAddress = parsed.to?.value?.[0];

        const exists = await new Promise((resolve, reject) => {
          messageExists(externalId, (err, found) => (err ? reject(err) : resolve(found)));
        });
        if (exists) continue;

        const attachments = (parsed.attachments || []).map((attachment) => ({
          filename: attachment.filename || "attachment",
          mimeType: attachment.contentType || "application/octet-stream",
          size: attachment.size || 0,
          contentBase64: attachment.content?.toString("base64") || "",
          isInline: Boolean(attachment.contentDisposition === "inline" || attachment.cid),
          contentId: attachment.cid || null,
        }));

        const message = {
          externalId,
          imapUid: uid,
          fromName: fromAddress?.name || fromAddress?.address || "Unknown",
          fromEmail: fromAddress?.address || "",
          toEmail: toAddress?.address || credentials.user,
          subject: parsed.subject || "(No subject)",
          bodyText: parsed.text || "",
          bodyHtml: parsed.html || "",
          preview: buildPreview(parsed.text || parsed.subject),
          inReplyTo: parsed.inReplyTo || null,
          receivedAt: parsed.date || new Date(),
        };

        await new Promise((resolve, reject) => {
          insertMessage(message, attachments, (err, id) => {
            if (err) return reject(err);
            if (id) synced += 1;
            resolve();
          });
        });
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (error) {
    console.error("[Mailbox] IMAP sync failed:", error.message);
    return { synced, error: error.message };
  }

  if (synced > 0) {
    console.log(`[Mailbox] Synced ${synced} new message(s) from inbox`);
  }

  return { synced };
}

async function moveMessageToImapTrash(imapUid) {
  const credentials = getSmtpCredentials();
  if (!credentials || !imapUid) {
    return { moved: false, reason: "Missing credentials or IMAP uid" };
  }

  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: credentials,
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const trashMailbox = process.env.IMAP_TRASH_MAILBOX || "[Gmail]/Trash";
      await client.messageMove([imapUid], trashMailbox, { uid: true });
    } finally {
      lock.release();
    }
    await client.logout();
    return { moved: true };
  } catch (error) {
    console.error("[Mailbox] IMAP trash move failed:", error.message);
    return { moved: false, error: error.message };
  }
}

let syncInProgress = false;

function startMailboxSyncScheduler(intervalMs = 60000) {
  const runSync = async () => {
    if (syncInProgress) return;
    syncInProgress = true;
    try {
      await syncMailboxInbox();
    } finally {
      syncInProgress = false;
    }
  };

  runSync();
  return setInterval(runSync, intervalMs);
}

module.exports = {
  syncMailboxInbox,
  startMailboxSyncScheduler,
  moveMessageToImapTrash,
  getInitials,
  getAvatarColor,
  formatMailboxTime,
  buildPreview,
};
