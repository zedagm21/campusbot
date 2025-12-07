import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Settings.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function Settings() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [status, setStatus] = useState(null); // { connected, username }
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }

    // Fetch portal connection status on mount
    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                setMessage({ type: "error", text: "Not authenticated. Please log in again." });
                return;
            }
            const res = await axios.get(`${API_URL}/api/settings/portal/status`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setStatus(res.data);
        } catch (err) {
            console.error("Failed to fetch status:", err);
            if (err.response?.status === 401) {
                setMessage({ type: "error", text: "Not authenticated. Please log in again." });
            } else {
                setMessage({ type: "error", text: "Failed to load portal status" });
            }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post(
                `${API_URL}/api/settings/portal`,
                { username, password },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setMessage({ type: "success", text: res.data.message });
            setPassword(""); // Clear password field
            fetchStatus(); // Refresh status
        } catch (err) {
            const errorMsg = err.response?.data?.error || "Failed to save credentials";
            setMessage({ type: "error", text: errorMsg });
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect your portal account?")) {
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const token = localStorage.getItem("token");
            const res = await axios.delete(`${API_URL}/api/settings/portal`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setMessage({ type: "success", text: res.data.message });
            setUsername("");
            setPassword("");
            fetchStatus(); // Refresh status
        } catch (err) {
            const errorMsg = err.response?.data?.error || "Failed to disconnect";
            setMessage({ type: "error", text: errorMsg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="settings-container">
            <div className="settings-card">
                <h1>Portal Settings</h1>

                {/* Connection Status */}
                <div className="status-section">
                    <h2>Connection Status</h2>
                    {status ? (
                        <div className={`status-badge ${status.connected ? "connected" : "disconnected"}`}>
                            {status.connected ? (
                                <>
                                    <span className="status-icon">✅</span>
                                    <span>Connected as <strong>{status.username}</strong></span>
                                </>
                            ) : (
                                <>
                                    <span className="status-icon">❌</span>
                                    <span>Not Connected</span>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="status-badge loading">Loading...</div>
                    )}
                </div>

                {/* Credentials Form */}
                <div className="credentials-section">
                    <h2>{status?.connected ? "Update Credentials" : "Link Portal Account"}</h2>
                    <form onSubmit={handleSave}>
                        <div className="form-group">
                            <label htmlFor="username">Portal Username</label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder={status?.username || "Enter your portal username"}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Portal Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your portal password"
                                required
                            />
                        </div>

                        {message && (
                            <div className={`message ${message.type}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="button-group">
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? "Saving..." : status?.connected ? "Update Credentials" : "Link Account"}
                            </button>

                            {status?.connected && (
                                <button
                                    type="button"
                                    className="btn-danger"
                                    onClick={handleDisconnect}
                                    disabled={loading}
                                >
                                    Disconnect
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Info Section */}
                <div className="info-section">
                    <p className="info-text">
                        <strong>Why link your portal?</strong> By linking your university portal account,
                        the chatbot can fetch your grades, profile, and other personalized information
                        without asking you to log in every time.
                    </p>
                    <p className="info-text security">
                        🔒 Your credentials are encrypted and stored securely.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Settings;
