// frontend/src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthCallback({ onLogin }) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (error) {
            // OAuth failed - redirect to login with error message
            console.error('[OAUTH] Authentication failed:', error);
            navigate(`/login?error=${error}`);
            return;
        }

        if (token) {
            // OAuth successful - store token and redirect to dashboard
            console.log('[OAUTH] Authentication successful, storing token');
            localStorage.setItem('token', token);

            // Call onLogin to update app state
            if (onLogin) {
                onLogin(token);
            }

            // Redirect to home/dashboard
            navigate('/');
        } else {
            // No token or error - redirect to login
            console.error('[OAUTH] No token received');
            navigate('/login?error=no_token');
        }
    }, [searchParams, navigate, onLogin]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Completing sign in...</p>
            </div>
        </div>
    );
}
