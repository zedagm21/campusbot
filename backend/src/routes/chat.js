// src/routes/chat.js
import express from "express";
import { handleChat } from "../controllers/chatController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Protected chat endpoint
router.post("/", authenticateToken, handleChat);

export default router;
