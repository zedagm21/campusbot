// src/controllers/faqController.js
import db from "../db.js";
import PortalLoginService from "../services/PortalLoginService.js";

// --------------------------
// CHECK QUESTION TYPE
// --------------------------
function isPortalQuestion(question) {
  const keywords = [
    "cgpa",
    "sgpa",
    "grade",
    "result",
    "registration",
    "registration date",
    "status",
    "semester",
    "dorm",
    "dormitory",
    "marks",
    "score",
    "academic",
  ];

  question = question.toLowerCase();
  return keywords.some((key) => question.includes(key));
}

// --------------------------
// GENERATE ANSWER FROM PORTAL DATA
// --------------------------
function answerFromPortal(question, regData) {
  question = question.toLowerCase();
  const latest = regData[regData.length - 1];

  if (question.includes("cgpa"))
    return `Your current CGPA is ${latest.CGPA ?? "not available yet"}.`;

  if (question.includes("sgpa"))
    return `Your latest SGPA is ${latest.SGPA ?? "not available yet"}.`;

  if (question.includes("semester"))
    return `You have completed ${regData.length} semesters.`;

  if (question.includes("registration date"))
    return `Your latest registration date is ${latest.RegistrationDate}.`;

  if (question.includes("status"))
    return `Your final status is: ${latest.FinalStatus ?? "Pending"}.`;

  return "I’m not sure about that. Try asking about CGPA, SGPA, registration date, or semester.";
}

// --------------------------
// MAIN FAQ CONTROLLER
// --------------------------
export async function getFaqs(req, res) {
  const question = req.query.q || req.body.q || "";
  const username = req.body.username;
  const password = req.body.password;

  try {
    // 1️⃣ If no question → return all DB FAQs
    if (!question) {
      const r = await db.query(
        `SELECT * FROM faqs ORDER BY created_at DESC LIMIT 100`
      );
      return res.json({ faqs: r.rows });
    }

    // 2️⃣ If NOT portal related → search DB FAQ
    if (!isPortalQuestion(question)) {
      const r = await db.query(
        `SELECT * FROM faqs WHERE question ILIKE $1 OR answer ILIKE $1 ORDER BY created_at DESC`,
        [`%${question}%`]
      );
      return res.json({ faqs: r.rows });
    }

    // 3️⃣ Portal related → require username + password
    if (!username || !password) {
      return res.status(400).json({
        error: "Portal username and password are required for this question.",
      });
    }

    // 4️⃣ Login to portal
    const login = await PortalLoginService.loginToPortal(username, password);
    if (!login.success) {
      return res.status(401).json({ error: "Invalid portal credentials." });
    }

    const cookies = login.cookies;

    // 5️⃣ Fetch registration summary
    const portalData = await PortalLoginService.fetchPortalData(
      cookies,
      "RegistrationSummary/GetStudentRegistration?studentCurriculumCode=306932"
    );

    if (!portalData.success) {
      return res.status(500).json({ error: "Failed to fetch portal data." });
    }

    // 6️⃣ Generate answer
    const dynamicAnswer = answerFromPortal(question, portalData.data);

    return res.json({
      answer: dynamicAnswer,
      data: portalData.data,
    });
  } catch (err) {
    console.error("getFaqs error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
