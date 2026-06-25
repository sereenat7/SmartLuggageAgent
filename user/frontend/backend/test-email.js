/**
 * Quick email test — run from backend folder:
 *   node test-email.js recipient@example.com
 */
require("dotenv").config();
const { sendComplaintEmail, isEmailConfigured } = require("./utils/notify");

const to = process.argv[2];

if (!to) {
  console.error("Usage: node test-email.js recipient@example.com");
  process.exit(1);
}

if (!isEmailConfigured()) {
  console.error("Email not configured. Set SMTP_USER + SMTP_PASS or RESEND_API_KEY in .env");
  process.exit(1);
}

sendComplaintEmail({
  to,
  name: "Test User",
  issueType: "Test issue",
  replyMessage: "This is a test reply from Smart Luggage backend.",
})
  .then((result) => {
    if (result.sent) {
      console.log("✅ Test email sent successfully to", to);
      process.exit(0);
    }
    console.error("❌ Email failed:", result.reason);
    process.exit(1);
  })
  .catch((error) => {
    console.error("❌ Email error:", error.message);
    process.exit(1);
  });
