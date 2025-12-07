// frontend/src/components/PasswordStrengthIndicator.jsx
import { useMemo, useEffect } from 'react';

export default function PasswordStrengthIndicator({ password, onStrengthChange }) {
    const criteria = useMemo(() => {
        return {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
    }, [password]);

    const metCount = Object.values(criteria).filter(Boolean).length;

    // Report strength back to parent
    useEffect(() => {
        if (onStrengthChange) {
            onStrengthChange(metCount, []);
        }
    }, [metCount, onStrengthChange]);
    const strength = metCount === 0 ? 'none' : metCount <= 2 ? 'weak' : metCount <= 4 ? 'medium' : 'strong';

    const strengthColors = {
        none: 'text-gray-400',
        weak: 'text-red-500',
        medium: 'text-yellow-500',
        strong: 'text-green-500'
    };

    const strengthLabels = {
        none: '',
        weak: 'Weak',
        medium: 'Medium',
        strong: 'Strong'
    };

    if (!password) return null;

    return (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password Strength:
                </span>
                {strength !== 'none' && (
                    <span className={`text-sm font-semibold ${strengthColors[strength]}`}>
                        {strengthLabels[strength]}
                    </span>
                )}
            </div>

            <div className="space-y-1.5">
                <CriteriaItem
                    met={criteria.length}
                    text="At least 8 characters"
                />
                <CriteriaItem
                    met={criteria.uppercase}
                    text="One uppercase letter (A-Z)"
                />
                <CriteriaItem
                    met={criteria.lowercase}
                    text="One lowercase letter (a-z)"
                />
                <CriteriaItem
                    met={criteria.number}
                    text="One number (0-9)"
                />
                <CriteriaItem
                    met={criteria.special}
                    text="One special character (!@#$%^&*)"
                />
            </div>
        </div>
    );
}

function CriteriaItem({ met, text }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            {met ? (
                <svg
                    className="w-4 h-4 text-green-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            ) : (
                <svg
                    className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            )}
            <span className={met ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}>
                {text}
            </span>
        </div>
    );
}
