import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");
// Must match Mentorque platform JWT_SECRET (used for sso-token and admin/mentor JWTs)
const MAIN_SITE_JWT_SECRET =
  process.env.MAIN_SITE_JWT_SECRET || "your-secret-key-change-in-production";

function getDecodedToken(token) {
  const isPlatformShape = (() => {
    try {
      const payload = jwt.decode(token);
      return payload && typeof payload === "object" && "id" in payload && !("userId" in payload);
    } catch {
      return false;
    }
  })();
  if (isPlatformShape && MAIN_SITE_JWT_SECRET) {
    try {
      return jwt.verify(token, MAIN_SITE_JWT_SECRET);
    } catch {
      try {
        return jwt.verify(token, JWT_SECRET);
      } catch {
        return null;
      }
    }
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    if (MAIN_SITE_JWT_SECRET) {
      try {
        return jwt.verify(token, MAIN_SITE_JWT_SECRET);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function roleFromDecoded(decoded) {
  if (decoded.role === "USER" || decoded.role === "MENTOR" || decoded.role === "ADMIN") {
    return decoded.role;
  }
  return decoded.isAdmin ? "ADMIN" : "MENTOR";
}

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const decoded = getDecodedToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const email = (decoded.email || "").trim().toLowerCase();
  const role = roleFromDecoded(decoded);
  const idFromToken = decoded.userId || decoded.id;

  if (!email) {
    return res.status(401).json({ error: "Invalid token: missing email" });
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    if (user.role !== role) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
    }
  } else {
    user = await prisma.user.create({
      data: {
        id: idFromToken,
        email,
        name: decoded.name || decoded.email || "SSO User",
        role,
        password: "SSO_USER_NO_PASSWORD",
      },
    });
  }

  req.userId = user.id;
  req.userRole = user.role;
  req.userEmail = user.email;

  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res
        .status(403)
        .json({
          error: "Insufficient permissions",
          message: `This action requires one of: ${roles.join(", ")}. Your role: ${req.userRole || "none"}.`,
        });
    }
    next();
  };
}

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.token;
  if (!token) return next();
  try {
    const decoded = getDecodedToken(token);
    if (!decoded) return next();
    const email = (decoded.email || "").trim().toLowerCase();
    if (!email) return next();
    const role = roleFromDecoded(decoded);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.role === role) {
      req.userId = user.id;
      req.userRole = user.role;
      req.userEmail = user.email;
    } else if (!user) {
      const idFromToken = decoded.userId || decoded.id;
      const newUser = await prisma.user.create({
        data: {
          id: idFromToken,
          email,
          name: decoded.name || decoded.email || "SSO User",
          role,
          password: "SSO_USER_NO_PASSWORD",
        },
      });
      req.userId = newUser.id;
      req.userRole = newUser.role;
      req.userEmail = newUser.email;
    } else {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
      req.userId = updated.id;
      req.userRole = updated.role;
      req.userEmail = updated.email;
    }
  } catch {
    // ignore
  }
  next();
}

