import axios from "axios";

// 1. Define the URL for your live, deployed backend on Render.
// This acts as the fallback if the environment variable is not set.
const FALLBACK_API_URL = "https://campusbot-backend-yeqy.onrender.com";

// 2. Safely determine the Base URL:
//    - Use the Vite environment variable (VITE_API_URL) which should be set
//      to the live Render URL during deployment.
//    - If the variable is missing (which happens sometimes in production),
//      ALWAYS fall back to the live Render URL.
const BASE_URL = import.meta.env.VITE_API_URL || FALLBACK_API_URL;

// 3. Create the pre-configured Axios client.
const api = axios.create({
  // We combine the base URL with the /api route prefix here.
  // Ensure your VITE_API_URL environment variable does NOT end with /api
  baseURL: `${BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  }, // This is required to handle authentication cookies/sessions correctly.
  withCredentials: true /* // NOTE ON SSL ERROR: If you encounter the net::ERR_SSL_BAD_RECORD_MAC_ALERT // again, you may need to reintroduce explicit HTTPS agent configuration // (though this is often not needed for standard production deployments):
  httpsAgent: new (require('https').Agent)({
    rejectUnauthorized: false,
  }),
  */,
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
