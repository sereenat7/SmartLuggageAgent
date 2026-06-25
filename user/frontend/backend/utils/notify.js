const nodemailer = require("nodemailer");
const twilio = require("twilio");
require("dotenv").config();

const twilioClient =
  process.env.TWILIO_SID && process.env.TWILIO_AUTH
    ? twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH)
    : null;

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}

function getSmtpCredentials() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim()?.replace(/\s/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

function getFromAddress() {
  const smtpUser = process.env.SMTP_USER?.trim();
  const configuredFrom = process.env.SMTP_FROM?.trim();
  const resendFrom = process.env.RESEND_FROM?.trim();

  if (configuredFrom && !configuredFrom.includes("your-email")) {
    return configuredFrom;
  }
  if (resendFrom) return resendFrom;
  if (smtpUser) return `"Smart Luggage Support" <${smtpUser}>`;
  return "Smart Luggage Support <onboarding@resend.dev>";
}

function getMailTransport() {
  const credentials = getSmtpCredentials();
  if (!credentials) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: credentials,
  });
}

function isEmailConfigured() {
  return Boolean(getSmtpCredentials() || process.env.RESEND_API_KEY?.trim());
}

function logEmailConfigStatus() {
  if (process.env.RESEND_API_KEY?.trim()) {
    console.log("[Notify] Email: Resend API configured");
    return;
  }
  if (getSmtpCredentials()) {
    console.log(`[Notify] Email: Gmail SMTP configured (${process.env.SMTP_USER.trim()})`);
    return;
  }
  console.warn(
    "[Notify] Email NOT configured — add SMTP_USER + SMTP_PASS (Gmail App Password) or RESEND_API_KEY in backend .env"
  );
}

async function sendViaResend({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [to],
      subject,
      text,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || result.error || `Resend error (${response.status})`);
  }

  console.log(`[Notify] Email sent via Resend to ${to}`);
  return { sent: true, provider: "resend" };
}

async function sendViaSmtp({ to, subject, text }) {
  const transport = getMailTransport();
  if (!transport) return null;

  await transport.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
  });

  console.log(`[Notify] Email sent via Gmail SMTP to ${to}`);
  return { sent: true, provider: "smtp" };
}

async function sendComplaintEmail({ to, name, issueType, replyMessage }) {
  if (!to?.trim()) {
    return { sent: false, reason: "Missing customer email" };
  }

  if (!isEmailConfigured()) {
    console.warn("[Notify] Email skipped — SMTP_USER/SMTP_PASS or RESEND_API_KEY not set in .env");
    return { sent: false, reason: "Email not configured" };
  }

  const subject = `Re: Your Smart Luggage complaint - ${issueType}`;
  const text = `Hi ${name || "there"},

Thank you for reporting your issue (${issueType}).

Our support team has replied:

${replyMessage}

If you need more help, please reply to this email or use the app.

Smart Luggage Support`;

  const payload = { to: to.trim(), subject, text };

  try {
    if (process.env.RESEND_API_KEY?.trim()) {
      return await sendViaResend(payload);
    }
    return await sendViaSmtp(payload);
  } catch (error) {
    console.error("[Notify] Email send failed:", error.message);
    let reason = error.message;
    if (reason.includes("BadCredentials") || reason.includes("Username and Password not accepted")) {
      reason =
        "Gmail rejected the login. Use an App Password in SMTP_PASS (not your normal Gmail password). Create one at https://myaccount.google.com/apppasswords";
    }
    return { sent: false, reason };
  }
}

async function sendComplaintSms({ to, name, issueType, replyMessage }) {
  if (!twilioClient || !to) {
    return { sent: false, reason: "SMS not configured or missing phone" };
  }

  const phone = normalizePhone(to);
  if (!phone) {
    return { sent: false, reason: "Invalid phone number" };
  }

  const body = `Hi ${name || "there"}, Smart Luggage support replied to your ${issueType} report: ${replyMessage}`;

  await twilioClient.messages.create({
    body: body.slice(0, 1500),
    from: process.env.TWILIO_PHONE,
    to: phone,
  });

  console.log(`[Notify] SMS sent to ${phone}`);
  return { sent: true };
}

module.exports = {
  sendComplaintEmail,
  sendComplaintSms,
  isEmailConfigured,
  logEmailConfigStatus,
};
