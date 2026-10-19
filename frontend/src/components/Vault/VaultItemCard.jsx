import React from 'react';
import { Star, Copy, KeyRound, User } from 'lucide-react';
import FaviconImage from './FaviconImage';

export default function VaultItemCard({
    item,
    isSelected,
    onSelect,
    onCopyUsername,
    onCopyPassword,
    onToggleFavorite
}) {
    const displayTitle = item.title?.trim() || item.url?.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || 'Untitled Account';
    const displaySubtitle = item.username || item.url || 'No username';

    return (
        <div
            onClick={() => onSelect(item)}
            className={`group relative p-3.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 text-left ${
                isSelected
                    ? 'bg-blue-50/80 dark:bg-slate-800/90 border-blue-500 dark:border-cyan-400 shadow-sm ring-1 ring-blue-500/20 dark:ring-cyan-400/20'
                    : 'bg-white dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-800'
            }`}
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <FaviconImage url={item.url} title={item.title} size="md" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                            {displayTitle}
                        </span>
                        {item.isFavorite && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {displaySubtitle}
                    </p>
                </div>
            </div>

            {/* Quick hover copy actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                {item.username && (
                    <button
                        type="button"
                        title="Copy Username"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCopyUsername(item.username);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
                    >
                        <User className="w-3.5 h-3.5" />
                    </button>
                )}
                <button
                    type="button"
                    title="Copy Password"
                    onClick={(e) => {
                        e.stopPropagation();
                        onCopyPassword(item.password);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-blue-100/70 dark:hover:bg-slate-700 transition-colors"
                >
                    <KeyRound className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
