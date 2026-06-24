import jwt from "jsonwebtoken";

export function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), mobile: user.mobile },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "Missing Authorization header" });

  try {
    const payload = jwt.verify(m[1], process.env.JWT_SECRET);
    req.user = { id: Number(payload.sub), mobile: payload.mobile };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

