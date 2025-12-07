// src/db.js
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config(); // Load environment variables from .env file

const { Pool } = pkg;

// Create a new PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Export a reusable query helper and the pool itself
export default {
  query: (text, params) => pool.query(text, params),
  pool,
};
