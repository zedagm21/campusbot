// backend/src/controllers/chatController.js
import db from "../db.js";
import PortalLoginService from "../services/PortalLoginService.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import fetch from "node-fetch"; // remove if your Node has global fetch

// --- Helpers ---

// redact common PII (emails and long numeric ids) before storing/sending to external APIs
function redactPII(text) {
  if (!text) return text;
  let red = text.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[REDACTED_EMAIL]"
  );
  red = red.replace(/\b\d{5,}\b/g, "[REDACTED_ID]");
  return red;
}

// simple readable date formatter
function fmtDate(dt) {
  if (!dt) return "N/A";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
  }
}

// Local fallback title generator (cheap, immediate)
function generateTitleFromMessageLocal(text) {
  if (!text) return "Untitled conversation";
  const cleaned = text.replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").slice(0, 6);
  let title = words.join(" ");
  if (title.length > 60) title = title.slice(0, 57).trim() + "...";
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return title || "Untitled conversation";
}

// --- Gemini Title Generator (Replaces OpenAI) ---
// Uses Google Gemini API to produce a concise 3-5 word title.
async function generateTitleWithLLM(rawText) {
  // [GEMINI UPDATE] Using GEMINI_API_KEY
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API key not configured");

  const safe = redactPII(String(rawText).slice(0, 500));
  // [GEMINI UPDATE] Using GEMINI_TITLE_MODEL or default to specific version
  const model = process.env.GEMINI_TITLE_MODEL || "gemini-1.5-flash-001";

  const systemPrompt =
    "You are a helpful assistant that creates concise 3-5 word titles summarizing a user's question. Return only the title as plain text, no punctuation or commentary.";

  const userPrompt = `Create a very short (3-5 words) title for this student question. Keep it informal and clear.\n\nQuestion: "${safe}"\n\nTitle:`;

  // [GEMINI UPDATE] Request body structure
  const body = {
    contents: [
      {
        parts: [
          { text: systemPrompt + "\n\n" + userPrompt }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: 20,
      temperature: 0.2,
    },
  };

  // [GEMINI UPDATE] Gemini API Endpoint
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error("Gemini title generation failed");
    err.details = text;
    throw err;
  }

  const data = await resp.json();
  // [GEMINI UPDATE] Response parsing
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let title = String(raw)
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\n/g, " ")
    .trim();

  if (title.length > 60) title = title.slice(0, 57).trim() + "...";
  title = title.charAt(0).toUpperCase() + title.slice(1);

  if (!title) throw new Error("Gemini returned empty title");
  return title;
}

