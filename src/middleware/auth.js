import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");
const MAIN_SITE_JWT_SECRET = process.env.MAIN_SITE_JWT_SECRET;

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  let decoded = null;

  // Try own secret first
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    // Try main site secret as fallback (if configured)
    try {
      decoded = jwt.verify(token, MAIN_SITE_JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  }

  // Handle both payload formats
  const userId = decoded.userId || decoded.id;
  const userRole = decoded.role || (decoded.isAdmin ? "ADMIN" : "MENTOR");

  req.userId = userId;
  req.userRole = userRole;

  // Ensure user exists locally for FK constraints (e.g. Meeting.adminId)
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: userId,
        email: decoded.email || `${userId}@sso.mentorque.com`,
        name: decoded.name || decoded.email || "SSO User",
        role: userRole,
        password: "SSO_USER_NO_PASSWORD",
      },
    });
  }

  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.token;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
  } catch {
    // ignore
  }
  next();
}

