import db from "../db.js";

export async function getProfile(req, res) {
  try {
    const userId = req.user.userId; // from JWT middleware
    const result = await db.query(
      "SELECT id, name, email, role, created_at FROM users WHERE id = $1",
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Get profile error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
