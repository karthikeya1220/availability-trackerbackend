import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.id || !decoded.email || !decoded.role) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Attach user info to request
    req.userId = user.id;
    req.userRole = user.role;
    req.userEmail = user.email;

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid or expired token" });
  }
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
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.id && decoded.email && decoded.role) {
      // Verify user exists in database
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, role: true },
      });

      if (user) {
        req.userId = user.id;
        req.userRole = user.role;
        req.userEmail = user.email;
      }
    }
  } catch {
    // Silently ignore auth errors for optional auth
  }

  next();
}