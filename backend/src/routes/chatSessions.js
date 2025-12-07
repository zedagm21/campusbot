import express from "express";
import {
  listSessions,
  getSessionMessages,
  deleteSession,
  updateSessionTitle, // 👈 import the new function
} from "../controllers/chatSessionsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authenticateToken, listSessions);
router.get("/:id", authenticateToken, getSessionMessages);
router.delete("/:id", authenticateToken, deleteSession);
router.patch("/:id", authenticateToken, updateSessionTitle); // 👈 new route

export default router;
