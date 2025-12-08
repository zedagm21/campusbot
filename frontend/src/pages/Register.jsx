import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import GoogleAuthButton from "../components/GoogleAuthButton";
import PasswordInput from "../components/PasswordInput";
import PasswordStrengthIndicator from "../components/PasswordStrengthIndicator";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
      await axios.post(`${API_URL}/api/auth/register`, {
        name,
        email,
        password,
      });

      setMessage("✅ Account created! Check your email for the OTP.");
    } catch (err) {
      console.error(err);
      setMessage("❌ " + (err.response?.data?.error || "Server error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 overflow-hidden">
      <div className="w-full max-w-5xl h-[85vh] max-h-[650px] flex rounded-3xl shadow-2xl overflow-hidden bg-white dark:bg-gray-800">
        {/* Left Form Section */}
        <div className="flex-1 p-6 lg:p-8 flex flex-col justify-center overflow-y-auto">
          {/* Logo */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">CB</span>
              </div>
              <span className="text-2xl font-bold text-gray-800 dark:text-white">
                CampusBot
              </span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white mt-2">
              Create Account
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sign up to get started
            </p>
          </div>

          {/* Social Login */}
          <div className="mb-4">
            <GoogleAuthButton text="Sign up with Google" />
          </div>

          {/* Divider */}
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                or use your email
              </span>
            </div>
          </div>

          {/* Form */}
          <form className="space-y-3.5" onSubmit={handleRegister}>
            <div>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none transition text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full px-4 py-2.5 pr-12 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 outline-none transition text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            {/* Password Strength Indicator */}
            {password && <PasswordStrengthIndicator password={password} />}

            {message && (
              <div
                className={`text-sm text-center p-2.5 rounded-lg ${
                  message.startsWith("✅")
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 text-white font-bold rounded-full transition-all duration-300 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              }`}
            >
              {loading ? "CREATING ACCOUNT..." : "SIGN UP"}
            </button>
          </form>

          {/* Mobile Sign In Link */}
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-5 lg:hidden">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
            >
              Sign In
            </Link>
          </p>
        </div>

        {/* Right Welcome Section */}
        <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-teal-500 to-cyan-600 dark:from-teal-600 dark:to-cyan-700 p-10 flex-col justify-center items-center text-white relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>

          <div className="relative z-10 text-center">
            <h1 className="text-3xl xl:text-4xl font-bold mb-4">
              Hello, Friend!
            </h1>
            <p className="text-teal-100 mb-6 text-base xl:text-lg">
              Enter your personal details and start your journey with us
            </p>
            <Link
              to="/login"
              className="inline-block px-8 py-2.5 border-2 border-white rounded-full font-semibold hover:bg-white hover:text-teal-600 transition-all duration-300"
            >
              SIGN IN
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
