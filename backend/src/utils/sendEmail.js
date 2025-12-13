// backend/src/utils/sendEmail.js
import { Resend } from "resend";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Configure sender email (must be verified in Resend dashboard)
// For testing: use "onboarding@resend.dev"
// For production: use your verified domain email
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const FROM_NAME = "CampusBot";

/**
 * Verify email service configuration on startup
 * This helps catch credential issues early
 */
export async function verifyEmailService() {
  try {
    console.log("[EMAIL] Verifying Resend email service configuration...");

    if (!process.env.RESEND_API_KEY) {
      console.error("[EMAIL] ✗ RESEND_API_KEY is not set in environment variables");
      console.error("[EMAIL] Please add RESEND_API_KEY to your .env file or Render environment");
      return { success: false, error: "RESEND_API_KEY not configured" };
    }

    // Resend doesn't have a verify method, so we just check if API key is present
    console.log("[EMAIL] ✓ Resend service is configured");
    console.log(`[EMAIL] Using sender: ${FROM_NAME} <${FROM_EMAIL}>`);
    return { success: true };
  } catch (error) {
    console.error("[EMAIL] ✗ Email service verification failed:", error.message);
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

    if (!process.env.RESEND_API_KEY) {
      throw new Error("Email service not configured. Check RESEND_API_KEY in environment variables");
    }

    // Send email using Resend API
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: subject,
      text: text,
    });

    if (error) {
      throw new Error(error.message || "Resend API error");
    }

    const duration = Date.now() - startTime;
    console.log(`[EMAIL] ✓ Successfully sent to ${to} (${duration}ms)`);
    console.log(`[EMAIL] Message ID: ${data.id}`);

    return { success: true, info: data };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[EMAIL] ✗ Failed to send to ${to} (${duration}ms)`);
    console.error(`[EMAIL] Error type: ${error.name}`);
    console.error(`[EMAIL] Error message: ${error.message}`);

    // Provide user-friendly error messages based on error type
    let userMessage = "Failed to send verification email. ";

    if (error.message.includes("API key") || error.message.includes("RESEND_API_KEY")) {
      userMessage += "Email service authentication failed. Please contact support.";
    } else if (error.message.includes("rate limit")) {
      userMessage += "Too many emails sent. Please try again in a few minutes.";
    } else if (error.message.includes("Invalid email")) {
      userMessage += "Invalid email address. Please check your email address.";
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
