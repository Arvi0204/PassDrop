import { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import {
    Star,
    ExternalLink,
    Copy,
    Eye,
    EyeOff,
    Edit3,
    Droplet,
    Trash2,
    ShieldCheck,
    Calendar,
    Clock,
    User,
    KeyRound,
    Globe,
    FileText,
    ChevronLeft
} from 'lucide-react';
import FaviconImage from './FaviconImage';
import PasswordStrength from './PasswordStrength';
import CopyIcon from './CopyIcon';
import IconSwap from '../common/IconSwap';
import Tooltip from '../common/Tooltip';
import WaterMask, { useLingering } from './WaterMask';

export default function VaultDetail({
    item,
    onBack,
    onEdit,
    onDelete,
    onShare,
    sharedLinks,
    onToggleFavorite,
    onCopy
}) {
    const [showPassword, setShowPassword] = useState(false);
    const [copiedField, setCopiedField] = useState(null);
    // the real password is only in the page while it is revealed, and until the water has covered it again
    const showText = useLingering(showPassword, 360);

    // The star pops when the user toggles favorite. It does not pop on first render, so
    // selecting an account stays calm.
    const starControls = useAnimationControls();
    const lastFavorite = useRef(item?.isFavorite);
    useEffect(() => {
        if (!item) return;
        if (lastFavorite.current !== item.isFavorite) {
            starControls.start({ scale: [1, 1.5, 1], transition: { duration: 0.35, ease: 'easeOut' } });
        }
        lastFavorite.current = item.isFavorite;
    }, [item, starControls]);

    if (!item) {
        return (
            <div className="relative h-full flex flex-col items-center justify-center text-center p-8 bg-[#e1eef5]/70 rounded-2xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl min-h-[440px]">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back to accounts list"
                        className="md:hidden absolute top-4 left-4 p-2 rounded-xl text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-all cursor-pointer"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}
                <div className="w-16 h-16 rounded-2xl bg-[#d0e4ee] border border-[#b8d6e5] flex items-center justify-center mb-4 text-[#112838] shadow-xs">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-[#0c1820] mb-1">No Account Selected</h3>
                <p className="text-sm text-[#3a5566] max-w-sm">
                    Select a credential from the list to view its details, or click &ldquo;New Item&rdquo; to add a new account.
                </p>
            </div>
        );
    }

    const handleCopyField = async (text, fieldName) => {
        if (!text) return;
        if (await onCopy(text, fieldName) === false) return; // the browser refused: no check
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
        <div className="bg-[#e1eef5]/70 rounded-2xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-white/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-white/20">
                {/* Top / Left: [back arrow mobile] favicon + title + star */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    {/* Back arrow — mobile only, embedded inside the card */}
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label="Back to accounts list"
                            className="md:hidden p-2 -ml-1 rounded-xl text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-all cursor-pointer shrink-0"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div className="p-2.5 rounded-2xl bg-white/80 border border-white/90 shadow-xs shrink-0">
                        <FaviconImage url={item.url} title={item.title} size="lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#0c1820] truncate min-w-0">
                                {displayTitle}
                            </h2>
                            <button
                                type="button"
                                title={item.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
                                onClick={() => onToggleFavorite(item)}
                                className="p-1.5 rounded-xl text-[#5c7788] hover:text-amber-500 hover:bg-amber-50 transition-all cursor-pointer shrink-0"
                            >
                                <motion.span animate={starControls} className="inline-flex">
                                    <Star
                                        className={`w-5 h-5 ${
                                            item.isFavorite
                                                ? 'text-amber-500 fill-amber-500'
                                                : 'hover:text-amber-500'
                                        }`}
                                    />
                                </motion.span>
                            </button>
                        </div>
                        {formattedUrl && (
                            <a
                                href={formattedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#0284c7] hover:underline mt-1 truncate font-medium max-w-full"
                            >
                                <span className="truncate">{item.url}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                        )}
                    </div>
                </div>

                {/* Actions row — full width on mobile, sits below title on mobile and aligns right on sm+ */}
                <div className="flex items-center gap-2 shrink-0">
                    <Tooltip title="Drop this login" text="Share it with a link that destroys itself after a number of views or a set time.">
                        {(hint) => (
                            <button
                                type="button"
                                data-action="drop"
                                {...hint}
                                onClick={() => onShare(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0c1820] bg-white/80 hover:bg-white border border-white/90 rounded-xl shadow-xs transition-all cursor-pointer"
                            >
                                <Droplet className="w-3.5 h-3.5 text-[#3a5566]" />
                                Drop
                            </button>
                        )}
                    </Tooltip>
                    <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0c1820] bg-white/80 hover:bg-white border border-white/90 rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                        <Edit3 className="w-3.5 h-3.5 text-[#3a5566]" />
                        Edit
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(item._id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5">
                {/* Username Field */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#3a5566] uppercase tracking-wider">
                        <User className="w-3.5 h-3.5 text-[#0284c7]" />
                        <span>Username / Email</span>
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#f5fafc]/85 border border-white/90 hover:border-[#112838]/40 shadow-xs transition-all group">
                        <span className="text-sm font-medium text-[#0c1820] truncate select-all">
                            {item.username || <span className="text-[#5c7788] italic font-normal">No username set</span>}
                        </span>
                        {item.username && (
                            <button
                                type="button"
                                onClick={() => handleCopyField(item.username, 'Username')}
                                className="p-1.5 rounded-lg text-[#5c7788] hover:text-[#0284c7] hover:bg-[#e0f2fe] transition-colors shrink-0 cursor-pointer"
                                title="Copy username"
                            >
                                <CopyIcon copied={copiedField === 'Username'} icon={Copy} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#3a5566] uppercase tracking-wider">
                        <KeyRound className="w-3.5 h-3.5 text-[#0284c7]" />
                        <span>Password</span>
                    </div>
                    <div className="relative overflow-hidden flex items-center justify-between p-3.5 rounded-xl bg-[#f5fafc]/85 border border-white/90 hover:border-[#112838]/40 shadow-xs transition-all">
                        {/* the water covers the field while the password is hidden, and drains away to uncover it */}
                        <span className="font-mono text-sm tracking-wider text-[#0c1820] select-all truncate">
                            {showText ? item.password : '\u00A0'}
                        </span>
                        <WaterMask revealed={showPassword} password={item.password} />
                        <div className="relative z-[4] flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="p-1.5 rounded-lg text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-colors cursor-pointer"
                                title={showPassword ? 'Hide password' : 'Show password'}
                            >
                                <IconSwap swapped={showPassword} from={Eye} to={EyeOff} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCopyField(item.password, 'Password')}
                                className="p-1.5 rounded-lg text-[#5c7788] hover:text-[#0284c7] hover:bg-[#e0f2fe] transition-colors cursor-pointer"
                                title="Copy password"
                            >
                                <CopyIcon copied={copiedField === 'Password'} icon={Copy} />
                            </button>
                        </div>
                    </div>

                    {/* Password Strength Meter */}
                    <div className="pt-1.5">
                        <PasswordStrength password={item.password} mode="saved" onChange={() => onEdit(item)} />
                    </div>
                </div>

                {/* Website Field (if present) */}
                {item.url && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#3a5566] uppercase tracking-wider">
                            <Globe className="w-3.5 h-3.5 text-[#0284c7]" />
                            <span>Website Address</span>
                        </div>
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#f5fafc]/85 border border-white/90 hover:border-[#112838]/40 shadow-xs transition-all">
                            <span className="text-sm font-medium text-[#0c1820] truncate select-all">
                                {item.url}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                                <a
                                    href={formattedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg text-[#5c7788] hover:text-[#0284c7] hover:bg-[#e0f2fe] transition-colors"
                                    title="Open website"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <button
                                    type="button"
                                    onClick={() => handleCopyField(item.url, 'Website URL')}
                                    className="p-1.5 rounded-lg text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-colors cursor-pointer"
                                    title="Copy URL"
                                >
                                    <CopyIcon copied={copiedField === 'Website URL'} icon={Copy} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notes Block (if present) */}
                {item.notes && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#3a5566] uppercase tracking-wider">
                            <FileText className="w-3.5 h-3.5 text-[#0284c7]" />
                            <span>Secure Notes</span>
                        </div>
                        <div className="p-4 rounded-xl bg-[#f5fafc]/85 border border-white/90 text-sm text-[#0c1820] whitespace-pre-wrap font-sans leading-relaxed shadow-xs">
                            {item.notes}
                        </div>
                    </div>
                )}

                {sharedLinks}
            </div>

            {/* Footer Metadata */}
            <div className="mt-auto px-6 py-3.5 bg-white/30 border-t border-white/50 flex items-center justify-between text-xs text-[#3a5566]">
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
