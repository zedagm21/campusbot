// backend/src/routes/settingsRoutes.js
import express from "express";
import {
    savePortalCredentials,
    getPortalStatus,
    removePortalCredentials
} from "../controllers/settingsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// All settings routes require authentication
router.use(authenticateToken);

// Save portal credentials
router.post("/portal", savePortalCredentials);

// Get portal connection status
router.get("/portal/status", getPortalStatus);

// Remove portal credentials
router.delete("/portal", removePortalCredentials);

export default router;
