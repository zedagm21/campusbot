// backend/src/config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import db from "../db.js";

/**
 * Configure Passport Google OAuth 2.0 Strategy
 * This handles the OAuth flow and user authentication/provisioning
 */
export function configurePassport() {
    // Serialize user for session (not used in stateless JWT auth, but required by Passport)
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from session (not used in stateless JWT auth, but required by Passport)
    passport.deserializeUser(async (id, done) => {
        try {
            const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
            done(null, result.rows[0]);
        } catch (error) {
            done(error, null);
        }
    });

    // Configure Google OAuth Strategy
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID || "",
                clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
                callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/api/auth/google/callback",
                scope: ["profile", "email"],
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    console.log("[GOOGLE_AUTH] OAuth callback received");
                    console.log(`[GOOGLE_AUTH] Google ID: ${profile.id}`);

                    // Extract email from Google profile
                    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

                    if (!email) {
                        console.error("[GOOGLE_AUTH] No email found in Google profile");
                        return done(new Error("No email found in Google profile"), null);
                    }

                    console.log(`[GOOGLE_AUTH] Email: ${email}`);
                    const name = profile.displayName || email.split("@")[0];

                    // Check if user already exists (by email)
                    let userResult = await db.query(
                        "SELECT * FROM users WHERE email = $1 LIMIT 1",
                        [email.toLowerCase()]
                    );

                    let user;

                    if (userResult.rowCount > 0) {
                        // User exists - update Google ID if not set
                        user = userResult.rows[0];
                        console.log(`[GOOGLE_AUTH] Existing user found: ${user.email}`);

                        if (!user.google_id) {
                            console.log(`[GOOGLE_AUTH] Updating Google ID for existing user`);
                            await db.query(
                                "UPDATE users SET google_id = $1, auth_provider = 'google', is_verified = true WHERE id = $2",
                                [profile.id, user.id]
                            );
                            user.google_id = profile.id;
                            user.auth_provider = "google";
                            user.is_verified = true;
                        }
                    } else {
                        // Just-in-time (JIT) user provisioning: create new user
                        console.log(`[GOOGLE_AUTH] Creating new user via JIT provisioning`);

                        const insertResult = await db.query(
                            `INSERT INTO users (email, name, google_id, auth_provider, is_verified, created_at)
               VALUES ($1, $2, $3, 'google', true, now())
               RETURNING *`,
                            [email.toLowerCase(), name, profile.id]
                        );

                        user = insertResult.rows[0];
                        console.log(`[GOOGLE_AUTH] New user created: ${user.email} (ID: ${user.id})`);
                    }

                    // Return user to Passport
                    return done(null, user);
                } catch (error) {
                    console.error("[GOOGLE_AUTH] Error in OAuth callback:", error);
                    return done(error, null);
                }
            }
        )
    );

    console.log("[PASSPORT] Google OAuth strategy configured");
}
