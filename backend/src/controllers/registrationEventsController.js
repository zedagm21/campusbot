// src/controllers/registrationEventsController.js
import db from "../db.js";

/**
 * GET /api/admin/registration-events
 * Query params: optional ?q=search
 */
export async function listEvents(req, res) {
  const q = (req.query.q || "").trim();
  try {
    if (q) {
      const result = await db.query(
        `SELECT * FROM registration_events
         WHERE title ILIKE $1 OR coalesce(description,'') ILIKE $1
         ORDER BY start_at DESC`,
        [`%${q}%`]
      );
      return res.json({ events: result.rows });
    } else {
      const result = await db.query(
        `SELECT * FROM registration_events ORDER BY start_at DESC LIMIT 200`
      );
      return res.json({ events: result.rows });
    }
  } catch (err) {
    console.error("listEvents error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function getEvent(req, res) {
  const id = Number(req.params.id);
  try {
    const result = await db.query(
      `SELECT * FROM registration_events WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Not found" });
    return res.json({ event: result.rows[0] });
  } catch (err) {
    console.error("getEvent error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function createEvent(req, res) {
  const { title, description, start_at, end_at, location } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO registration_events
       (title, description, start_at, end_at, location, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        title,
        description || null,
        start_at || null,
        end_at || null,
        location || null,
        req.user?.userId || null,
      ]
    );
    return res.status(201).json({ event: result.rows[0] });
  } catch (err) {
    console.error("createEvent error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function updateEvent(req, res) {
  const id = Number(req.params.id);
  const { title, description, start_at, end_at, location } = req.body;
  try {
    const result = await db.query(
      `UPDATE registration_events
       SET title = $1, description = $2, start_at = $3, end_at = $4, location = $5
       WHERE id = $6
       RETURNING *`,
      [
        title,
        description || null,
        start_at || null,
        end_at || null,
        location || null,
        id,
      ]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Not found" });
    return res.json({ event: result.rows[0] });
  } catch (err) {
    console.error("updateEvent error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function deleteEvent(req, res) {
  const id = Number(req.params.id);
  try {
    const result = await db.query(
      `DELETE FROM registration_events WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Not found" });
    return res.json({ deleted: result.rows[0].id });
  } catch (err) {
    console.error("deleteEvent error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
