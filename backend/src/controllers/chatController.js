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

// [GEMINI UPDATE] Shared Helper for API calls with Fallback
async function callGeminiWithFallbacks({ systemPrompt, userPrompt, jsonMode = false }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API key not configured");

  // Models to try in order of preference
  const envModel = process.env.GEMINI_MODEL;
  const modelsToTry = [
    envModel,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest"
  ].filter(Boolean);

  const uniqueModels = [...new Set(modelsToTry)];
  console.log("DEBUG: Attempting Gemini with models:", uniqueModels);

  let lastError = null;

  for (const model of uniqueModels) {
    try {
      if (lastError) await new Promise(r => setTimeout(r, 1000));

      const body = {
        contents: [
          {
            parts: [{ text: (systemPrompt ? systemPrompt + "\n\n" : "") + userPrompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: jsonMode ? 500 : 2000,
          temperature: 0.1,
          response_mime_type: jsonMode ? "application/json" : "text/plain",
        },
      };

      console.log(`DEBUG: Trying model ${model}...`);
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (resp.status === 404) throw new Error(`Model ${model} not found (404)`);
      if (resp.status === 503) throw new Error(`Model ${model} overloaded (503)`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`API Error ${resp.status}: ${text}`);
      }

      const data = await resp.json();
      const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidate) throw new Error("Empty response candidate");
      return candidate;

    } catch (err) {
      console.warn(`WARNING: Failed with model ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed.");
}


// --- Gemini Title Generator (Replaces OpenAI) ---
async function generateTitleWithLLM(rawText) {
  const safe = redactPII(String(rawText).slice(0, 500));

  const systemPrompt = "You are a helpful assistant that creates concise 3-5 word titles summarizing a user's question. Return only the title as plain text, no punctuation or commentary.";
  const userPrompt = `Create a very short (3-5 words) title for this student question. Keep it informal and clear.\n\nQuestion: "${safe}"\n\nTitle:`;

  const raw = await callGeminiWithFallbacks({ systemPrompt, userPrompt });

  let title = String(raw)
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^Title:\s*/i, "")
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
  const system = `You are a strict JSON API. You receive a user query and output ONLY a JSON object.

1. MANDATE: SPECIFIC COURSE SEARCH & FILTERING
When the user names a specific course (e.g., "english," "Object Oriented Programming"):
- set "course_filter" to the course name.
- set "detail_level" to "detailed".

2. MANDATE: CONTEXTUAL MEMORY
If the user answers a clarifying question with a simple affirmation ("yes," "correct"), infer context from history.

3. YEAR AND SEMESTER EXTRACTION:
- Extract year numbers (Year 3, 3rd year -> 3)
- Extract semester numbers (sem 2, Semester II -> 2)
- If mentioned, set them. If not, set to null.

4. DETAIL LEVEL RULES:
- "breakdown", "courses", "marks", "details" -> "detailed"
- "GPA", "CGPA", "summary" -> "summary"
- Default -> "detailed"

OUTPUT FORMAT:
{
  "request_type": "get_grade",
  "year": <number|null>,
  "semester": <number|null>,
  "detail_level": "summary" | "detailed",
  "course_filter": <string|null>
}

Do NOT output Markdown code blocks. Do NOT output "Here is the JSON". JUST the JSON object.`;

  // Build conversation context
  let contextStr = "";
  if (conversationHistory && conversationHistory.length > 0) {
    contextStr = "\n\nConversation History (last 3 messages):\n";
    conversationHistory.slice(-3).forEach((msg) => {
      contextStr += `${msg.sender}: ${msg.text}\n`;
    });
  }

  const user = `${contextStr}\nCurrent Student Question: "${userMessage}"\n\nJSON:`;

  try {
    const raw = await callGeminiWithFallbacks({
      systemPrompt: system,
      userPrompt: user,
      jsonMode: true
    });

    console.log("DEBUG: GEMINI Raw Output:", raw);

    // Robust JSON extraction: Find the first '{' and last '}'
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = raw.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonStr);
    }

    // Fallback if no brackets found (unlikely with strict prompt)
    throw new Error("No JSON object found in response");

  } catch (e) {
    console.error("Failed to parse GEMINI JSON:", e);
    return {};
  }
}




/**
 * POST /api/chat
 * Responds with { reply, source, sessionId, sessionTitle? }
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

    // safe message count for logging
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

      // generate title
      if (useLLMTitle) {
        try {
          const llmTitle = await generateTitleWithLLM(userMessageSafe);
          sessionTitle = llmTitle;
          await db.query(`UPDATE chat_sessions SET title = $1 WHERE id = $2`, [
            llmTitle,
            sessionId,
          ]);
        } catch (llmErr) {
          console.error("LLM title generation failed, falling back to local:", llmErr.message);
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
        // invalid session -> create new
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
            console.error("LLM title generation failed, falling back to local:", llmErr.message);
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
        // session exists
        sessionTitle = sCheck.rows[0].title || null;
        if (!sessionTitle) {
          const msgCountRes = await db.query(
            `SELECT COUNT(*) AS cnt FROM messages WHERE session_id = $1`,
            [sessionId]
          );
          const count = Number(msgCountRes.rows[0].cnt || 0);
          if (count === 0) {
            if (useLLMTitle) {
              try {
                const llmTitle = await generateTitleWithLLM(userMessageSafe);
                sessionTitle = llmTitle;
                await db.query(
                  `UPDATE chat_sessions SET title = $1 WHERE id = $2`,
                  [llmTitle, sessionId]
                );
              } catch (llmErr) {
                console.error("LLM title generation failed, falling back to local:", llmErr.message);
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

    // ---------- 0) Login intent ----------
    if (msgLower.startsWith("login ")) {
      const parts = message.trim().split(/\s+/);
      if (parts.length >= 3) {
        const username = parts[1];
        const password = parts.slice(2).join(" ");

        const loginRes = await PortalLoginService.loginToPortal(
          username,
          password
        );

        if (loginRes.success) {
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

    // ---------- 1) Registration-intent ----------
    const registrationKeywords = [
      "register",
      "registration",
      "enroll",
      "enrol",
      "when is registration",
      "registration date",
      "how do i register",
    ];
    if (registrationKeywords.some((k) => msgLower.includes(k))) {
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

    // ---------- 2) Portal/Grades intent ----------
    const gradesRegex =
      /(grade|cgpa|gpa|result|mark|score|garde|status|breakdown|courses|subjects|semester)/i;

    if (gradesRegex.test(msgLower)) {
      // Check cookies/creds
      const userRes = await db.query(
        `SELECT portal_cookies, portal_username, portal_password_encrypted FROM users WHERE id = $1`,
        [userId]
      );
      const userData = userRes.rows[0];
      let cookiesJson = userData?.portal_cookies;
      const encryptedPass = userData?.portal_password_encrypted;
      const portalUser = userData?.portal_username;

      // Auto-login if needed
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

      // LLM Extraction
      let options = {};
      try {
        const historyRes = await db.query(
          `SELECT sender, text FROM messages 
           WHERE session_id = $1 
           ORDER BY created_at DESC 
           LIMIT 6`,
          [sessionId]
        );
        const conversationHistory = historyRes.rows.reverse();

        options = await extractGradeParamsWithLLM(
          userMessageSafe,
          conversationHistory
        );
        console.log("DEBUG: LLM Extracted options:", options);
      } catch (err) {
        console.error("LLM extraction failed, options={}:", err.message);
      }

      // Fetch grades
      try {
        let cookies = JSON.parse(cookiesJson);
        let gradesResult = await PortalLoginService.fetchGrades(
          cookies,
          options
        );

        // Retry login if failed
        if (!gradesResult.success && encryptedPass && portalUser) {
          console.log("Fetch failed. Attempting auto-re-login...");
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
                await db.query(
                  `UPDATE users SET portal_cookies = $1 WHERE id = $2`,
                  [JSON.stringify(cookies), userId]
                );
                gradesResult = await PortalLoginService.fetchGrades(
                  cookies,
                  options
                );
              }
            }
          } catch (retryErr) {
            console.error("Error during re-login retry:", retryErr);
          }
        }

        if (!gradesResult.success) {
          const reply = "I found an issue with your current portal session. Please re-login in Portal Settings.";
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

        // Success formatting
        const gradesData = gradesResult.data;
        let reply = "";

        if (!gradesData || gradesData.length === 0) {
          reply = "I successfully accessed the portal, but I couldn't find any grade records for the specified year/semester.";
        } else {
          const detailLevel = options.detail_level || "summary";
          const courseFilter = options.course_filter || null;

          const formattedParts = [];
          let foundAnyCourse = false;

          for (const g of gradesData) {
            if (courseFilter) {
              if (g.courses && g.courses.length > 0) {
                const filterLower = courseFilter.toLowerCase();
                const matchingCourses = g.courses.filter((c) => {
                  const title = (c.CourseTitle || "").toLowerCase();
                  const code = (c.CourseCode || "").toLowerCase();
                  return (title.includes(filterLower) || code.includes(filterLower));
                });

                if (matchingCourses.length > 0) {
                  foundAnyCourse = true;
                  const courseLines = matchingCourses
                    .map((c) => {
                      const name = c.CourseTitle || c.CourseName || "Unknown Course";
                      const code = c.CourseCode || "";
                      const grade = c.LetterGrade || c.Letter || c.Grade || c.StudentGrade || "-";
                      return `${name} (${code}): ${grade}`;
                    })
                    .join("\n");
                  formattedParts.push(`Year ${g.batch}, Semester ${g.semester}\n${courseLines}`);
                }
              }
            } else {
              let text = `Year ${g.batch}, Semester ${g.semester}\n`;
              text += `• GPA: ${g.semesterGpa}\n`;
              text += `• CGPA: ${g.cgpa}\n`;
              text += `• Status: ${g.status}`;

              if (detailLevel === "detailed" && g.courses && g.courses.length > 0) {
                text += `\n\nCourse Breakdown:\n`;
                text += g.courses
                  .map((c) => {
                    const name = c.CourseTitle || c.CourseName || "Unknown Course";
                    const code = c.CourseCode || "";
                    const grade = c.LetterGrade || c.Letter || c.Grade || c.StudentGrade || "-";
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
            reply = foundAnyCourse ? formattedParts.join("\n\n---\n\n") : `I couldn't find any course matching "${courseFilter}" in your records.`;
          } else {
            reply = "Here are your results:\n\n" + formattedParts.join("\n\n---\n\n");
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
        const reply = "I encountered an error while fetching your grades. Please try again later.";
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

    // ---------- 4) Gemini fallback (with Retry/Fallback) ----------
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

    const aiText = await callGeminiWithFallbacks({ systemPrompt: systemMessage, userPrompt });
    const reply = aiText || "I couldn't generate an answer right now. Please try again later.";

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
