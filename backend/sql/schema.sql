CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT DEFAULT 'student',
  is_verified BOOLEAN DEFAULT false,
  auth_provider TEXT DEFAULT 'email',
  google_id TEXT,
  portal_cookies TEXT,
  portal_username TEXT,
  portal_password_encrypted TEXT,
  reset_password_token TEXT,
  reset_password_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[],
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  started_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES chat_sessions(id),
  sender TEXT,
  text TEXT,
  created_at TIMESTAMP DEFAULT now()
);
