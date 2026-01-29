const jwt = require("jsonwebtoken");

function signToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role_name: user.role_name,
    area: user.area
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "2h"
  });

  return token;
}

function requireAuth(req, res, next) {
  const cookieHeader = String(req.headers.cookie || "");
  const token = req.cookies ? req.cookies.token : undefined;

  console.log("---- requireAuth ----");
  console.log("time:", new Date().toISOString());
  console.log("path:", req.method, req.originalUrl);
  console.log("host:", req.headers.host);
  console.log("origin:", req.headers.origin);
  console.log("referer:", req.headers.referer);
  console.log("cookie header has token=:", cookieHeader.includes("token="));
  console.log("cookie keys:", Object.keys(req.cookies || {}));
  console.log("token present:", Boolean(token));
  console.log("token prefix:", token ? String(token).slice(0, 20) + "..." : "(none)");

  if (!token) {
    console.log("AUTH FAIL: no token cookie");
    res.status(401).json({ message: "Not authenticated." });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("AUTH OK:", {
      id: decoded.id,
      username: decoded.username,
      role_name: decoded.role_name,
      area: decoded.area,
      iat: decoded.iat,
      exp: decoded.exp,
    });

    req.user = decoded;
    next();
  } catch (err) {
    console.log("AUTH FAIL: jwt.verify error:", err && err.name, err && err.message);
    res.status(401).json({ message: "Invalid token." });
  } finally {
    console.log("---------------------");
  }
}

function requireRole(roleName) {
  return function (req, res, next) {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated." });
      return;
    }

    if (req.user.role_name !== roleName) {
      res.status(403).json({ message: "Forbidden." });
      return;
    }

    next();
  };
}

module.exports = {
  signToken,
  requireAuth,
  requireRole
};
