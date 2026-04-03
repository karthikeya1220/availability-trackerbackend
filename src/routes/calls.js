import { Router } from "express";
import {
  bookCall,
  listCalls,
  getCall,
  updateCallStatus,
  deleteCall,
} from "../controllers/callController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const callRoutes = Router();

// All calls routes require authentication
callRoutes.use(authenticate);

// Anyone authenticated can list/view their own calls
callRoutes.get("/", listCalls);
callRoutes.get("/:callId", getCall);

// Only admin can book, update status, or cancel
callRoutes.post("/", requireRole("ADMIN"), bookCall);
callRoutes.patch("/:callId/status", requireRole("ADMIN"), updateCallStatus);
callRoutes.delete("/:callId", requireRole("ADMIN"), deleteCall);
