// src/index.js
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import passport from "passport";
import authRoutes from "./routes/auth.js";
import db from "./db.js";
import profileRoutes from "./routes/profile.js";
import chatRoutes from "./routes/chat.js";
import faqRoutes from "./routes/faq.js";
import registrationEventsRoutes from "./routes/registrationEvents.js";
import publicRegistrationEventsRoutes from "./routes/publicRegistrationEvents.js";
import chatHistoryRoutes from "./routes/chatHistory.js";
import chatSessionsRoutes from "./routes/chatSessions.js";
import portalRoutes from "./routes/portalRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import { verifyEmailService } from "./utils/sendEmail.js";
import { configurePassport } from "./config/passport.js";
// import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

// Configure Passport for Google OAuth
configurePassport();

// Verify email service configuration on startup
verifyEmailService().then((result) => {
  if (!result.success) {
    console.warn("[STARTUP] ⚠️  Email service is NOT configured properly!");
    console.warn("[STARTUP] ⚠️  User registration will fail until this is fixed.");
  }
});

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Initialize Passport
app.use(passport.initialize());

// mount auth routes at /api/auth
app.use("/api/auth", authRoutes);
app.use("/api", profileRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/admin/registration-events", registrationEventsRoutes);
app.use("/api/registration-events", publicRegistrationEventsRoutes);
// simple health check
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/chat/history", chatHistoryRoutes);
app.use("/api/chat/sessions", chatSessionsRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/settings", settingsRoutes);
// app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
