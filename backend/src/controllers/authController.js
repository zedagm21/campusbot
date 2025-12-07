// backend/src/controllers/authController.js
import db from "../db.js"; // expects { query, pool }
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendEmail, verifyEmailService } from "../utils/sendEmail.js";
import { validateEmail, isDisposableEmail, isValidEmailFormat } from "../utils/emailValidator.js";

const SALT_ROUNDS = 10;
const TOKEN_TTL_MIN = Number(process.env.TOKEN_TTL_MIN || 60);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/* Helpers */
function genToken() {
  return crypto.randomBytes(32).toString("hex"); // 64 hex chars
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * POST /api/auth/register
 * - Validate input
 * - If user exists -> reject
 * - Hash password and upsert pending_registrations
 * - Create a verification token (store its hash) and email a verification link
 */
export async function register(req, res) {
  const { name, email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Missing email or password" });

  try {
    const lowerEmail = String(email).toLowerCase().trim();

    // SECURITY: Validate email format first
    if (!isValidEmailFormat(lowerEmail)) {
      console.log(`[SECURITY] Invalid email format attempted: ${lowerEmail}`);
      return res.status(400).json({
        error: "Please enter a valid email address."
      });
    }

    // SECURITY: Block disposable/temporary email domains
    if (isDisposableEmail(lowerEmail)) {
      console.log(`[SECURITY] Blocked disposable email registration: ${lowerEmail}`);
      return res.status(400).json({
        error: "Please use a valid, permanent institutional or personal email address to complete registration."
      });
    }

    // SECURITY: Enforce Password Strength
    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long."
      });
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        error: "Password must include uppercase, lowercase, number, and special character."
      });
    }

    // SECURITY: Check if user already exists
    // IMPORTANT: Return generic success message to prevent email enumeration attacks
    const existing = await db.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [lowerEmail]
    );
    if (existing.rowCount > 0) {
      console.log(`[SECURITY] Registration attempt with existing email: ${lowerEmail}`);
      // Return generic success message - DO NOT reveal that email exists
      return res.status(201).json({
        message: "Verification email sent. Check your inbox."
      });
    }

    // Check if pending registration exists
    const pendingCheck = await db.query(
      "SELECT email FROM pending_registrations WHERE email = $1 LIMIT 1",
      [lowerEmail]
    );
    if (pendingCheck.rowCount > 0) {
      console.log(`[SECURITY] Re-registration attempt for pending email: ${lowerEmail}`);
      // Return generic success message - DO NOT reveal pending status
      return res.status(201).json({
        message: "Verification email sent. Check your inbox."
      });
    }

    // 2) Hash the password and create pending registration
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.query(
      `INSERT INTO pending_registrations (email, name, password_hash, created_at)
       VALUES ($1,$2,$3,now())`,
      [lowerEmail, name || null, password_hash]
    );

    // 3) Create verification token, store hashed token in DB
    const token = genToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);

    await db.query(
      `INSERT INTO email_verifications (email, token_hash, expires_at, created_at)
       VALUES ($1,$2,$3,now())`,
      [lowerEmail, tokenHash, expiresAt]
    );

    // 4) Send verification link (frontend will call verify endpoint)
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}&email=${encodeURIComponent(
      lowerEmail
    )}`;
    const body = `Hello,\n\nClick the link below to verify your email and complete account creation:\n\n${verifyUrl}\n\nThis link expires in ${TOKEN_TTL_MIN} minutes.\n\nIf you didn't request this, ignore this message.`;

    // Send email with error handling
    const emailResult = await sendEmail(lowerEmail, "Verify your CampusBot account", body);

    if (!emailResult.success) {
      // Email failed - clean up pending registration to prevent clutter
      console.error(`[AUTH] Registration email failed for ${lowerEmail}:`, emailResult.technicalError);

      // Delete pending registration since email can't be delivered
      await db.query(
        "DELETE FROM pending_registrations WHERE email = $1",
        [lowerEmail]
      );

      return res.status(500).json({
        error: "We were unable to send the verification email. Please check your email address and try again.",
      });
    }

    console.log(`[AUTH] Verification email sent successfully to: ${lowerEmail}`);
    return res
      .status(201)
      .json({ message: "Verification email sent. Check your inbox." });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * GET or POST /api/auth/verify-link
 * - Accepts token+email via query (GET) or body (POST)
 * - Validates token (hash compare), expiry and used flag
 * - In a DB transaction: create users row from pending_registrations, mark token used, delete pending row
 * - Return JWT + user info
 */
