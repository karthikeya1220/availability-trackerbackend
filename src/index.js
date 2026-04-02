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

const allowedOrigins = [
  "https://availabilitytrackerfrontend.vercel.app",
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

app.use("/api/auth", (req, res, next) => {
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