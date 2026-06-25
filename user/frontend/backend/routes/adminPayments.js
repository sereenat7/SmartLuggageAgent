const express = require("express");
const router = express.Router();
const db = require("../db");

const AVATAR_COLORS = [
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#38bdf8",
  "#4ade80",
  "#f87171",
  "#fbbf24",
  "#c084fc",
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

function formatBookingId(id) {
  return `LUG-${String(id).padStart(4, "0")}`;
}

function formatPaymentId(id) {
  return `PAY-${String(id).padStart(4, "0")}`;
}

function formatPaymentDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMethod(method) {
  const value = String(method || "").trim().toLowerCase();
  if (!value) return "Razorpay";
  if (value === "upi") return "Razorpay UPI";
  if (value === "card") return "Card";
  if (value === "netbanking") return "Net Banking";
  if (value === "wallet") return "Wallet";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function mapPaymentStatus(row) {
  const refund = Number(row.refund_amount || 0);
  const status = String(row.payment_status || "").trim().toLowerCase();

  if (refund > 0 || status === "refunded") return "Refunded";
  if (["completed", "paid", "success", "captured"].includes(status)) return "Success";
  if (["failed", "failure"].includes(status)) return "Failed";
  return "Pending";
}

function formatSummaryAmount(total) {
  const value = Number(total) || 0;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function wasPaymentCompleted(row) {
  const paymentStatus = String(row.payment_status || "").trim().toLowerCase();
  return (
    ["completed", "paid", "success", "captured"].includes(paymentStatus) ||
    Boolean(row.razorpay_payment_id)
  );
}

function mapPaymentRow(row) {
  const customerName = row.customer_name || row.username || "Customer";
  const amount = Number(row.amount || 0);
  const status = mapPaymentStatus(row);
  const paidAmount = wasPaymentCompleted(row) ? amount : 0;

  return {
    id: formatPaymentId(row.id),
    paymentId: row.id,
    bookingId: formatBookingId(row.id),
    customer: {
      name: customerName,
      initials: getInitials(customerName),
      color: getAvatarColor(customerName),
    },
    method: formatMethod(row.payment_method),
    amount: status === "Refunded" && row.refund_amount ? Number(row.refund_amount) : paidAmount,
    status,
    date: formatPaymentDate(row.created_at),
    createdAt: row.created_at,
  };
}

function buildSummary(payments) {
  let collected = 0;
  let pending = 0;
  let refunded = 0;
  let failed = 0;

  payments.forEach((payment) => {
    const amount = Number(payment.amount) || 0;
    if (payment.status === "Success") collected += amount;
    else if (payment.status === "Pending") pending += amount;
    else if (payment.status === "Refunded") refunded += amount;
    else if (payment.status === "Failed") failed += amount;
  });

  return {
    collected: formatSummaryAmount(collected),
    pending: formatSummaryAmount(pending),
    refunded: formatSummaryAmount(refunded),
    failed: formatSummaryAmount(failed),
    collectedRaw: collected,
    pendingRaw: pending,
    refundedRaw: refunded,
    failedRaw: failed,
  };
}

const LIST_QUERY = `
  SELECT
    b.id,
    b.username,
    b.phone,
    b.amount,
    b.payment_status,
    b.payment_method,
    b.razorpay_payment_id,
    b.refund_amount,
    b.created_at,
    COALESCE(u.name, b.username) AS customer_name
  FROM bookings b
  LEFT JOIN users u ON REPLACE(REPLACE(REPLACE(u.phone, '+', ''), '-', ''), ' ', '') =
                        REPLACE(REPLACE(REPLACE(b.phone, '+', ''), '-', ''), ' ', '')
  WHERE b.amount IS NOT NULL
     OR b.razorpay_payment_id IS NOT NULL
     OR b.payment_status IS NOT NULL
  ORDER BY b.created_at DESC
  LIMIT 200
`;

router.get("/", (req, res) => {
  db.query(LIST_QUERY, (err, rows) => {
    if (err) {
      console.error("[AdminPayments] Failed to fetch payments:", err.message);
      return res.status(500).json({ success: false, message: "Failed to fetch payments" });
    }

    const payments = (rows || []).map(mapPaymentRow);
    const summary = buildSummary(payments);

    return res.json({
      success: true,
      payments,
      summary,
      count: payments.length,
    });
  });
});

module.exports = router;
