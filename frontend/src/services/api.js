import axios from "axios";

// 1. Define the URL for your live, deployed backend on Render.
const FALLBACK_API_URL = "https://campusbot-backend-yeqy.onrender.com";

// 2. Safely determine the Base URL:
//    - Use the Vite environment variable (VITE_API_URL) for local development (which should be http://localhost:4000).
//    - If the variable is missing (which happens sometimes in production), ALWAYS fall back to the live Render URL.
const BASE_URL = import.meta.env.VITE_API_URL || FALLBACK_API_URL;

// 3. Create the pre-configured Axios client.
const api = axios.create({
  // Note: We use ${BASE_URL}/api because your routes start with /api (e.g., /api/auth/login)
  baseURL: `${BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  // This is required to handle authentication cookies/sessions correctly.
  withCredentials: true,
});

// 4. Add an interceptor to attach the JWT token (for authentication) automatically.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
