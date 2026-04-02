import { Router } from "express";
import { listCalls, deleteCall } from "../controllers/callsController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const callsRoutes = Router();

callsRoutes.use(authenticate);
callsRoutes.get("/", listCalls);
callsRoutes.delete("/:id", requireRole("ADMIN"), deleteCall);
