import React from 'react';

export const calculateStrength = (password) => {
    if (!password) {
        return {
            score: 0,
            label: 'Empty',
            barClass: 'bg-white/60',
            badgeClass: 'bg-white/60 text-[#3a5566] border-white/80'
        };
    }

    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 14) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (password.length < 8) {
        return {
            score: 1,
            label: 'Weak (Too Short)',
            barClass: 'bg-gradient-to-r from-rose-500 to-rose-400 shadow-xs shadow-rose-500/20',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
        };
    }

    if (score <= 2) {
        return {
            score: 2,
            label: 'Weak',
            barClass: 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-xs shadow-amber-500/20',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
        };
    }
    if (score <= 4) {
        return {
            score: 3,
            label: 'Good',
            barClass: 'bg-gradient-to-r from-[#112838] to-[#285d77] shadow-xs shadow-[#112838]/20',
            badgeClass: 'bg-[#d0e4ee] text-[#0e293a] border-[#b8d6e5]'
        };
    }
    return {
        score: 4,
        label: 'Strong',
        barClass: 'bg-gradient-to-r from-emerald-600 to-teal-500 shadow-xs shadow-emerald-500/20',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    };
};

export default function PasswordStrength({ password, showLabel = true }) {
    const { score, label, barClass, badgeClass } = calculateStrength(password);

    return (
        <div className="w-full space-y-2">
            <div className="flex gap-1.5 h-1.5 w-full">
                {[1, 2, 3, 4].map((step) => (
                    <div
                        key={step}
                        className={`h-full flex-1 rounded-full transition-all duration-300 ${
                            score >= step ? barClass : 'bg-white/50 border border-white/60'
                        }`}
                    />
                ))}
            </div>
            {showLabel && password && (
                <div className="flex justify-between items-center text-xs">
                    <span className="text-[#3a5566] font-semibold text-[11px] uppercase tracking-wider">
                        Security
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${badgeClass}`}>
                        {label}
                    </span>
                </div>
            )}
        </div>
    );
}
