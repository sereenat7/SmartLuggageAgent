const nodemailer = require("nodemailer");
require("dotenv").config();

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
  return smtpUser;
}

function getMailTransport() {
  const credentials = getSmtpCredentials();
  if (!credentials) return null;
  return nodemailer.createTransport({ service: "gmail", auth: credentials });
}

async function sendMailboxEmail({ to, subject, text, html, inReplyTo, references, attachments = [] }) {
  const transport = getMailTransport();
  if (!transport) {
    throw new Error("Email is not configured. Add SMTP_USER and SMTP_PASS in backend .env");
  }

  const mailAttachments = attachments.map((file) => ({
    filename: file.filename,
    content: file.content,
    contentType: file.mimeType,
  }));

  const info = await transport.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html: html || undefined,
    inReplyTo: inReplyTo || undefined,
    references: references || undefined,
    attachments: mailAttachments,
  });

  return info;
}

module.exports = {
  getSmtpCredentials,
  getFromAddress,
  sendMailboxEmail,
  isMailboxConfigured: () => Boolean(getSmtpCredentials()),
};
