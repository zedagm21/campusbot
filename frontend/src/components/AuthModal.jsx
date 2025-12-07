import React, { useState } from 'react';
import PasswordInput from './PasswordInput';
import axios from 'axios';

export default function AuthModal({ isOpen, onClose, onLogin, status, onStatusChange }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await onLogin(username, password);
            onClose();
        } catch (err) {
            setError(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
            await axios.post(
                `${API_URL}/api/portal/disconnect`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            // Clear form fields
            setUsername('');
            setPassword('');
            setShowDisconnectConfirm(false);

            // Notify parent component to update status
            if (onStatusChange) {
                onStatusChange('disconnected');
            }

            // Close modal
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to disconnect");
            setShowDisconnectConfirm(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    ✕
                </button>

                <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Portal Settings</h2>

                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-md flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Status:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                        }`}>
                        {status === 'active' ? '● Connected' : '● Disconnected'}
                    </span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Portal Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="e.g. UGR/1234/12"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Portal Password</label>
                        <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    {error && (
                        <div className="text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <div className="pt-2 space-y-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${loading ? 'opacity-75 cursor-not-allowed' : ''
                                }`}
                        >
                            {loading ? 'Connecting...' : 'Save & Connect'}
                        </button>

                        {/* Disconnect Button */}
                        {status === 'active' && (
                            <button
                                type="button"
                                onClick={() => setShowDisconnectConfirm(true)}
                                className="w-full py-2 px-4 border border-red-300 dark:border-red-700 rounded-md shadow-sm text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                🔓 Disconnect Portal Account
                            </button>
                        )}
                    </div>
                </form>

                {/* Disconnect Confirmation Dialog */}
                {showDisconnectConfirm && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                Disconnect Portal Account?
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                This will remove your portal credentials from CampusBot. You'll need to re-enter them to access portal features.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDisconnectConfirm(false)}
                                    className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    disabled={loading}
                                    className="flex-1 py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-75"
                                >
                                    {loading ? 'Disconnecting...' : 'Disconnect'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
