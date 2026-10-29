import React, { useEffect, useRef, useState } from 'react';
import { Star, KeyRound, User } from 'lucide-react';
import { motion } from 'framer-motion';
import FaviconImage from './FaviconImage';
import CopyIcon from './CopyIcon';
import { spring } from '../../lib/motion';

export default function VaultItemCard({
    item,
    isSelected,
    onSelect,
    onCopyUsername,
    onCopyPassword
}) {
    const displayTitle = item.title?.trim() || item.url?.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || 'Untitled Account';
    const displaySubtitle = item.username || item.url || 'No username';

    // Inline confirmation for the hover copy buttons: the icon turns into a check for a moment
    const [copied, setCopied] = useState(null); // 'username' | 'password' | null
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const copyWithFeedback = (kind, copy, value) => {
        copy(value);
        setCopied(kind);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(null), 1500);
    };

    return (
        <div
            data-entrance
            onClick={() => onSelect(item)}
            className={`group relative p-3.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 text-left ${
                isSelected
                    ? 'bg-gradient-to-r from-[#e0f2fe]/95 to-[#f8fafc]/90 border-[#0284c7]/40 shadow-xs ring-1 ring-[#0284c7]/25'
                    : 'bg-[#e1eef5]/65 hover:bg-[#e1eef5]/90 border-white/70 hover:border-white shadow-xs backdrop-blur-md'
            }`}
        >
            {/* Active Left Indicator Bar */}
            {isSelected && (
                <motion.span
                    layoutId="vault-selection-bar"
                    transition={spring.snappy}
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#0284c7] shadow-[0_0_10px_rgba(2,132,199,0.7)]"
                />
            )}

            <div className="flex items-center gap-3 min-w-0 flex-1 pl-1">
                <div className="p-1 rounded-xl bg-white/80 border border-white/90 shadow-xs shrink-0">
                    <FaviconImage url={item.url} title={item.title} size="md" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#0c1820] text-sm truncate">
                            {displayTitle}
                        </span>
                        {item.isFavorite && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                    </div>
                    <p className="text-xs text-[#3a5566] truncate mt-0.5">
                        {displaySubtitle}
                    </p>
                </div>
            </div>

            {/* Quick hover copy actions */}
            <div className={`flex items-center gap-1 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0 ${copied ? 'opacity-100' : 'opacity-0'}`}>
                {item.username && (
                    <button
                        type="button"
                        title="Copy Username"
                        onClick={(e) => {
                            e.stopPropagation();
                            copyWithFeedback('username', onCopyUsername, item.username);
                        }}
                        className="p-1.5 rounded-lg text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-colors"
                    >
                        <CopyIcon copied={copied === 'username'} icon={User} className="w-3.5 h-3.5" />
                    </button>
                )}
                <button
                    type="button"
                    title="Copy Password"
                    onClick={(e) => {
                        e.stopPropagation();
                        copyWithFeedback('password', onCopyPassword, item.password);
                    }}
                    className="p-1.5 rounded-lg text-[#5c7788] hover:text-[#0284c7] hover:bg-[#e0f2fe] transition-colors"
                >
                    <CopyIcon copied={copied === 'password'} icon={KeyRound} className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
