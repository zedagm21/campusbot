// src/routes/chatHistory.js
import express from "express";
import { getChatHistory } from "../controllers/chatHistoryController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/chat/history -> returns last session and messages for current user
router.get("/", authenticateToken, getChatHistory);

export default router;
