// // src/routes/faq.js
// import express from "express";
// import { getFaqs, createFaq } from "../controllers/faqController.js";
// import { authenticateToken } from "../middleware/authMiddleware.js";

// const router = express.Router();

// // public read endpoint
// router.get("/", getFaqs);

// // protected create endpoint - only admin allowed
// // we use authenticateToken to decode JWT and attach req.user,
// // then a small inline check enforces admin role.
// router.post(
//   "/",
//   authenticateToken,
//   (req, res, next) => {
//     if (!req.user || req.user.role !== "admin") {
//       return res.status(403).json({ error: "Forbidden: admin only" });
//     }
//     return next();
//   },
//   createFaq
// );

// export default router;

// src/routes/faq.js
import express from "express";
import { getFaqs } from "../controllers/faqController.js";

const router = express.Router();

// Public endpoint to fetch FAQ data (from portal integration)
router.get("/", getFaqs);

export default router;
