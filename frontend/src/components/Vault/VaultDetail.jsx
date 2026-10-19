import React, { useState } from 'react';
import {
    Star,
    ExternalLink,
    Copy,
    Check,
    Eye,
    EyeOff,
    Edit3,
    Trash2,
    ShieldCheck,
    Calendar,
    Clock,
    Lock
} from 'lucide-react';
import FaviconImage from './FaviconImage';
import PasswordStrength from './PasswordStrength';

export default function VaultDetail({
    item,
    onEdit,
    onDelete,
    onToggleFavorite,
    onCopy
}) {
    const [showPassword, setShowPassword] = useState(false);
    const [copiedField, setCopiedField] = useState(null);

    if (!item) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm min-h-[400px] transition-colors">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
                    <ShieldCheck className="w-8 h-8 text-blue-500 dark:text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1">No Account Selected</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-sm">
                    Select a credential from the list to view its details, or add a new account to your vault.
                </p>
            </div>
        );
    }

    const handleCopyField = (text, fieldName) => {
        if (!text) return;
        onCopy(text, fieldName);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const formattedUrl = item.url
        ? item.url.startsWith('http://') || item.url.startsWith('https://')
            ? item.url
            : `https://${item.url}`
        : '';

    const displayTitle = item.title?.trim() || item.url?.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || 'Untitled Account';

    return (
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden transition-colors">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center gap-4 min-w-0">
                    <FaviconImage url={item.url} title={item.title} size="lg" />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                                {displayTitle}
                            </h2>
                            <button
                                type="button"
                                title={item.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
                                onClick={() => onToggleFavorite(item)}
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-500 transition-colors"
                            >
                                <Star
                                    className={`w-5 h-5 ${
                                        item.isFavorite
                                            ? 'text-amber-500 fill-amber-500'
                                            : 'hover:text-amber-500'
                                    }`}
                                />
                            </button>
                        </div>
                        {formattedUrl && (
                            <a
                                href={formattedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-cyan-400 hover:underline mt-0.5 truncate font-medium"
                            >
                                {item.url} <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all"
                    >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        Edit
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(item._id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6">
                {/* Username Field */}
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Username / Email
                    </label>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 group">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate select-all">
                            {item.username || <span className="text-slate-400 italic">No username set</span>}
                        </span>
                        {item.username && (
                            <button
                                type="button"
                                onClick={() => handleCopyField(item.username, 'Username')}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
                                title="Copy username"
                            >
                                {copiedField === 'Username' ? (
                                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Password
                    </label>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                        <span className="font-mono text-sm tracking-wide text-slate-900 dark:text-slate-100 select-all truncate">
                            {showPassword ? item.password : '••••••••••••••••'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                                title={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? (
                                    <EyeOff className="w-4 h-4" />
                                ) : (
                                    <Eye className="w-4 h-4" />
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCopyField(item.password, 'Password')}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-blue-100/70 dark:hover:bg-slate-800 transition-colors"
                                title="Copy password"
                            >
                                {copiedField === 'Password' ? (
                                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Password Strength Meter */}
                    <div className="pt-1">
                        <PasswordStrength password={item.password} />
                    </div>
                </div>

                {/* Website Field (if present) */}
                {item.url && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Website Address
                        </label>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate select-all">
                                {item.url}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                                <a
                                    href={formattedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-blue-100/70 dark:hover:bg-slate-800 transition-colors"
                                    title="Open website"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <button
                                    type="button"
                                    onClick={() => handleCopyField(item.url, 'Website URL')}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                                    title="Copy URL"
                                >
                                    {copiedField === 'Website URL' ? (
                                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notes Block (if present) */}
                {item.notes && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Secure Notes
                        </label>
                        <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                            {item.notes}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Metadata */}
            <div className="mt-auto px-6 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                        Created: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                </div>
                {item.updatedAt && (
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                            Updated: {new Date(item.updatedAt).toLocaleDateString()}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
