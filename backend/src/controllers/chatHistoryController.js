// src/controllers/chatHistoryController.js
import db from "../db.js";

/**
 * GET /api/chat/history
 * Returns the user's most recent chat session (if any) and its messages.
 * Requires authenticateToken middleware to set req.user.userId.
 */
export async function getChatHistory(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    // 1) Find latest session for this user
    const s = await db.query(
      `SELECT id FROM chat_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );

    if (s.rowCount === 0) {
      // no previous session
      return res.json({ sessionId: null, messages: [] });
    }

    const sessionId = s.rows[0].id;

    // 2) Fetch all messages for that session in chronological order
    const m = await db.query(
      `SELECT sender, text, created_at FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );

    return res.json({
      sessionId,
      messages: m.rows, // array of { sender, text, created_at }
    });
  } catch (err) {
    console.error("getChatHistory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
