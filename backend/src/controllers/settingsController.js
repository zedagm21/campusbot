// backend/src/controllers/settingsController.js
import db from "../db.js";
import PortalLoginService from "../services/PortalLoginService.js";
import { encrypt, decrypt } from "../utils/encryption.js";

/**
 * POST /api/settings/portal
 * Save portal credentials (username + password)
 */
export async function savePortalCredentials(req, res) {
    const userId = req.user?.userId;
    const { username, password } = req.body;

    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }

    try {
        // Test login to verify credentials are valid
        const loginRes = await PortalLoginService.loginToPortal(username, password);

        if (!loginRes.success) {
            return res.status(400).json({
                error: "Invalid portal credentials",
                details: loginRes.error
            });
        }

        // Encrypt password before storing
        const encryptedPass = encrypt(password);

        // Store credentials and cookies
        await db.query(
            `UPDATE users 
       SET portal_username = $1, 
           portal_password_encrypted = $2, 
           portal_cookies = $3 
       WHERE id = $4`,
            [username, encryptedPass, JSON.stringify(loginRes.cookies), userId]
        );

        return res.json({
            success: true,
            message: "Portal credentials saved successfully",
            username
        });
    } catch (err) {
        console.error("Save portal credentials error:", err);
        return res.status(500).json({ error: "Failed to save credentials" });
    }
}

/**
 * GET /api/settings/portal/status
 * Get portal connection status
 */
export async function getPortalStatus(req, res) {
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    try {
        const result = await db.query(
            `SELECT portal_username, portal_password_encrypted, portal_cookies FROM users WHERE id = $1`,
            [userId]
        );

        const user = result.rows[0];
        const isConnected = !!(user?.portal_username && user?.portal_password_encrypted);

        return res.json({
            connected: isConnected,
            username: user?.portal_username || null,
            // Note: We never return the password or encrypted password
        });
    } catch (err) {
        console.error("Get portal status error:", err);
        return res.status(500).json({ error: "Failed to get status" });
    }
}

/**
 * DELETE /api/settings/portal
 * Remove portal credentials
 */
export async function removePortalCredentials(req, res) {
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    try {
        await db.query(
            `UPDATE users 
       SET portal_username = NULL, 
           portal_password_encrypted = NULL, 
           portal_cookies = NULL 
       WHERE id = $1`,
            [userId]
        );

        return res.json({
            success: true,
            message: "Portal credentials removed"
        });
    } catch (err) {
        console.error("Remove portal credentials error:", err);
        return res.status(500).json({ error: "Failed to remove credentials" });
    }
}
