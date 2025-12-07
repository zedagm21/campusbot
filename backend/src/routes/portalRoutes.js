import express from "express";
import { getRegistrationSummary, disconnectPortal } from "../controllers/portalController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// router.post("/grades", getStudentGrades);
router.post("/registration-summary", getRegistrationSummary);
router.post("/disconnect", authenticateToken, disconnectPortal);

export default router;


