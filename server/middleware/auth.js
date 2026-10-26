const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");

function readToken(req) {
  const header = req.header("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

// A signed token is not enough: the account may have been deleted or expired.
async function auth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
  try {
    const user = await User.findById(decoded.id).select("isGuest guestExpiresAt").lean();
    if (!user || Boolean(user.isGuest) !== Boolean(decoded.guest) ||
        (user.isGuest && (!user.guestExpiresAt || user.guestExpiresAt <= new Date()))) {
      return res.status(401).json({ message: "Your session has expired. Please sign in again." });
    }
    req.user = { id: decoded.id, guest: Boolean(decoded.guest) };
    return next();
  } catch (err) {
    return next(err);
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
