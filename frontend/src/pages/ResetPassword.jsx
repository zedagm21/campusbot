import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import PasswordInput from "../components/PasswordInput";
import PasswordStrengthIndicator from "../components/PasswordStrengthIndicator";

export default function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState("idle");
    const [message, setMessage] = useState("");

    // Strength validation state
    const [strength, setStrength] = useState(0);
    const [feedback, setFeedback] = useState([]);

    // Check if passwords match
    const passwordsMatch = password === confirmPassword;
    const isFormValid = password.length >= 8 && passwordsMatch && strength >= 3;

    async function handleSubmit(e) {
        e.preventDefault();
        if (!isFormValid) return;

        setStatus("loading");
        setMessage("");

        try {
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
            await axios.post(`${API_URL}/api/auth/reset-password`, {
                token,
                password,
            });
            setStatus("success");
            setMessage("Password reset successfully!");

            // Redirect after 3 seconds
            setTimeout(() => {
                navigate("/login");
            }, 3000);
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage(err.response?.data?.error || "Failed to reset password. The link may be expired.");
        }
    }

    if (status === "success") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                        <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Success!</h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Your password has been reset. Redirecting to login...
                    </p>
                    <Link to="/login" className="inline-block mt-4 text-teal-600 hover:text-teal-700 dark:text-teal-400">
                        Click here if not redirected
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        Set new password
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Please enter your new password below.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                New Password
                            </label>
                            <PasswordInput
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter new password"
                                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                            />
                            <PasswordStrengthIndicator
                                password={password}
                                onStrengthChange={(s, f) => {
                                    setStrength(s);
                                    setFeedback(f);
                                }}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Confirm Password
                            </label>
                            <PasswordInput
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                className={`appearance-none rounded-lg relative block w-full px-3 py-2 border placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm ${confirmPassword && !passwordsMatch
                                    ? "border-red-300 dark:border-red-500 focus:ring-red-500 focus:border-red-500"
                                    : "border-gray-300 dark:border-gray-600"
                                    }`}
                            />
                            {confirmPassword && !passwordsMatch && (
                                <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                            )}
                        </div>
                    </div>

                    {status === "error" && (
                        <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            {message}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={status === "loading" || !isFormValid}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${status === "loading" || !isFormValid
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 cursor-pointer"
                                }`}
                        >
                            {status === "loading" ? "Resetting..." : "Reset Password"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
