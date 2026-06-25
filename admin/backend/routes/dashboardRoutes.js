const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { resolveCanonicalStatus } = require("../utils/bookingStatus");

const STATUS_GROUPS = [
  { key: "completed", label: "Completed", color: "#22c55e" },
  { key: "in_progress", label: "In Progress", color: "#f97316" },
  { key: "confirmed", label: "Confirmed", color: "#8b5cf6" },
  { key: "on_the_way", label: "On the Way", color: "#eab308" },
  { key: "cancelled", label: "Cancelled", color: "#ef4444" },
];

function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows?.[0] || {});
    });
  });
}

function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function calcTrend(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;

  if (cur === 0 && prev === 0) return null;
  if (prev === 0) return { value: "+100%", up: true };

  const change = ((cur - prev) / prev) * 100;
  const up = change >= 0;
  const formatted = `${up ? "+" : ""}${change.toFixed(1)}%`;
  return { value: formatted, up };
}

function buildMonthlyTrend(rows) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const months = [];

  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
      month: monthNames[date.getMonth()],
      bookings: 0,
    });
  }

  const lookup = new Map(
    rows.map((row) => [`${row.year}-${row.month_num}`, Number(row.bookings) || 0])
  );

  return months.map((entry) => {
    const [year, month] = entry.key.split("-").map(Number);
    return {
      month: entry.month,
      bookings: lookup.get(`${year}-${month}`) ?? 0,
    };
  });
}

function buildMonthlyRevenue(rows) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const months = [];

  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
      month: monthNames[date.getMonth()],
      revenue: 0,
    });
  }

  const lookup = new Map(
    rows.map((row) => [`${row.year}-${row.month_num}`, Number(row.revenue) || 0])
  );

  return months.map((entry) => {
    const [year, month] = entry.key.split("-").map(Number);
    return {
      month: entry.month,
      revenue: lookup.get(`${year}-${month}`) ?? 0,
    };
  });
}

function buildStatusDistribution(rows) {
  const counts = Object.fromEntries(STATUS_GROUPS.map((group) => [group.key, 0]));

  rows.forEach((row) => {
    const canonical = resolveCanonicalStatus(row.status);
    const count = Number(row.count) || 0;

    if (canonical === "agent_assigned") {
      counts.confirmed += count;
      return;
    }

    if (counts[canonical] !== undefined) {
      counts[canonical] += count;
    }
  });

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return STATUS_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    color: group.color,
    count: counts[group.key],
    percent: total > 0 ? Math.round((counts[group.key] / total) * 100) : 0,
  }));
}

