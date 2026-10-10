const jwt = require("jsonwebtoken");
const env = require("../config/env");

function readToken(req) {
  const header = req.header("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

// Requires a valid JWT; sets req.user = { id, guest }.
function auth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = { id: decoded.id, guest: Boolean(decoded.guest) };
    return next();
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
}

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), guest: Boolean(user.isGuest) },
    env.jwtSecret,
    { expiresIn: user.isGuest ? env.guestJwtExpiresIn : env.jwtExpiresIn }
  );
}

module.exports = auth;
module.exports.auth = auth;
module.exports.signToken = signToken;
