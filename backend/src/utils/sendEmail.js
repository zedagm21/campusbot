// backend/src/utils/sendEmail.js
import sgMail from "@sendgrid/mail";

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Configure sender email
// For testing: use the email you verified in SendGrid
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@campusbot.com";
const FROM_NAME = "CampusBot";

/**
 * Verify email service configuration on startup
 * This helps catch credential issues early
 */
export async function verifyEmailService() {
  try {
    console.log("[EMAIL] Verifying SendGrid email service configuration...");

    if (!process.env.SENDGRID_API_KEY) {
      console.error("[EMAIL] ✗ SENDGRID_API_KEY is not set in environment variables");
      console.error("[EMAIL] Please add SENDGRID_API_KEY to your Render environment");
      return { success: false, error: "SENDGRID_API_KEY not configured" };
    }

    if (!process.env.SENDGRID_FROM_EMAIL) {
      console.error("[EMAIL] ✗ SENDGRID_FROM_EMAIL is not set in environment variables");
      console.error("[EMAIL] Please add SENDGRID_FROM_EMAIL to your Render environment");
      return { success: false, error: "SENDGRID_FROM_EMAIL not configured" };
    }

    console.log("[EMAIL] ✓ SendGrid service is configured");
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

    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("Email service not configured. Check SENDGRID_API_KEY in environment variables");
    }

    if (!process.env.SENDGRID_FROM_EMAIL) {
      throw new Error("Sender email not configured. Check SENDGRID_FROM_EMAIL in environment variables");
    }

    // Prepare email message
    const msg = {
      to: to,
      from: {
        name: FROM_NAME,
        email: FROM_EMAIL,
      },
      subject: subject,
      text: text,
    };

    // Send email using SendGrid API
    const response = await sgMail.send(msg);

    const duration = Date.now() - startTime;
    console.log(`[EMAIL] ✓ Successfully sent to ${to} (${duration}ms)`);
    console.log(`[EMAIL] Status: ${response[0].statusCode}`);

    return { success: true, info: response[0] };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[EMAIL] ✗ Failed to send to ${to} (${duration}ms)`);
    console.error(`[EMAIL] Error type: ${error.name}`);
    console.error(`[EMAIL] Error message: ${error.message}`);

    // Log SendGrid specific error details
    if (error.response) {
      console.error(`[EMAIL] SendGrid response code: ${error.code}`);
      console.error(`[EMAIL] SendGrid response body:`, error.response.body);
    }

    // Provide user-friendly error messages based on error type
    let userMessage = "Failed to send verification email. ";

    if (error.message.includes("API key") || error.code === 401 || error.code === 403) {
      userMessage += "Email service authentication failed. Please contact support.";
    } else if (error.code === 429) {
      userMessage += "Too many emails sent. Please try again in a few minutes.";
    } else if (error.message.includes("Invalid email") || error.code === 400) {
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
