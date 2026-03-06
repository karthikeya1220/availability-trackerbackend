import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRoutes } from "./routes/auth.js";
import { availabilityRoutes } from "./routes/availability.js";
import { meetingRoutes } from "./routes/meeting.js";
import { adminRoutes } from "./routes/admin.js";
import { googleRouter } from "./routes/google.routes.js";
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

// Google OAuth (init + callback) lives under /api/auth: GET /api/auth/google, GET /api/auth/google/callback
app.use("/api/auth", authRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/google", googleRouter); // legacy in-memory flow; prefer /api/auth/google for DB-stored token

app.get("/health", (_, res) => res.json({ ok: true }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
