// Test script to verify email service configuration
import dotenv from "dotenv";
import { verifyEmailService, sendEmail } from "./src/utils/sendEmail.js";

dotenv.config();

console.log("=== Email Service Test ===\n");

// Test 1: Verify transporter configuration
console.log("Test 1: Verifying email transporter...");
const verifyResult = await verifyEmailService();

if (!verifyResult.success) {
    console.error("\n❌ Email service verification FAILED!");
    console.error("Please check your EMAIL_USER and EMAIL_PASS in .env file");
    process.exit(1);
}

console.log("\n✓ Email service verification PASSED!\n");

// Test 2: Send a test email (optional - uncomment to test)
// const testEmail = "your-test-email@example.com"; // Replace with your email
// console.log(`Test 2: Sending test email to ${testEmail}...`);
// const sendResult = await sendEmail(
//   testEmail,
//   "CampusBot Email Test",
//   "This is a test email from CampusBot. If you receive this, the email service is working correctly!"
// );

// if (sendResult.success) {
//   console.log("\n✓ Test email sent successfully!");
//   console.log("Check your inbox (and spam folder)");
// } else {
//   console.error("\n❌ Test email FAILED!");
//   console.error("Error:", sendResult.error);
// }

console.log("\n=== Test Complete ===");
process.exit(0);
