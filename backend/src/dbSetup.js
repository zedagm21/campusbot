// src/dbSetup.js - Runs initial database schema creation
import { Pool } from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Fix for ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
const oauthMigrationPath = path.join(__dirname, "..", "add_oauth_columns.sql");

async function runSchemaSetup() {
  console.log("[DB Setup] Starting database schema initialization...");

  try {
    // 1. Read and execute the initial schema creation script
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    await pool.query(schemaSql);
    console.log("[DB Setup] ✅ Initial schema.sql executed successfully.");

    // 2. Read and execute the OAuth migration script
    let migrationSql = fs.readFileSync(oauthMigrationPath, "utf-8");

    // CRITICAL FIX: Strip all comments, psql commands, and problematic SELECT statements
    migrationSql = migrationSql
      .split("\n")
      .filter(
        (line) =>
          !line.trim().startsWith("--") &&
          !line.trim().startsWith("\\d") &&
          !line.trim().startsWith("SELECT")
      )
      .join("\n");

    await pool.query(migrationSql);
    console.log(
      "[DB Setup] ✅ add_oauth_columns.sql migration executed successfully."
    );

    console.log("[DB Setup] Database setup complete. Tables created.");
  } catch (err) {
    // Crucial: Handle errors where tables/columns already exist to prevent failure
    if (err.code === "42P07") {
      console.log("[DB Setup] Tables already exist. Skipping initialization.");
    } else if (
      err.message.includes(
        'column "google_id" of relation "users" already exists'
      )
    ) {
      console.log(
        "[DB Setup] OAuth columns already exist. Skipping migration."
      );
    } else {
      console.error("[DB Setup] ❌ FATAL ERROR during DB setup:", err.message);
      throw err;
    }
  } finally {
    await pool.end(); // Close the pool after setup
  }
}

// Check if the script is being run directly
if (process.argv[1] === __filename) {
  runSchemaSetup().catch((err) => {
    console.error("[DB Setup] Script execution failed:", err);
    process.exit(1);
  });
}

export default runSchemaSetup;
