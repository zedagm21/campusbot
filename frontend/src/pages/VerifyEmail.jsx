// frontend/src/pages/VerifyEmail.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [status, setStatus] = useState("Verifying...");
  const navigate = useNavigate();

  useEffect(() => {
    async function verify() {
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
        const res = await axios.post(
          `${API_URL}/api/auth/verify-link`,
          { token, email }
        );
        setStatus("Verified! Logging you in...");
        localStorage.setItem("token", res.data.token);
        // optionally store user
        setTimeout(() => navigate("/"), 1000);
      } catch (err) {
        setStatus(err.response?.data?.error || "Verification failed");
      }
    }
    if (token && email) verify();
    else setStatus("Invalid verification link");
  }, [token, email, navigate]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Email verification</h2>
      <p>{status}</p>
    </div>
  );
}
