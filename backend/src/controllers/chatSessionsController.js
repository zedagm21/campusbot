// src/controllers/chatSessionsController.js
import db from "../db.js";

/**
 * GET /api/chat/sessions
 * Returns a list of sessions for the current user ordered by most recent message.
 */
export async function listSessions(req, res) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const q = `
      SELECT 
        s.id,
        s.started_at,
        s.title,
        (SELECT text FROM messages m WHERE m.session_id = s.id ORDER BY created_at DESC LIMIT 1) AS preview,
        (SELECT MAX(created_at) FROM messages m WHERE m.session_id = s.id) AS last_message_at
      FROM chat_sessions s
      WHERE s.user_id = $1
      ORDER BY COALESCE(
        (SELECT MAX(created_at) FROM messages m WHERE m.session_id = s.id),
        s.started_at
      ) DESC
      LIMIT 200
    `;
    const r = await db.query(q, [userId]);

    const sessions = r.rows.map((row) => ({
      id: row.id,
      started_at: row.started_at,
      title: row.title ?? null,
      preview: row.preview ?? null,
      last_message_at: row.last_message_at ?? null,
    }));

    return res.json({ sessions });
  } catch (err) {
    console.error("listSessions error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * GET /api/chat/sessions/:id
 * Returns messages for a given session if it belongs to the user.
 */
export async function getSessionMessages(req, res) {
  const userId = req.user?.userId;
  const sessionId = Number(req.params.id);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  if (!sessionId) return res.status(400).json({ error: "Invalid session id" });

  try {
    const s = await db.query(
      `SELECT id, title FROM chat_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [sessionId, userId]
    );
    if (s.rowCount === 0)
      return res.status(404).json({ error: "Session not found" });

    const m = await db.query(
      `SELECT id, sender, text, created_at 
       FROM messages 
       WHERE session_id = $1 
       ORDER BY created_at ASC`,
      [sessionId]
    );

    return res.json({
      sessionId,
      sessionTitle: s.rows[0].title ?? null,
      messages: m.rows,
    });
  } catch (err) {
    console.error("getSessionMessages error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * DELETE /api/chat/sessions/:id
 * Deletes a chat session and all its related messages.
 */
export async function deleteSession(req, res) {
  const userId = req.user?.userId;
  const sessionId = Number(req.params.id);

  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  if (!sessionId) return res.status(400).json({ error: "Invalid session id" });

  try {
    const session = await db.query(
      `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    if (session.rowCount === 0)
      return res.status(404).json({ error: "Session not found" });

    await db.query(`DELETE FROM messages WHERE session_id = $1`, [sessionId]);
    await db.query(`DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2`, [
      sessionId,
      userId,
    ]);

    return res.json({ message: "Chat session deleted successfully" });
  } catch (err) {
    console.error("deleteSession error:", err);
    return res.status(500).json({ error: "Failed to delete chat session" });
  }
}

/**
 * PUT /api/chat/sessions/:id/title
 * Updates a chat session title.
 */
export async function updateSessionTitle(req, res) {
  const userId = req.user?.userId;
  const sessionId = Number(req.params.id);
  const { title } = req.body;

  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  if (!sessionId) return res.status(400).json({ error: "Invalid session id" });
  if (!title || title.trim() === "")
    return res.status(400).json({ error: "Title cannot be empty" });

  try {
    const s = await db.query(
      `UPDATE chat_sessions
       SET title = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, title`,
      [title.trim(), sessionId, userId]
    );

    if (s.rowCount === 0)
      return res.status(404).json({ error: "Session not found" });

    return res.json({
      message: "Title updated successfully",
      session: s.rows[0],
    });
  } catch (err) {
    console.error("updateSessionTitle error:", err);
    return res.status(500).json({ error: "Failed to update title" });
  }
}
