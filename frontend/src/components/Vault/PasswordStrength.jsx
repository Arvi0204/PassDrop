import React from 'react';

export const calculateStrength = (password) => {
    if (!password) return { score: 0, label: 'Empty', color: 'bg-gray-200', textClass: 'text-gray-400' };

    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 14) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (password.length < 8) {
        return { score: 1, label: 'Weak (Too Short)', color: 'bg-rose-500', textClass: 'text-rose-600' };
    }

    if (score <= 2) {
        return { score: 2, label: 'Weak', color: 'bg-amber-500', textClass: 'text-amber-600' };
    }
    if (score <= 4) {
        return { score: 3, label: 'Fair', color: 'bg-blue-500', textClass: 'text-blue-600' };
    }
    return { score: 4, label: 'Strong', color: 'bg-emerald-500', textClass: 'text-emerald-600' };
};

export default function PasswordStrength({ password, showLabel = true }) {
    const { score, label, color, textClass } = calculateStrength(password);

    return (
        <div className="w-full space-y-1.5">
            <div className="flex gap-1.5 h-1.5 w-full">
                {[1, 2, 3, 4].map((step) => (
                    <div
                        key={step}
                        className={`h-full flex-1 rounded-full transition-all duration-300 ${
                            score >= step ? color : 'bg-slate-200'
                        }`}
                    />
                ))}
            </div>
            {showLabel && password && (
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Security:</span>
                    <span className={`font-semibold ${textClass}`}>{label}</span>
                </div>
            )}
        </div>
    );
}
