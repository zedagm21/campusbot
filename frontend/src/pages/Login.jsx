import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import GoogleAuthButton from "../components/GoogleAuthButton";
import PasswordInput from "../components/PasswordInput";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const r = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password: pw,
      });

      const token = r.data.token;
      if (token) {
        localStorage.setItem("token", token);
        onLogin(token);
        navigate("/");
      } else {
        setErr("No token returned");
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 overflow-hidden">
      <div className="w-full max-w-5xl h-[85vh] max-h-[650px] flex rounded-3xl shadow-2xl overflow-hidden bg-white dark:bg-gray-800">
        {/* Left Welcome Section */}
        <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-teal-500 to-cyan-600 dark:from-teal-600 dark:to-cyan-700 p-10 flex-col justify-center items-center text-white relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>

          <div className="relative z-10 text-center">
            <h1 className="text-3xl xl:text-4xl font-bold mb-4">Welcome Back!</h1>
            <p className="text-teal-100 mb-6 text-base xl:text-lg">
              To keep connected with us please login with your personal info
            </p>
            <Link
              to="/register"
              className="inline-block px-8 py-2.5 border-2 border-white rounded-full font-semibold hover:bg-white hover:text-teal-600 transition-all duration-300"
            >
              SIGN UP
            </Link>
          </div>
        </div>

        {/* Right Form Section */}
        <div className="flex-1 p-6 lg:p-8 flex flex-col justify-center overflow-y-auto">
          {/* Logo */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">CB</span>
              </div>
              <span className="text-2xl font-bold text-gray-800 dark:text-white">CampusBot</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white mt-2">Sign In</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Use your account</p>
          </div>

          {/* Social Login */}
          <div className="mb-4">
            <GoogleAuthButton text="Sign in with Google" />
          </div>

          {/* Divider */}
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">or use your email</span>
            </div>
          </div>

          {/* Form */}
          <form className="space-y-3.5" onSubmit={submit}>
            <div>
              <input
                type="email"
                required
                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none transition text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <PasswordInput
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Password"
                required
                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none transition text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
              >
                Forgot Password?
              </Link>
            </div>

            {err && (
              <div className="text-red-500 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 text-white font-bold rounded-full transition-all duration-300 ${loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                }`}
            >
              {loading ? "SIGNING IN..." : "SIGN IN"}
            </button>
          </form>

          {/* Mobile Sign Up Link */}
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-5 lg:hidden">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
