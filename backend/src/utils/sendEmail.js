// backend/src/utils/sendEmail.js
import nodemailer from "nodemailer";

// Create transporter with Gmail configuration using port 587 (STARTTLS)
// This works better in cloud environments like Render compared to port 465
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use STARTTLS instead of SSL
  auth: {
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
  },
  tls: {
    rejectUnauthorized: true,
  },
});

/**
 * Verify email transporter configuration on startup
 * This helps catch credential issues early
 */
export async function verifyEmailService() {
  try {
    console.log("[EMAIL] Verifying Gmail SMTP service configuration...");

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("[EMAIL] ✗ EMAIL_USER or EMAIL_PASS is not set in environment variables");
      console.error("[EMAIL] Please add these variables to your Render environment");
      return { success: false, error: "Email credentials not configured" };
    }

    await transporter.verify();
    console.log("[EMAIL] ✓ Gmail SMTP service is ready");
    console.log(`[EMAIL] Using account: ${process.env.EMAIL_USER}`);
    return { success: true };
  } catch (error) {
    console.error("[EMAIL] ✗ Email service verification failed:", error.message);
    console.error("[EMAIL] Please check EMAIL_USER and EMAIL_PASS in .env file");
    return { success: false, error: error.message };
  }
}

/**
 * Send email with comprehensive error handling and logging
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Email body (plain text)
 * @returns {Promise<{success: boolean, info?: object, error?: string}>}
 */
export async function sendEmail(to, subject, text) {
  const startTime = Date.now();

  try {
    console.log(`[EMAIL] Attempting to send email to: ${to}`);
    console.log(`[EMAIL] Subject: "${subject}"`);

    // Validate inputs
    if (!to || !subject || !text) {
      throw new Error("Missing required email parameters (to, subject, or text)");
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Email credentials not configured. Check EMAIL_USER and EMAIL_PASS in environment");
    }

    // Send email
    const info = await transporter.sendMail({
      from: `"CampusBot" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });

    const duration = Date.now() - startTime;
    console.log(`[EMAIL] ✓ Successfully sent to ${to} (${duration}ms)`);
    console.log(`[EMAIL] Message ID: ${info.messageId}`);

    return { success: true, info };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[EMAIL] ✗ Failed to send to ${to} (${duration}ms)`);
    console.error(`[EMAIL] Error type: ${error.name}`);
    console.error(`[EMAIL] Error message: ${error.message}`);

    // Log detailed error information for debugging
    if (error.code) {
      console.error(`[EMAIL] Error code: ${error.code}`);
    }
    if (error.response) {
      console.error(`[EMAIL] SMTP response: ${error.response}`);
    }

    // Provide user-friendly error messages based on error type
    let userMessage = "Failed to send verification email. ";

    if (error.message.includes("Invalid login") || error.code === "EAUTH") {
      userMessage += "Email service authentication failed. Please verify your Gmail App Password.";
    } else if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT") {
      userMessage += "Could not connect to email server. Please try again later.";
    } else if (error.code === "EMESSAGE") {
      userMessage += "Invalid email format. Please check your email address.";
    } else {
      userMessage += "Please try again or contact support.";
    }

    return {
      success: false,
      error: userMessage,
      technicalError: error.message
    };
  }
}
