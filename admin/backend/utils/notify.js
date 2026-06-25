const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function getSmtpCredentials() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim()?.replace(/\s/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

function getFromAddress() {
  const smtpUser = process.env.SMTP_USER?.trim();
  const configuredFrom = process.env.SMTP_FROM?.trim();
  if (configuredFrom && !configuredFrom.includes("your-email")) {
    return configuredFrom;
  }
  if (smtpUser) return `"Smart Luggage Support" <${smtpUser}>`;
  return "Smart Luggage Support <onboarding@resend.dev>";
}

function getMailTransport() {
  const credentials = getSmtpCredentials();
  if (!credentials) return null;
  return nodemailer.createTransport({ service: "gmail", auth: credentials });
}

function isEmailConfigured() {
  return Boolean(getSmtpCredentials() || process.env.RESEND_API_KEY?.trim());
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

  return { sent: true, provider: "smtp" };
}

async function sendComplaintEmail({ to, name, issueType, replyMessage }) {
  if (!to?.trim()) {
    return { sent: false, reason: "Missing customer email" };
  }

  if (!isEmailConfigured()) {
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
    return { sent: false, reason: error.message };
  }
}

module.exports = {
  sendComplaintEmail,
  isEmailConfigured,
};
