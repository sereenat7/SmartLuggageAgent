const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { verifyAdminToken } = require("./middleware/adminAuth");

const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const bookingsRoutes = require("./routes/bookingsRoutes");
const paymentsRoutes = require("./routes/paymentsRoutes");
const agentsRoutes = require("./routes/agentsRoutes");
const complaintsRoutes = require("./routes/complaintsRoutes");
const reviewsRoutes = require("./routes/reviewsRoutes");
const mailboxRoutes = require("./routes/mailboxRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "smart-luggage-admin-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/admin", authRoutes);
app.use("/api/users", verifyAdminToken, usersRoutes);
app.use("/api/admin/bookings", verifyAdminToken, bookingsRoutes);
app.use("/api/admin/payments", verifyAdminToken, paymentsRoutes);
app.use("/api/admin/agents", verifyAdminToken, agentsRoutes);
app.use("/api/admin/dashboard", verifyAdminToken, dashboardRoutes);
app.use("/api/complaints", verifyAdminToken, complaintsRoutes);
app.use("/api/reviews", verifyAdminToken, reviewsRoutes);
app.use("/api/mailbox", verifyAdminToken, mailboxRoutes);

app.use((err, req, res, next) => {
  console.error("Admin API error:", err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

module.exports = app;
