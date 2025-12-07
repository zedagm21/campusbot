import axios from "axios";
import * as cheerio from "cheerio";

class PortalLoginService {
  constructor() {
    this.baseUrl = "https://studentportal.bdu.edu.et";
  }

  /**
   * STEP 1 — Login to the portal (GET + POST)
   */
  async loginToPortal(username, password) {
    try {
      const loginUrl = `${this.baseUrl}/Account/Login`;

      // 1️⃣ Load login page (to get cookies + hidden token)
      const loginPage = await axios.get(loginUrl, {
        withCredentials: true,
      });

      const initialCookies = loginPage.headers["set-cookie"];
      const $ = cheerio.load(loginPage.data);

      // Extract anti-forgery token
      const token = $('input[name="__RequestVerificationToken"]').val();
      if (!token) {
        throw new Error("Could not extract verification token.");
      }

      // 2️⃣ Submit login form
      const formBody = new URLSearchParams({
        __RequestVerificationToken: token,
        Username: username,
        Password: password,
      });

      const loginResponse = await axios.post(loginUrl, formBody, {
        headers: {
          Cookie: initialCookies.join("; "),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxRedirects: 0,
        validateStatus: (status) => status <= 303,
      });

      // 3️⃣ Extract new session cookies
      const authCookies = loginResponse.headers["set-cookie"];
      if (!authCookies) {
        throw new Error("Invalid username or password.");
      }

      return {
        success: true,
        cookies: authCookies,
      };
    } catch (err) {
      console.error("Portal login failed:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * STEP 2 — Fetch portal data using cookies
   */
  async fetchPortalData(cookies, endpoint) {
    try {
      const url = `${this.baseUrl}/${endpoint}`;

      const res = await axios.get(url, {
        headers: {
          Cookie: cookies.join("; "),
        },
      });

      return {
        success: true,
        data: res.data,
      };
    } catch (err) {
      console.error("Portal fetch failed:", err.message);
      console.error("Error details:", {
        status: err.response?.status,
        statusText: err.response?.statusText,
        endpoint: endpoint,
        errorCode: err.code
      });
      return {
        success: false,
        error: `Failed to fetch data from student portal: ${err.message}`,
      }
    }
  }

  /**
   * STEP 3 — Fetch and parse grades from portal API
   * @param {Array} cookies - Session cookies
   * @param {Object} options - { year: number, semester: string }
   */
  async fetchGrades(cookies, options = {}) {
    try {
      // 1. Get Curriculum Info
      console.log("Fetching curriculum info...");
      const currResult = await this.fetchPortalData(cookies, "RegistrationSummary/GetCurriculumInfo");

      if (!currResult.success || !currResult.data || !currResult.data.data || currResult.data.data.length === 0) {
        console.error("❌ Curriculum fetch failed.");
        return { success: false, error: currResult.error || "Failed to fetch curriculum info" };
      }
      const curriculumCode = currResult.data.data[0].CurriculumTblCode;
      console.log("Found CurriculumCode:", curriculumCode);

      // 2. Get Student Basic Info
      console.log("Fetching student basic info...");
      const basicInfoResult = await this.fetchPortalData(cookies, `RegistrationSummary/GetStudentBasicInfo?curriculumCode=${curriculumCode}`);
      if (!basicInfoResult.success || !basicInfoResult.data || !basicInfoResult.data.data || basicInfoResult.data.data.length === 0) {
        return { success: false, error: "Failed to fetch student basic info" };
      }
      const studentCurriculumCode = basicInfoResult.data.data[0].StudentCurriculumTblCode;
      console.log("Found StudentCurriculumCode:", studentCurriculumCode);

      // 3. Get Student Registration (Grades)
      console.log("Fetching registration/grade history...");
      const regResult = await this.fetchPortalData(cookies, `RegistrationSummary/GetStudentRegistration?studentCurriculumCode=${studentCurriculumCode}`);
      if (!regResult.success || !regResult.data || !regResult.data.data) {
        return { success: false, error: "Failed to fetch registration history" };
      }

      const registrations = regResult.data.data;
      if (registrations.length === 0) {
        return { success: true, data: { cgpa: "N/A", semesterGpa: "N/A", status: "N/A" } };
      }

      // Sort by RegistrationDate descending to get the latest
      registrations.sort((a, b) => new Date(b.RegistrationDate) - new Date(a.RegistrationDate));

      let results = [];

      if (options.year || options.semester) {
        results = registrations.filter(r => {
          // Match Year (Batch)
          const matchYear = options.year ? r.Batch === parseInt(options.year) : true;

          // Match Semester (I, II, III or 1, 2, 3)
          let matchSemester = true;
          if (options.semester) {
            const sem = String(options.semester).toUpperCase();
            // Normalize '1' to 'I', '2' to 'II' if needed, or just check inclusion
            const romanSem = sem === '1' ? 'I' : sem === '2' ? 'II' : sem === '3' ? 'III' : sem;
            matchSemester = r.Semester === romanSem || r.Semester === sem;
          }

          return matchYear && matchSemester;
        });

        if (results.length === 0) {
          return {
            success: false,
            error: `Could not find grades for Year ${options.year || 'Any'}, Semester ${options.semester || 'Any'}`
          };
        }
      } else {
        // CRITICAL: If a course_filter is specified, search ALL semesters
        // Otherwise, default to latest registration
        if (options.course_filter) {
          console.log(`Course filter detected: "${options.course_filter}". Searching ALL semesters...`);
          results = registrations; // Fetch all registrations for comprehensive search
        } else {
          // Default: Find the latest registration that actually has grades
          const latest = registrations.find(r => r.CGPA !== null || r.SGPA !== null) || registrations[0];
          if (latest) results.push(latest);
        }
      }

      // Map results to cleaner format
      const data = await Promise.all(results.map(async (targetRegistration) => {
        let courses = [];

        // ALWAYS try to fetch detailed course grades ONLY IF detail_level is 'detailed'
        const detailLevel = options.detail_level || "summary";

        if (detailLevel === "detailed") {
          // Log the raw registration object to see if we missed anything
          // console.log("Target Registration Raw:", JSON.stringify(targetRegistration, null, 2));

          // Try multiple possible endpoint patterns
          const endpointPatterns = [
            `RegistrationSummary/GetStudentGradeBySemester?studentCurriculumCode=${studentCurriculumCode}&academicYear=${targetRegistration.Batch}&semester=${targetRegistration.Semester}`,
            `RegistrationSummary/GetSemesterResult?studentCurriculumCode=${studentCurriculumCode}&year=${targetRegistration.Batch}&semester=${targetRegistration.Semester}`,
            `RegistrationSummary/GetStudentSemesterGrade?studentCurriculumCode=${studentCurriculumCode}&batch=${targetRegistration.Batch}&semester=${targetRegistration.Semester}`,
            `RegistrationSummary/GetDetailRegistration?studentCurriculumCode=${studentCurriculumCode}&batch=${targetRegistration.Batch}&semester=${targetRegistration.Semester}`,
            `RegistrationSummary/GetCourses?studentCurriculumCode=${studentCurriculumCode}&batch=${targetRegistration.Batch}&semester=${targetRegistration.Semester}`,
            // Additional guesses
            `RegistrationSummary/GetStudentGrade?studentCurriculumCode=${studentCurriculumCode}&academicYear=${targetRegistration.Batch}&semester=${targetRegistration.Semester}`,
            `RegistrationSummary/GetGradeReport?studentCurriculumCode=${studentCurriculumCode}&academicYear=${targetRegistration.Batch}&semester=${targetRegistration.Semester}`
          ];

          for (const endpoint of endpointPatterns) {
            try {
              // console.log("Trying endpoint:", endpoint);
              const detailRes = await this.fetchPortalData(cookies, endpoint);
              if (detailRes.success && detailRes.data && detailRes.data.data && detailRes.data.data.length > 0) {
                courses = detailRes.data.data;
                console.log(`Success! Found ${courses.length} courses via API: ${endpoint}`);
                break;
              }
            } catch (e) {
              // console.error(`Endpoint ${endpoint} failed:`, e.message);
            }
          }

          // NEW: Try GetRegisteredCourses with RegistrationCode from targetRegistration
          if (courses.length === 0 && targetRegistration.RegistrationCode) {
            try {
              // console.log("Trying GetRegisteredCourses with RegistrationCode:", targetRegistration.RegistrationCode);
              const registeredCoursesRes = await this.fetchPortalData(
                cookies,
                `RegistrationSummary/GetRegisteredCourses?registrationCode=${targetRegistration.RegistrationCode}`
              );

              if (registeredCoursesRes.success && registeredCoursesRes.data && registeredCoursesRes.data.data) {
                courses = registeredCoursesRes.data.data;
                console.log(`Success! Found ${courses.length} courses via GetRegisteredCourses`);
              }
            } catch (e) {
              console.error("GetRegisteredCourses failed:", e.message);
            }
          }

          // Fallback: Try to scrape the AcademicSumamry page
          if (courses.length === 0) {
            console.log("API endpoints failed. Trying to scrape AcademicSumamry page...");
            try {
              const pageRes = await this.fetchPortalData(cookies, "Report/StudentLevel/AcademicSumamry");
              if (pageRes.success) {
                const $ = cheerio.load(pageRes.data);

                let courseRows = [];

                // Look for DevExpress dataSource in script tags
                $('script').each((i, script) => {
                  const scriptContent = $(script).html();
                  if (scriptContent && (scriptContent.includes('Detail Registration') || scriptContent.includes('dataSource'))) {

                    // DevExpress stores data in the dataSource property
                    // Look for: "dataSource":[{...},{...}]
                    // Improved regex to capture larger JSON blocks
                    const dataSourceMatch = scriptContent.match(/"dataSource"\s*:\s*(\[[^\]]+\])/);

                    if (dataSourceMatch) {
                      try {
                        const dataSourceJSON = dataSourceMatch[1];
                        const courseData = JSON.parse(dataSourceJSON);

                        // Filter for the correct semester if possible, or just take all if it matches our target
                        // Since we are scraping a summary page, it might have ALL history. 
                        // We need to filter by the current targetRegistration batch/semester if those fields exist in the scraped data.

                        courseData.forEach(course => {
                          // Check if this course belongs to the target semester (if data has year/sem info)
                          // Many times the dataSource is just for the grid being rendered.
                          // We will assume if it's a "Detail Registration" grid, it might be relevant.

                          // Map fields
                          courseRows.push({
                            CourseCode: course.CourseCode || course.Code || "",
                            CourseTitle: course.CourseTitle || course.Title || course.CourseName || "",
                            Letter: course.Letter || course.Grade || course.StudentGrade || "-",
                            Grade: course.Letter || course.Grade || course.StudentGrade || "-",
                            StudentGrade: course.Letter || course.Grade || course.StudentGrade || "-"
                          });
                        });
                      } catch (e) {
                        // console.error("Failed to parse dataSource JSON:", e);

                        // Fallback: Use regex to extract individual fields
                        const courseRegex = /\{[^{}]*(?:CourseTitle|Title)[^{}]*\}/g;
                        const matches = scriptContent.match(courseRegex);

                        if (matches) {
                          matches.forEach(m => {
                            const titleMatch = m.match(/(?:CourseTitle|Title)\s*[:=]\s*["']([^"']+)["']/i);
                            const codeMatch = m.match(/(?:CourseCode|Code)\s*[:=]\s*["']([^"']+)["']/i);
                            const gradeMatch = m.match(/(?:Letter|Grade|StudentGrade)\s*[:=]\s*["']([^"']+)["']/i);

                            if (titleMatch) {
                              courseRows.push({
                                CourseTitle: titleMatch[1],
                                CourseCode: codeMatch ? codeMatch[1] : "",
                                Letter: gradeMatch ? gradeMatch[1] : "-",
                                Grade: gradeMatch ? gradeMatch[1] : "-",
                                StudentGrade: gradeMatch ? gradeMatch[1] : "-"
                              });
                            }
                          });
                        }
                      }
                    }
                  }
                });

                if (courseRows.length > 0) {
                  console.log(`Scraped ${courseRows.length} courses from HTML`);
                  courses = courseRows;
                }
              }
            } catch (scrapeErr) {
              console.error("Scraping failed:", scrapeErr);
            }
          }
        } else {
          // console.log("Skipping detailed course fetch for summary view.");
        }

        // If no courses found via API/Scraping, check if they're embedded in the registration object
        if (courses.length === 0 && targetRegistration.Courses) {
          courses = targetRegistration.Courses;
          console.log("Using embedded course data");
        }

        return {
          cgpa: targetRegistration.CGPA || "N/A",
          semesterGpa: targetRegistration.SGPA || "N/A",
          status: targetRegistration.FinalStatus || targetRegistration.RegCondition || "N/A",
          batch: targetRegistration.Batch,
          semester: targetRegistration.Semester,
          courses: courses,
          raw: targetRegistration,
          // rawHtml: JSON.stringify(targetRegistration) // Remove to save bandwidth
        };
      }));

      return {
        success: true,
        data: data
      };

    } catch (err) {
      console.error("Fetch grades API sequence failed:", err);
      return {
        success: false,
        error: "Failed to fetch grades data via API"
      };
    }
  }
}

export default new PortalLoginService();
