import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("idle"); // idle, loading, success, error
    const [message, setMessage] = useState("");

    async function handleSubmit(e) {
        e.preventDefault();
        if (!email) return;

        setStatus("loading");
        setMessage("");

        try {
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
            const res = await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
            setStatus("success");
            setMessage(res.data.message);
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage(err.response?.data?.error || "Failed to send reset link. Please try again.");
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        Reset your password
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>
                </div>

                {status === "success" ? (
                    <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                                    Check your email
                                </h3>
                                <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                                    <p>{message}</p>
                                </div>
                                <div className="mt-4">
                                    <Link to="/login" className="text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-500">
                                        &larr; Back to login
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email-address" className="sr-only">
                                Email address
                            </label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={status === "loading"}
                            />
                        </div>

                        {status === "error" && (
                            <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                {message}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={status === "loading"}
                                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${status === "loading"
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 cursor-pointer"
                                    }`}
                            >
                                {status === "loading" ? "Sending..." : "Send Reset Link"}
                            </button>
                        </div>

                        <div className="text-center">
                            <Link to="/login" className="font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400">
                                Back to login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
