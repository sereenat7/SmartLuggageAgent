const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const adminModel = require("../models/adminModel");

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ success: false, message: "Server misconfiguration" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const admin = await adminModel.findByEmail(normalizedEmail);

    if (!admin) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        type: "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("[AdminAuth] Login failed:", error.message);
    return res.status(500).json({ success: false, message: "Authentication failed" });
  }
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const adminId = req.admin?.id;

  if (!adminId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Current password and new password are required",
    });
  }

  if (String(newPassword).length < 8) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 8 characters",
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "New password must be different from current password",
    });
  }

  try {
    const admin = await adminModel.findById(adminId);

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin account not found" });
    }

    const match = await bcrypt.compare(currentPassword, admin.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await adminModel.updatePassword(adminId, hash);

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("[AdminAuth] Change password failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update password" });
  }
}

module.exports = { login, changePassword };