// --- Gemini Grade Parameter Extractor (Replaces OpenAI) ---
async function extractGradeParamsWithLLM(
  userMessage,
  conversationHistory = []
) {
  // [GEMINI UPDATE] Using GEMINI_API_KEY
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API key not configured");

  // [GEMINI UPDATE] Using GEMINI_MODEL or default
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash-001";

  const system = `You are the CampusBot academic assistant. Your primary function is to resolve user requests with absolute precision and filter responses aggressively.

1. MANDATE: SPECIFIC COURSE SEARCH & FILTERING
When the user names a specific course (e.g., "english," "Object Oriented Programming"):

Rule 1: Search Scope: You MUST search for that course across ALL years and semesters recorded in the student's history, not just the latest or the one year mentioned.

Rule 2: Output Filter: You MUST filter the final output to display ONLY the result for the named course (e.g., "General Psychology: A"). You are STRICTLY FORBIDDEN from returning the rest of the semester's courses or the entire year's data.

Rule 3: CRITICAL - Detail Level: When a course_filter is specified, you MUST ALWAYS set detail_level to "detailed". This is mandatory because we need to fetch individual course data to search through.

2. MANDATE: CONTEXTUAL MEMORY
If the user answers a clarifying question with a simple affirmation ("yes," "correct," etc.), you MUST immediately execute the pending request (e.g., provide the breakdown for Year 3, Semester 2). DO NOT lose the thread and ask "How can I assist you?"

3. YEAR AND SEMESTER EXTRACTION (CRITICAL):
- Extract year numbers from phrases like "Year 3", "year 3", "Yir 3", "3rd year", "third year" → year: 3
- Extract semester numbers from phrases like "sem 2", "semester 2", "Semester II", "second semester" → semester: 2 (convert Roman numerals: I=1, II=2)
- If BOTH year AND semester are mentioned, extract BOTH values
- If only year is mentioned, set semester to null
- If only semester is mentioned, set year to null
- If neither is mentioned, set both to null

4. DETAIL LEVEL RULES (CRITICAL):
- If user asks for "breakdown", "courses", "subjects", "marks", "each course", "show me courses", "details", "detailed", or mentions a specific course name → detail_level MUST be "detailed"
- If user asks for "GPA", "CGPA", "overall result", "summary" ONLY (without asking for courses) → detail_level can be "summary"
- When in doubt, use "detailed"

All other system behaviors (GPA/CGPA requests, API payload) remain standard. Focus entirely on executing the mandates above.

API PAYLOAD:
Transmit the request using the standard JSON structure:
"request_type":"get_grade","year":<number or null>,"semester":<number or null>,"detail_level":<"summary" or "detailed">,"course_filter":<string or null>`;

  // Build conversation context
  let contextStr = "";
  if (conversationHistory && conversationHistory.length > 0) {
    contextStr = "\n\nConversation History (last 3 messages):\n";
    conversationHistory.slice(-3).forEach((msg) => {
      contextStr += `${msg.sender}: ${msg.text}\n`;
    });
  }

  const user = `${contextStr}\nCurrent Student Question: "${userMessage}"\n\nJSON:`;

  // [GEMINI UPDATE] Request body with JSON response config
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: system + "\n\n" + user }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 100,
      temperature: 0,
      response_mime_type: "application/json", // Enforce JSON
    },
  };

  // [GEMINI UPDATE] Gemini API Endpoint
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini extraction failed: ${text}`);
  }

  const data = await resp.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  try {
    console.log("DEBUG: GEMINI Raw Output:", raw);
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse GEMINI JSON:", raw);
    return {};
  }
}

/**
 * POST /api/chat
 * Responds with { reply, source, sessionId, sessionTitle? }
 * - Creates session (or validates provided one)
 * - Generates a title (LLM if enabled, otherwise local) for new sessions or if the session has zero messages
 * - Saves user message and bot reply, updates session activity
 */
export async function handleChat(req, res) {
  const userId = req.user?.userId;
  const { message } = req.body;

  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  if (!message || typeof message !== "string")
    return res.status(400).json({ error: "Message required" });

  const userMessageSafe = redactPII(message);

  try {
    // session handling
    let sessionId = req.body.sessionId ? Number(req.body.sessionId) : null;
    let sessionTitle = null;
    // [GEMINI UPDATE] Env var for enabling logic
    const useLLMTitle =
      String(process.env.ENABLE_GEMINI_TITLES || process.env.ENABLE_OPENAI_TITLES || "false").toLowerCase() ===
      "true";

    // safe message count for logging (avoid querying with null sessionId)
    let msgCountForLog = 0;
    if (sessionId) {
      const cRes = await db.query(
        "SELECT COUNT(*)::int AS cnt FROM messages WHERE session_id=$1",
        [sessionId]
      );
      msgCountForLog = cRes.rows?.[0]?.cnt ?? 0;
    }
    console.log(
      "handleChat: userId=%s sessionId=%s sessionTitle=%s hasMessages=%d",
      userId,
      sessionId,
      sessionTitle,
      msgCountForLog
    );

    if (!sessionId) {
      // create new session
      const sessionRes = await db.query(
        `INSERT INTO chat_sessions (user_id, started_at) VALUES ($1, now()) RETURNING id`,
        [userId]
      );
      sessionId = sessionRes.rows[0].id;

      // generate title: try LLM if enabled, otherwise local fallback
      if (useLLMTitle) {
        try {
          const llmTitle = await generateTitleWithLLM(userMessageSafe);
          sessionTitle = llmTitle;
          await db.query(`UPDATE chat_sessions SET title = $1 WHERE id = $2`, [
            llmTitle,
            sessionId,
          ]);
        } catch (llmErr) {
          console.error(
            "LLM title generation failed, falling back to local:",
            llmErr
          );
          const local = generateTitleFromMessageLocal(userMessageSafe);
          sessionTitle = local;
          await db.query(`UPDATE chat_sessions SET title = $1 WHERE id = $2`, [
            local,
            sessionId,
          ]);
        }
      } else {
        const local = generateTitleFromMessageLocal(userMessageSafe);
        sessionTitle = local;
        await db.query(`UPDATE chat_sessions SET title = $1 WHERE id = $2`, [
          local,
          sessionId,
        ]);
      }
    } else {
      // verify session belongs to user
      const sCheck = await db.query(
        `SELECT id, title FROM chat_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [sessionId, userId]
      );
      if (sCheck.rowCount === 0) {
        // invalid session for this user -> create new session (and generate title)
        const sessionRes = await db.query(
          `INSERT INTO chat_sessions (user_id, started_at) VALUES ($1, now()) RETURNING id`,
          [userId]
        );
        sessionId = sessionRes.rows[0].id;

        if (useLLMTitle) {
          try {
            const llmTitle = await generateTitleWithLLM(userMessageSafe);
            sessionTitle = llmTitle;
            await db.query(
              `UPDATE chat_sessions SET title = $1 WHERE id = $2`,
              [llmTitle, sessionId]
            );
          } catch (llmErr) {
            console.error(
              "LLM title generation failed, falling back to local:",
              llmErr
            );
            const local = generateTitleFromMessageLocal(userMessageSafe);
            sessionTitle = local;
            await db.query(
              `UPDATE chat_sessions SET title = $1 WHERE id = $2`,
              [local, sessionId]
            );
          }
        } else {
          const local = generateTitleFromMessageLocal(userMessageSafe);
          sessionTitle = local;
          await db.query(`UPDATE chat_sessions SET title = $1 WHERE id = $2`, [
            local,
            sessionId,
          ]);
        }
      } else {
        // session exists and belongs to user
        sessionTitle = sCheck.rows[0].title || null;

        // ONLY generate a title if this session truly has NO messages yet.
        // This prevents overwriting titles after the session already has content.
        if (!sessionTitle) {
          const msgCountRes = await db.query(
            `SELECT COUNT(*) AS cnt FROM messages WHERE session_id = $1`,
            [sessionId]
          );
          const count = Number(msgCountRes.rows[0].cnt || 0);
          if (count === 0) {
            // safe to generate title — it's the first message for this session
            if (useLLMTitle) {
              try {
                const llmTitle = await generateTitleWithLLM(userMessageSafe);
                sessionTitle = llmTitle;
                await db.query(
                  `UPDATE chat_sessions SET title = $1 WHERE id = $2`,
                  [llmTitle, sessionId]
                );
              } catch (llmErr) {
                console.error(
                  "LLM title generation failed, falling back to local:",
                  llmErr
                );
                const local = generateTitleFromMessageLocal(userMessageSafe);
                sessionTitle = local;
                await db.query(
                  `UPDATE chat_sessions SET title = $1 WHERE id = $2`,
                  [local, sessionId]
                );
              }
            } else {
              const local = generateTitleFromMessageLocal(userMessageSafe);
              sessionTitle = local;
              await db.query(
                `UPDATE chat_sessions SET title = $1 WHERE id = $2`,
                [local, sessionId]
              );
            }
          } else {
            // session already has messages — do NOT overwrite title
            // sessionTitle remains null or existing title if any
          }
        }
      }
    }

    // save user message
    await db.query(
      `INSERT INTO messages (session_id, sender, text) VALUES ($1, $2, $3)`,
      [sessionId, "user", message]
    );
    // update session last-activity time
    await db.query(
      `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
      [sessionId]
    );

    // Declare msgLower early so it can be used in all intent checks
    const msgLower = userMessageSafe.toLowerCase();

    // ---------- 0) Login intent detection ----------
    if (msgLower.startsWith("login ")) {
      const parts = message.trim().split(/\s+/);
      if (parts.length >= 3) {
        // simple parsing: login <user> <pass>
        const username = parts[1];
        const password = parts.slice(2).join(" "); // allow spaces in password if any? usually not but safe

        const loginRes = await PortalLoginService.loginToPortal(
          username,
          password
        );

        if (loginRes.success) {
          // Store cookies AND encrypted credentials in DB
          const encryptedPass = encrypt(password);
          await db.query(
            `UPDATE users SET portal_cookies = $1, portal_username = $2, portal_password_encrypted = $3 WHERE id = $4`,
            [JSON.stringify(loginRes.cookies), username, encryptedPass, userId]
          );

          const reply =
            "Login successful! I've saved your session securely. You can now ask for your grades or other portal info.";
          await db.query(
            `INSERT INTO messages (session_id, sender, text) VALUES ($1, $2, $3)`,
            [sessionId, "bot", reply]
          );
          await db.query(
            `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
            [sessionId]
          );
          return res.json({ reply, source: "login", sessionId, sessionTitle });
        } else {
          const reply = `Login failed: ${loginRes.error}`;
          await db.query(
            `INSERT INTO messages (session_id, sender, text) VALUES ($1, $2, $3)`,
            [sessionId, "bot", reply]
          );
          await db.query(
            `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
            [sessionId]
          );
          return res.json({ reply, source: "login", sessionId, sessionTitle });
        }
      }
    }

    // ---------- 1) Registration-intent detection ----------
    const registrationKeywords = [
      "register",
      "registration",
      "enroll",
      "enrol",
      "when is registration",
      "registration date",
      "how do i register",
    ];
    const looksLikeRegistration = registrationKeywords.some((k) =>
      msgLower.includes(k)
    );

    if (looksLikeRegistration) {
      const evRes = await db.query(
        `SELECT id, title, description, start_at, end_at, location FROM registration_events
         WHERE title ILIKE $1 OR coalesce(description,'') ILIKE $1
         ORDER BY start_at DESC LIMIT 1`,
        [`%${userMessageSafe}%`]
      );

      if (evRes.rowCount > 0) {
        const ev = evRes.rows[0];
        const reply = `${ev.title} — Registration runs from ${fmtDate(
          ev.start_at
        )} to ${fmtDate(ev.end_at)}. Location: ${ev.location || "not specified"
          }. ${ev.description ? ev.description : ""}`.trim();

        await db.query(
          `INSERT INTO messages (session_id, sender, text) VALUES ($1,$2,$3)`,
          [sessionId, "bot", reply]
        );
        await db.query(
          `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
          [sessionId]
        );

        return res.json({ reply, source: "events", sessionId, sessionTitle });
      }
    }

    // ---------- 2) Portal/Grades intent detection ----------
    // Improved regex to handle variations and typos: grade, cgpa, gpa, result, mark, score, garde, status, breakdown, courses, subjects, semester
    const gradesRegex =
      /(grade|cgpa|gpa|result|mark|score|garde|status|breakdown|courses|subjects|semester)/i;
    const looksLikeGrades = gradesRegex.test(msgLower);

    if (looksLikeGrades) {
      // Check if user has cookies OR stored credentials
      const userRes = await db.query(
        `SELECT portal_cookies, portal_username, portal_password_encrypted FROM users WHERE id = $1`,
        [userId]
      );
      const userData = userRes.rows[0];
      let cookiesJson = userData?.portal_cookies;
      const encryptedPass = userData?.portal_password_encrypted;
      const portalUser = userData?.portal_username;

      // If no cookies, try to auto-login using stored credentials
      if (!cookiesJson && encryptedPass && portalUser) {
        console.log("No cookies found, attempting auto-login for user", userId);
        try {
          const decryptedPass = decrypt(encryptedPass);
          if (decryptedPass) {
            const loginRes = await PortalLoginService.loginToPortal(
              portalUser,
              decryptedPass
            );
            if (loginRes.success) {
              console.log("Auto-login successful");
              cookiesJson = JSON.stringify(loginRes.cookies);
              // Update DB with new cookies
              await db.query(
                `UPDATE users SET portal_cookies = $1 WHERE id = $2`,
                [cookiesJson, userId]
              );
            } else {
              console.error("Auto-login failed:", loginRes.error);
            }
          }
        } catch (err) {
          console.error("Auto-login error:", err);
        }
      }

      if (!cookiesJson) {
        const reply =
          "🔒 I need access to your student portal to fetch your grades and course information.\n\n" +
          "📍 **How to connect:**\n" +
          "1. Click on your profile picture (top right corner)\n" +
          "2. Select 'Portal Settings'\n" +
          "3. Enter your portal username and password\n" +
          "4. Click 'Save & Connect'\n\n" +
          "Once connected, I'll be able to help you with grades, courses, and academic information! 🎓";
        await db.query(
          `INSERT INTO messages (session_id, sender, text) VALUES ($1,$2,$3)`,
          [sessionId, "bot", reply]
        );
        await db.query(
          `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
          [sessionId]
        );
        return res.json({ reply, source: "portal", sessionId, sessionTitle });
      }

      // Use LLM to extract Year, Semester, and Course Filter with conversation context
      let options = {};
      try {
        // Fetch recent conversation history for context
        const historyRes = await db.query(
          `SELECT sender, text FROM messages 
           WHERE session_id = $1 
           ORDER BY created_at DESC 
           LIMIT 6`,
          [sessionId]
        );
        const conversationHistory = historyRes.rows.reverse(); // Oldest first

        options = await extractGradeParamsWithLLM(
          userMessageSafe,
          conversationHistory
        );
        console.log("DEBUG: LLM Extracted options:", options);
      } catch (err) {
        console.error(
          "LLM extraction failed, falling back to null options (latest):",
          err
        );
      }

      // Fetch real grades from portal
      try {
        let cookies = JSON.parse(cookiesJson);
        let gradesResult = await PortalLoginService.fetchGrades(
          cookies,
          options
        );

        // Retry logic: If failed, try to re-login and fetch again
        if (!gradesResult.success && encryptedPass && portalUser) {
          console.log(
            "Fetch failed (likely session expired). Attempting auto-re-login..."
          );
          try {
            const decryptedPass = decrypt(encryptedPass);
            if (decryptedPass) {
              const loginRes = await PortalLoginService.loginToPortal(
                portalUser,
                decryptedPass
              );
              if (loginRes.success) {
                console.log("Re-login successful. Retrying fetch...");
                cookies = loginRes.cookies;
                // Update DB with new cookies
                await db.query(
                  `UPDATE users SET portal_cookies = $1 WHERE id = $2`,
                  [JSON.stringify(cookies), userId]
                );
                // Retry fetch with new cookies
                gradesResult = await PortalLoginService.fetchGrades(
                  cookies,
                  options
                );
              } else {
                console.error("Re-login failed:", loginRes.error);
              }
            }
          } catch (retryErr) {
            console.error("Error during re-login retry:", retryErr);
          }
        }

        // If still failed after retry
        if (!gradesResult.success) {
          console.error("Failed to fetch grades even after retry.");
          const reply =
            "I found an issue with your current portal session. While I could connect, the system rejected the grade request. This usually means the session is invalid or the credentials are incorrect. Please ensure your username and password are correct, log out of the portal settings, and then log back in.";

          await db.query(
            `INSERT INTO messages (session_id, sender, text) VALUES ($1,$2,$3)`,
            [sessionId, "bot", reply]
          );
          await db.query(
            `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
            [sessionId]
          );

          return res.json({ reply, source: "portal", sessionId, sessionTitle });
        }

        // --- SUCCESS CASE ---
        const gradesData = gradesResult.data;
        let reply = "";

        if (!gradesData || gradesData.length === 0) {
          reply =
            "I successfully accessed the portal, but I couldn't find any grade records for the specified year/semester.";
        } else {
          const detailLevel = options.detail_level || "summary";
          const courseFilter = options.course_filter || null;

          console.log("DEBUG: courseFilter =", courseFilter);
          console.log("DEBUG: gradesData length =", gradesData.length);

          // Filter logic
          const formattedParts = [];
          let foundAnyCourse = false;

          for (const g of gradesData) {
            console.log(
              `DEBUG: Checking Year ${g.batch}, Semester ${g.semester
              }, courses count: ${g.courses ? g.courses.length : 0}`
            );

            // If strict course filtering is on, we ONLY show the course if found.
            // We do NOT show the semester summary unless we found the course in it.

            if (courseFilter) {
              if (g.courses && g.courses.length > 0) {
                console.log(
                  `DEBUG: First 3 course titles in Year ${g.batch} Sem ${g.semester}:`,
                  g.courses
                    .slice(0, 3)
                    .map((c) => c.CourseTitle || c.CourseName || "NO TITLE")
                );

                const filterLower = courseFilter.toLowerCase();
                const matchingCourses = g.courses.filter((c) => {
                  const title = (c.CourseTitle || "").toLowerCase();
                  const code = (c.CourseCode || "").toLowerCase();
                  return (
                    title.includes(filterLower) || code.includes(filterLower)
                  );
                });

                if (matchingCourses.length > 0) {
                  foundAnyCourse = true;
                  // Found matches! Format them.
                  const courseLines = matchingCourses
                    .map((c) => {
                      const name =
                        c.CourseTitle || c.CourseName || "Unknown Course";
                      const code = c.CourseCode || "";
                      const grade =
                        c.LetterGrade ||
                        c.Letter ||
                        c.Grade ||
                        c.StudentGrade ||
                        "-";
                      return `${name} (${code}): ${grade}`;
                    })
                    .join("\n");

                  // Add to output. We can optionally include the semester header for context
                  formattedParts.push(
                    `Year ${g.batch}, Semester ${g.semester}\n${courseLines}`
                  );
                }
              }
            } else {
              // Standard behavior (Summary or Detailed Breakdown of whole semester)
              let text = `Year ${g.batch}, Semester ${g.semester}\n`;
              text += `• GPA: ${g.semesterGpa}\n`;
              text += `• CGPA: ${g.cgpa}\n`;
              text += `• Status: ${g.status}`;

              if (
                detailLevel === "detailed" &&
                g.courses &&
                g.courses.length > 0
              ) {
                text += `\n\nCourse Breakdown:\n`;
                text += g.courses
                  .map((c) => {
                    const name =
                      c.CourseTitle || c.CourseName || "Unknown Course";
                    const code = c.CourseCode || "";
                    const grade =
                      c.LetterGrade ||
                      c.Letter ||
                      c.Grade ||
                      c.StudentGrade ||
                      "-";
                    return `• ${name} (${code}): ${grade}`;
                  })
                  .join("\n");
              } else if (detailLevel === "detailed") {
                text += `\n\n(No detailed course information available for this semester)`;
              }
              formattedParts.push(text);
            }
          }

          if (courseFilter) {
            if (foundAnyCourse) {
              reply = formattedParts.join("\n\n---\n\n");
            } else {
              reply = `I couldn't find any course matching "${courseFilter}" in your records.`;
            }
          } else {
            reply =
              "Here are your results:\n\n" + formattedParts.join("\n\n---\n\n");
          }
        }

        await db.query(
          `INSERT INTO messages (session_id, sender, text) VALUES ($1,$2,$3)`,
          [sessionId, "bot", reply]
        );
        await db.query(
          `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
          [sessionId]
        );

        return res.json({ reply, source: "portal", sessionId, sessionTitle });
      } catch (err) {
        console.error("Error fetching grades:", err);

        // Check if this is an authentication/authorization error
        const isAuthError =
          err.message &&
          (err.message.includes("401") ||
            err.message.includes("403") ||
            err.message.includes("Unauthorized") ||
            err.message.includes("authentication") ||
            err.message.includes("session") ||
            err.code === "ERR_BAD_REQUEST");

        let reply;
        if (isAuthError) {
          reply =
            "⚠️ I'm having trouble accessing your grades from the portal. This usually happens when your session has expired.\n\n" +
            "📍 **To reconnect:**\n" +
            "1. Click on your profile picture (top right)\n" +
            "2. Select 'Portal Settings'\n" +
            "3. Click 'Disconnect Portal Account'\n" +
            "4. Re-enter your credentials and click 'Save & Connect'\n\n" +
            "This will refresh your connection to the student portal.";
        } else {
          reply =
            "I encountered an unexpected error while fetching your grades. Please try again later or contact support if the issue persists.";
        }

        await db.query(
          `INSERT INTO messages (session_id, sender, text) VALUES ($1,$2,$3)`,
          [sessionId, "bot", reply]
        );
        await db.query(
          `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
          [sessionId]
        );

        return res.json({ reply, source: "portal", sessionId, sessionTitle });
      }
    }

    // ---------- 3) FAQ-first ----------
    const faqRes = await db.query(
      `SELECT answer FROM faqs WHERE question ILIKE $1 OR answer ILIKE $1 LIMIT 1`,
      [`%${userMessageSafe}%`]
    );

    if (faqRes.rowCount > 0) {
      const reply = faqRes.rows[0].answer;
      await db.query(
        `INSERT INTO messages (session_id, sender, text) VALUES ($1,$2,$3)`,
        [sessionId, "bot", reply]
      );
      await db.query(
        `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
        [sessionId]
      );
      return res.json({ reply, source: "faq", sessionId, sessionTitle });
    }

    // ---------- 4) Gemini fallback (Replaces OpenAI) ----------
    const contextRes = await db.query(
      `SELECT question, answer FROM faqs ORDER BY created_at DESC LIMIT 3`
    );
    const faqSnippets = contextRes.rows.map(
      (r, i) => `FAQ ${i + 1} Q: ${r.question}\nA: ${r.answer}`
    );

    const systemMessage = `You are CampusBot — a helpful university assistant. Use the facts in the FAQ snippets when relevant. Be concise. Do NOT invent personal data.`;

    const faqContext = faqSnippets.length
      ? `Relevant FAQs:\n${faqSnippets.join("\n\n")}`
      : "";

    const userPrompt = `${faqContext}\nStudent asked: ${userMessageSafe}`;

    // [GEMINI UPDATE] Using GEMINI_API_KEY and GEMINI_MODEL
    const geminiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash-001";

    if (!geminiKey) {
      console.error("Gemini API key missing for chat fallback.");
      throw new Error("Gemini API key not configured");
    }

    const body = {
      contents: [
        {
          parts: [{ text: systemMessage + "\n\n" + userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.2,
      },
    };

    let geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    // simple fallback: if 404 (model not found), try 'gemini-pro'
    if (geminiResp.status === 404) {
      console.warn(`Primary model ${geminiModel} not found (404). Retrying with 'gemini-pro'...`);
      geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
    }

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini error:", geminiResp.status, errText);
      const fallbackReply =
        "I couldn't generate an answer right now. Please try again later.";
      await db.query(
        `INSERT INTO messages (session_id, sender, text) VALUES ($1,$2,$3)`,
        [sessionId, "bot", fallbackReply]
      );
      await db.query(
        `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
        [sessionId]
      );
      return res.status(502).json({
        error: "AI service error",
        details: errText,
        sessionId,
        sessionTitle,
      });
    }

    const geminiData = await geminiResp.json();
    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    const reply =
      aiText ||
      "I couldn't generate an answer right now. Please try again later.";

    await db.query(
      `INSERT INTO messages (session_id, sender, text) VALUES ($1,$2,$3)`,
      [sessionId, "bot", reply]
    );
    await db.query(
      `UPDATE chat_sessions SET started_at = now() WHERE id = $1`,
      [sessionId]
    );

    return res.json({ reply, source: "gemini", sessionId, sessionTitle });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