router.get("/stats", async (req, res) => {
  try {
    const [
      usersRow,
      usersRecentRow,
      usersPrevRow,
      agentsRow,
      agentsRecentRow,
      agentsPrevRow,
      activeBookingsRow,
      activeRecentRow,
      activePrevRow,
      completedRow,
      completedRecentRow,
      completedPrevRow,
      revenueRow,
      revenueRecentRow,
      revenuePrevRow,
      complaintsRow,
      complaintsRecentRow,
      complaintsPrevRow,
      trendRows,
      statusRows,
      revenueTrendRows,
    ] = await Promise.all([
      queryOne("SELECT COUNT(*) AS total FROM users"),
      queryOne(
        `SELECT COUNT(*) AS total FROM users
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM users
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
           AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM support_agents a
         WHERE LOWER(TRIM(COALESCE(a.name, ''))) NOT IN ('', 'agent')
            OR EXISTS (
              SELECT 1 FROM bookings b WHERE b.assigned_agent_id = a.agent_id LIMIT 1
            )`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM support_agents a
         WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           AND (
             LOWER(TRIM(COALESCE(a.name, ''))) NOT IN ('', 'agent')
             OR EXISTS (
               SELECT 1 FROM bookings b WHERE b.assigned_agent_id = a.agent_id LIMIT 1
             )
           )`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM support_agents a
         WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
           AND a.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
           AND (
             LOWER(TRIM(COALESCE(a.name, ''))) NOT IN ('', 'agent')
             OR EXISTS (
               SELECT 1 FROM bookings b WHERE b.assigned_agent_id = a.agent_id LIMIT 1
             )
           )`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM bookings
         WHERE LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'completed')`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM bookings
         WHERE LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'completed')
           AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM bookings
         WHERE LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'completed')
           AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
           AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM bookings
         WHERE LOWER(COALESCE(status, '')) IN ('completed', 'delivered')`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM bookings
         WHERE LOWER(COALESCE(status, '')) IN ('completed', 'delivered')
           AND COALESCE(delivered_at, created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM bookings
         WHERE LOWER(COALESCE(status, '')) IN ('completed', 'delivered')
           AND COALESCE(delivered_at, created_at) >= DATE_SUB(NOW(), INTERVAL 60 DAY)
           AND COALESCE(delivered_at, created_at) < DATE_SUB(NOW(), INTERVAL 30 DAY)`
      ),
      queryOne(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM bookings
         WHERE (
           LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid', 'success', 'captured')
           OR razorpay_payment_id IS NOT NULL
         )`
      ),
      queryOne(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM bookings
         WHERE (
           LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid', 'success', 'captured')
           OR razorpay_payment_id IS NOT NULL
         )
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      ),
      queryOne(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM bookings
         WHERE (
           LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid', 'success', 'captured')
           OR razorpay_payment_id IS NOT NULL
         )
         AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
         AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
      ),
      queryOne(`SELECT COUNT(*) AS total FROM complaints WHERE status = 'Open'`),
      queryOne(
        `SELECT COUNT(*) AS total FROM complaints
         WHERE status = 'Open' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      ),
      queryOne(
        `SELECT COUNT(*) AS total FROM complaints
         WHERE status = 'Open'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
           AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
      ),
      queryAll(
        `SELECT
           YEAR(created_at) AS year,
           MONTH(created_at) AS month_num,
           COUNT(*) AS bookings
         FROM bookings
         WHERE created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 11 MONTH)
         GROUP BY YEAR(created_at), MONTH(created_at)
         ORDER BY YEAR(created_at), MONTH(created_at)`
      ),
      queryAll(
        `SELECT status, COUNT(*) AS count
         FROM bookings
         GROUP BY status`
      ),
      queryAll(
        `SELECT
           YEAR(created_at) AS year,
           MONTH(created_at) AS month_num,
           COALESCE(SUM(amount), 0) AS revenue
         FROM bookings
         WHERE (
           LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid', 'success', 'captured')
           OR razorpay_payment_id IS NOT NULL
         )
         AND created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 11 MONTH)
         GROUP BY YEAR(created_at), MONTH(created_at)
         ORDER BY YEAR(created_at), MONTH(created_at)`
      ),
    ]);

    const stats = {
      totalUsers: Number(usersRow.total) || 0,
      totalAgents: Number(agentsRow.total) || 0,
      activeBookings: Number(activeBookingsRow.total) || 0,
      completedDeliveries: Number(completedRow.total) || 0,
      totalRevenue: Number(revenueRow.total) || 0,
      pendingComplaints: Number(complaintsRow.total) || 0,
      trends: {
        totalUsers: calcTrend(usersRecentRow.total, usersPrevRow.total),
        totalAgents: calcTrend(agentsRecentRow.total, agentsPrevRow.total),
        activeBookings: calcTrend(activeRecentRow.total, activePrevRow.total),
        completedDeliveries: calcTrend(completedRecentRow.total, completedPrevRow.total),
        totalRevenue: calcTrend(revenueRecentRow.total, revenuePrevRow.total),
        pendingComplaints: calcTrend(complaintsRecentRow.total, complaintsPrevRow.total),
      },
      bookingTrends: buildMonthlyTrend(trendRows),
      statusDistribution: buildStatusDistribution(statusRows),
      revenueOverview: buildMonthlyRevenue(revenueTrendRows),
    };

    return res.json({ success: true, stats });
  } catch (error) {
    console.error("[Dashboard] Failed to load stats:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load dashboard stats" });
  }
});

module.exports = router;
