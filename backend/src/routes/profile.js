import express from "express";
import { getProfile } from "../controllers/profileController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/profile", authenticateToken, getProfile);

export default router;
