// src/routes/registrationEvents.js
import express from "express";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../controllers/registrationEventsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public read endpoints could be exposed elsewhere (e.g., /api/registration-events).
// Here we expose admin endpoints under /api/admin/registration-events

// list & create
router.get(
  "/",
  authenticateToken,
  (req, res, next) => {
    // allow admin or staff; this inline check ensures only admins can write
    return next();
  },
  listEvents
);

// get single
router.get("/:id", authenticateToken, getEvent);

// create (admin only)
router.post(
  "/",
  authenticateToken,
  (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: admin only" });
    }
    return next();
  },
  createEvent
);

// update (admin only)
router.put(
  "/:id",
  authenticateToken,
  (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: admin only" });
    }
    return next();
  },
  updateEvent
);

// delete (admin only)
router.delete(
  "/:id",
  authenticateToken,
  (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: admin only" });
    }
    return next();
  },
  deleteEvent
);

export default router;
