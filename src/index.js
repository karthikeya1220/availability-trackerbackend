import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRoutes } from "./routes/auth.js";
import { availabilityRoutes } from "./routes/availability.js";
import { callsRoutes } from "./routes/calls.js";
import { adminRoutes } from "./routes/admin.js";
import bookingRoutes from "./routes/booking.js";
import recommendationRoutes from "./routes/recommendation.js";
import adminSchedulingRoutes from "./routes/adminScheduling.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 5001;

// Build allowed origins from environment and defaults
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://availabilitytrackerfrontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

// Remove duplicates
const uniqueOrigins = [...new Set(allowedOrigins)];

console.log("✅ CORS Allowed Origins:", uniqueOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);
      
      if (uniqueOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "Expires"],
    exposedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 hours
  })
);
app.use(express.json());
app.use(cookieParser());

// Cache control middleware for auth routes (apply BEFORE response is sent)
app.use("/api/auth", (req, res, next) => {
  // Set cache headers immediately, before route handlers send response
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/calls", callsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/schedule", adminSchedulingRoutes);
app.use("/api/recommendations", recommendationRoutes);

app.get("/health", (_, res) => res.json({ ok: true }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});