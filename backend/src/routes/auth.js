// backend/src/routes/auth.js
import express from "express";
import passport from "passport";
import {
  register,
  verifyLink,
  resendVerification,
  login,
  googleCallback,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
const router = express.Router();

// Traditional email/password authentication
router.post("/register", register);
router.post("/verify-link", verifyLink); // supports POST body {token,email}
router.get("/verify-link", verifyLink); // supports GET link
router.post("/resend-verification", resendVerification);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Google OAuth 2.0 authentication
// Initiate Google OAuth flow
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false, // We use JWT, not sessions
  })
);

// Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=oauth_failed`,
  }),
  googleCallback
);

export default router;

