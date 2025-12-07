// src/routes/publicRegistrationEvents.js
import express from "express";
import {
  listEvents,
  getEvent,
} from "../controllers/registrationEventsController.js";

const router = express.Router();

// Public endpoints (no auth)
router.get("/", listEvents); // GET /api/registration-events?q=optional
router.get("/:id", getEvent); // GET /api/registration-events/:id

export default router;
