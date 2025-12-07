import PortalLoginService from "../services/PortalLoginService.js";
import axios from "axios";
import db from "../db.js";

export const getRegistrationSummary = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Portal username and password are required" });
    }

    // 1) Login to the portal
    const loginResult = await PortalLoginService.loginToPortal(
      username,
      password
    );

    if (!loginResult.success) {
      return res.status(401).json({ message: loginResult.error });
    }

    const cookies = loginResult.cookies;

    // 2) Fetch portal data
    const response = await axios.get(
      "https://studentportal.bdu.edu.et/RegistrationSummary/GetStudentRegistration?studentCurriculumCode=306932",
      {
        headers: {
          Cookie: cookies.join("; "),
        },
      }
    );

    return res.json(response.data);
  } catch (error) {
    console.error("Portal fetch error:", error.message);
    return res
      .status(500)
      .json({ message: "Failed to fetch data from BDU portal" });
  }
};

export const getStudentGrades = async (req, res) => {
  // MOCK IMPLEMENTATION
  // In a real scenario, this would use PortalLoginService to fetch grades
  return res.json({
    cgpa: "3.75",
    semester_gpa: "3.82",
    academic_status: "Promoted",
    student_name: "Mock Student",
  });
};

/**
 * POST /api/portal/disconnect
 * Clear portal credentials from user account
 */
export async function disconnectPortal(req, res) {
  try {
    const userId = req.user.userId;

    console.log(`[PORTAL] Disconnecting portal for user ID: ${userId}`);

    // Clear portal credentials
    await db.query(
      `UPDATE users 
       SET portal_username = NULL, 
           portal_password_encrypted = NULL, 
           portal_cookies = NULL 
       WHERE id = $1`,
      [userId]
    );

    console.log(`[PORTAL] Portal credentials cleared for user ID: ${userId}`);

    return res.json({
      message: "Portal account disconnected successfully",
      status: "disconnected"
    });
  } catch (error) {
    console.error("[PORTAL] Disconnect error:", error);
    return res.status(500).json({ error: "Failed to disconnect portal account" });
  }
}

