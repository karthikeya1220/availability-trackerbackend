import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRoutes } from "./routes/auth.js";
import { availabilityRoutes } from "./routes/availability.js";
import { meetingRoutes } from "./routes/meeting.js";
import { adminRoutes } from "./routes/admin.js";
import { callRoutes } from "./routes/calls.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 5001;

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Prevent caching on auth responses
app.use("/api/auth", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/calls", callRoutes);

app.get("/health", (_, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});