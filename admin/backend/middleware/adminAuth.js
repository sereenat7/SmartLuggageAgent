const jwt = require("jsonwebtoken");

function verifyAdminToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const token = header.split(" ")[1];

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ success: false, message: "Server misconfiguration" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.type !== "admin") {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    req.admin = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };

    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

module.exports = { verifyAdminToken };