export async function verifyLink(req, res) {
  const token = req.method === "GET" ? req.query.token : req.body.token;
  const email = req.method === "GET" ? req.query.email : req.body.email;
  if (!token || !email)
    return res.status(400).json({ error: "Missing token or email" });

  const lowerEmail = String(email).toLowerCase();

  try {
    const tokenHash = hashToken(token);

    // fetch verification record
    const vRes = await db.query(
      `SELECT id, expires_at, used FROM email_verifications
       WHERE email = $1 AND token_hash = $2
       ORDER BY created_at DESC LIMIT 1`,
      [lowerEmail, tokenHash]
    );
    if (vRes.rowCount === 0)
      return res
        .status(400)
        .json({ error: "Invalid or missing verification token" });

    const vRow = vRes.rows[0];
    if (vRow.used) return res.status(400).json({ error: "Token already used" });
    if (new Date() > new Date(vRow.expires_at))
      return res.status(400).json({ error: "Token expired" });

    // fetch pending registration
    const pRes = await db.query(
      "SELECT email, name, password_hash FROM pending_registrations WHERE email = $1 LIMIT 1",
      [lowerEmail]
    );
    if (pRes.rowCount === 0)
      return res.status(400).json({ error: "No pending registration found" });

    const pending = pRes.rows[0];

    // Transaction: create user, mark token used, delete pending registration
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // double-check real user doesn't exist (race protection)
      const userCheck = await client.query(
        "SELECT id FROM users WHERE email = $1 LIMIT 1",
        [lowerEmail]
      );
      if (userCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "User already exists" });
      }

      const insertUser = await client.query(
        `INSERT INTO users (name, email, password_hash, is_verified, created_at)
         VALUES ($1,$2,$3,$4,now()) RETURNING id, name, email, role`,
        [pending.name || null, pending.email, pending.password_hash, true]
      );
      const newUser = insertUser.rows[0];

      await client.query(
        "UPDATE email_verifications SET used = true WHERE id = $1",
        [vRow.id]
      );
      await client.query("DELETE FROM pending_registrations WHERE email = $1", [
        lowerEmail,
      ]);

      await client.query("COMMIT");

      // issue JWT so user is logged in after verifying
      const jwtToken = jwt.sign(
        { userId: newUser.id, role: newUser.role, email: newUser.email },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
      );

      return res.json({
        message: "Email verified and account created",
        token: jwtToken,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      console.error("verifyLink transaction error:", txErr);
      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("verifyLink error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * POST /api/auth/resend-verification
 * - Recreate token and email it if a pending registration exists
 * - Rate-limited by last token creation time
 */
export async function resendVerification(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });
  const lowerEmail = String(email).toLowerCase();

  try {
    // if a verified user exists, nothing to do
    const uRes = await db.query(
      "SELECT id, is_verified FROM users WHERE email = $1 LIMIT 1",
      [lowerEmail]
    );
    if (uRes.rowCount > 0 && uRes.rows[0].is_verified)
      return res.status(400).json({ error: "Email already verified" });

    // pending registration is required
    const pRes = await db.query(
      "SELECT email FROM pending_registrations WHERE email = $1 LIMIT 1",
      [lowerEmail]
    );
    if (pRes.rowCount === 0)
      return res
        .status(400)
        .json({
          error: "No pending registration found. Please register first.",
        });

    // rate-limit: ensure at least 60s since last token
    const lastRes = await db.query(
      "SELECT created_at FROM email_verifications WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
      [lowerEmail]
    );
    if (lastRes.rowCount > 0) {
      const last = new Date(lastRes.rows[0].created_at);
      const secondsSince = (Date.now() - last.getTime()) / 1000;
      if (secondsSince < 60)
        return res
          .status(429)
          .json({
            error: "Please wait before requesting another verification link",
          });
    }

    const token = genToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);
    await db.query(
      "INSERT INTO email_verifications (email, token_hash, expires_at, created_at) VALUES ($1,$2,$3,now())",
      [lowerEmail, tokenHash, expiresAt]
    );

    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}&email=${encodeURIComponent(
      lowerEmail
    )}`;

    // Send email with error handling
    const emailResult = await sendEmail(
      lowerEmail,
      "Verify your CampusBot account (resend)",
      `Click to verify: ${verifyUrl}\nExpires in ${TOKEN_TTL_MIN} minutes.`
    );

    if (!emailResult.success) {
      console.error(`[AUTH] Resend verification email failed for ${lowerEmail}:`, emailResult.technicalError);
      return res.status(500).json({
        error: emailResult.error || "Failed to send verification email. Please try again later or contact support."
      });
    }

    return res.json({ message: "Verification link resent. Check your inbox." });
  } catch (err) {
    console.error("resendVerification error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * POST /api/auth/login
 * - Check users table using password_hash
 * - Ensure is_verified is true before issuing JWT
 */
export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Missing email or password" });

  try {
    const lowerEmail = String(email).toLowerCase();
    const r = await db.query(
      "SELECT id, name, email, password_hash, role, is_verified FROM users WHERE email = $1 LIMIT 1",
      [lowerEmail]
    );
    if (r.rowCount === 0)
      return res.status(401).json({ error: "Invalid credentials" });

    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.is_verified)
      return res.status(403).json({ error: "Email not verified" });

    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * GET /api/auth/google/callback
 * - Handle Google OAuth callback
 * - User is already authenticated by Passport middleware
 * - Generate JWT token and redirect to frontend
 */
export async function googleCallback(req, res) {
  try {
    // User is attached to req by Passport after successful OAuth
    const user = req.user;

    if (!user) {
      console.error("[GOOGLE_AUTH] No user found in request after OAuth");
      return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
    }

    console.log(`[GOOGLE_AUTH] Generating JWT for user: ${user.email}`);

    // Generate JWT token for the authenticated user
    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    console.log(`[GOOGLE_AUTH] Redirecting to frontend with token`);

    // Redirect to frontend with token
    // Frontend will extract token from URL and store it
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error("[GOOGLE_AUTH] Error in callback:", err);
    return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
  }
}


/**
 * POST /api/auth/forgot-password
 * - Generate reset token
 * - Save to DB
 * - Send email
 */
export async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });

  const lowerEmail = String(email).toLowerCase().trim();

  try {
    const userRes = await db.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [lowerEmail]
    );

    if (userRes.rowCount === 0) {
      // Security: Don't reveal if user exists
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    const token = genToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      "UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3",
      [tokenHash, expiresAt, lowerEmail]
    );

    const resetUrl = `${FRONTEND_URL}/reset-password/${token}`;
    const body = `Hello,\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this message.`;

    const emailResult = await sendEmail(lowerEmail, "Reset your CampusBot password", body);

    if (!emailResult.success) {
      console.error(`[AUTH] Forgot password email failed for ${lowerEmail}:`, emailResult.technicalError);
      return res.status(500).json({ error: "Failed to send email" });
    }

    return res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * POST /api/auth/reset-password
 * - Verify token
 * - Update password
 */
export async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Missing token or password" });

  try {
    const tokenHash = hashToken(token);

    const userRes = await db.query(
      "SELECT id, reset_password_expires FROM users WHERE reset_password_token = $1 LIMIT 1",
      [tokenHash]
    );

    if (userRes.rowCount === 0) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const user = userRes.rows[0];
    if (new Date() > new Date(user.reset_password_expires)) {
      return res.status(400).json({ error: "Token expired" });
    }

    // Strength check (reuse logic or extract helper)
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    await db.query(
      "UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2",
      [password_hash, user.id]
    );

    return res.json({ message: "Password reset successful. You can now login." });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
