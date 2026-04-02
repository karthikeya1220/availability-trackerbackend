import { Router } from "express";
import { getWeekly, saveBatch, findOverlaps } from "../controllers/availabilityController.js";
import { authenticate } from "../middleware/auth.js";

export const availabilityRoutes = Router();

availabilityRoutes.use(authenticate);
availabilityRoutes.get("/", getWeekly);
availabilityRoutes.post("/", saveBatch);
availabilityRoutes.get("/overlaps", findOverlaps);
