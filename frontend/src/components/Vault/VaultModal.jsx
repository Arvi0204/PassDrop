import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Eye,
    EyeOff,
    Sparkles,
    Star,
    Globe,
    User,
    KeyRound,
    FileText,
    Sliders,
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import PasswordStrength from './PasswordStrength';
import IconSwap from '../common/IconSwap';
import GeneratorOptions from '../common/GeneratorOptions';
import WaterMask from './WaterMask';
import { flyDropInto, dropIsInstant } from '../../lib/dropIn';
import { generatePassword, DEFAULT_OPTIONS } from '../../lib/passwordGen';

export default function VaultModal({
    isOpen,
    onClose,
    initialData,
    onSave
}) {
    const isEditing = Boolean(initialData?._id);

    const [form, setForm] = useState({
        title: '',
        url: '',
        username: '',
        password: '',
        notes: '',
        isFavorite: false
    });

    const [showPassword, setShowPassword] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Inline generator configuration state
    // open by default on a laptop, where there is room; closed on a phone
    const optionsOpenByDefault = () => window.matchMedia('(min-width: 1024px)').matches;
    const [showGeneratorOptions, setShowGeneratorOptions] = useState(optionsOpenByDefault);
    const [gen, setGen] = useState(DEFAULT_OPTIONS);
    const passwordRef = useRef(null);

    useEffect(() => {
        if (initialData) {
            setForm({
                title: initialData.title || '',
                url: initialData.url || '',
                username: initialData.username || '',
                password: initialData.password || '',
                notes: initialData.notes || '',
                isFavorite: Boolean(initialData.isFavorite)
            });
        } else {
            setForm({
                title: '',
                url: '',
                username: '',
                password: '',
                notes: '',
                isFavorite: false
            });
        }
        setShowPassword(false);
        setShowGeneratorOptions(optionsOpenByDefault());
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleGenerate = (cfg = gen, silent = false) => {
        setForm((prev) => ({ ...prev, password: generatePassword(cfg) }));
        setShowPassword(true);
        if (!silent) {
            toast.success(`Generated strong ${cfg.length}-character password!`);
        }
    };

    const updateLength = (length) => {
        const next = { ...gen, length };
        setGen(next);
        handleGenerate(next, true);
    };

    // Ticking an option sends a drop into the password field, and the new password appears where
    // it lands. Unticking just regenerates.
    const toggleOption = (key, boxEl) => {
        const next = { ...gen, [key]: !gen[key] };
        setGen(next);
        if (!next[key] || dropIsInstant()) {
            handleGenerate(next, true);
            return;
        }
        flyDropInto(boxEl, passwordRef.current, () => handleGenerate(next, true));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim() && !form.url.trim()) {
            toast.error('Please enter a Title or Website URL');
            return;
        }
        if (!form.password.trim()) {
            toast.error('Password cannot be blank');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave({
                ...form,
                _id: initialData?._id
            });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-[#0c1820]/50 backdrop-blur-sm"
                    />

                    {/* Modal Window */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="relative w-full max-w-lg lg:max-w-4xl bg-[#e1eef5]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/80 overflow-hidden flex flex-col max-h-[90vh] z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/60 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-[#0c1820]">
                                    {isEditing ? 'Edit Account' : 'New Vault Item'}
                                </h3>
                                <p className="text-xs text-[#3a5566]">
                                    {isEditing
                                        ? 'Update your stored credential details'
                                        : 'Save a password or credential to your secure vault'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* One column on a phone; on a laptop the fields sit left and the password with its generator right */}
                            <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-7">
                                <div className="contents lg:flex lg:flex-col lg:gap-5">
                                {/* Title & Favorite */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-[#0c1820] flex items-center gap-1.5">
                                            Title <span className="text-[#3a5566] font-normal">(Friendly name)</span>
                                        </label>
                                        <span className="text-[11px] text-[#3a5566]">
                                            {form.isFavorite ? '★ Marked as favorite' : 'Click star to pin'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2.5 items-center">
                                        <input
                                            type="text"
                                            name="title"
                                            value={form.title}
                                            onChange={handleChange}
                                            placeholder="e.g. GitHub, Netflix, Work Email"
                                            className="flex-1 h-10 px-3.5 text-sm bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all placeholder:text-[#5c7788]"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            title={form.isFavorite ? 'Favorited (Click to unpin)' : 'Mark as favorite'}
                                            onClick={() => setForm((prev) => ({ ...prev, isFavorite: !prev.isFavorite }))}
                                            className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                                                form.isFavorite
                                                    ? 'bg-amber-50 border-amber-300 text-amber-500 shadow-xs'
                                                    : 'bg-[#f5fafc]/85 border-white/90 text-[#5c7788] hover:text-[#0c1820]'
                                            }`}
                                        >
                                            <Star className={`w-4 h-4 ${form.isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Website URL */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-[#0c1820] flex items-center gap-1.5">
                                        <Globe className="w-3.5 h-3.5 text-[#3a5566]" /> Website URL
                                    </label>
                                    <input
                                        type="text"
                                        name="url"
                                        value={form.url}
                                        onChange={handleChange}
                                        placeholder="e.g. https://github.com/login"
                                        className="w-full h-10 px-3.5 text-sm bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all placeholder:text-[#5c7788]"
                                    />
                                </div>

                                {/* Username */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-[#0c1820] flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-[#3a5566]" /> Username or Email
                                    </label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={form.username}
                                        onChange={handleChange}
                                        placeholder="e.g. user@example.com"
                                        autoComplete="username"
                                        className="w-full h-10 px-3.5 text-sm bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all placeholder:text-[#5c7788]"
                                    />
                                </div>

                                {/* Notes */}
                                <div className="space-y-1 order-2">
                                    <label className="text-xs font-semibold text-[#0c1820] flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-[#3a5566]" /> Secure Notes (Optional)
                                    </label>
                                    <textarea
                                        name="notes"
                                        rows={3}
                                        value={form.notes}
                                        onChange={handleChange}
                                        placeholder="Add 2FA backup codes, security questions, or notes..."
                                        className="w-full px-3.5 py-2 text-sm bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all resize-none placeholder:text-[#5c7788]"
                                    />
                                </div>

                                </div>
                                {/* Password & Integrated Generator */}
                                <div className="space-y-1.5 order-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-semibold text-[#0c1820] flex items-center gap-1.5">
                                            <KeyRound className="w-3.5 h-3.5 text-[#3a5566]" /> Password *
                                        </label>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleGenerate()}
                                                className="text-xs font-semibold text-[#112838] hover:text-[#1b3d54] flex items-center gap-1 hover:underline cursor-pointer"
                                            >
                                                <Sparkles className="w-3 h-3" /> Generate
                                            </button>
                                            <span className="text-[#3a5566]/40">•</span>
                                            <button
                                                type="button"
                                                onClick={() => setShowGeneratorOptions((prev) => !prev)}
                                                className={`text-xs px-2 py-0.5 rounded-md border transition-all flex items-center gap-1 cursor-pointer ${
                                                    showGeneratorOptions
                                                        ? 'bg-[#d0e4ee] text-[#0e293a] border-[#b8d6e5] shadow-xs'
                                                        : 'text-[#3a5566] hover:text-[#0c1820] border-white/80'
                                                }`}
                                                title="Configure password rules (length, numbers, symbols)"
                                            >
                                                <Sliders className="w-3 h-3" />
                                                <span>Options {showGeneratorOptions ? '▲' : '▼'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <input
                                            ref={passwordRef}
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={form.password}
                                            onChange={handleChange}
                                            onFocus={() => setPasswordFocused(true)}
                                            onBlur={() => setPasswordFocused(false)}
                                            placeholder="Enter account password"
                                            autoComplete="new-password"
                                            className="w-full h-10 px-3.5 pr-10 text-sm font-mono bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all placeholder:text-[#5c7788]"
                                        />
                                        {/* Water covers a hidden password. It drains while you type in the field, when the
                                            password is shown, and when there is nothing to hide yet. */}
                                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                                            <WaterMask revealed={showPassword || passwordFocused || !form.password} />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            title={showPassword ? 'Hide password' : 'Show password'}
                                            className="absolute z-[4] right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-colors cursor-pointer"
                                        >
                                            <IconSwap swapped={showPassword} from={Eye} to={EyeOff} />
                                        </button>
                                    </div>

                                    {/* Strength Meter */}
                                    <div className="pt-0.5">
                                        <PasswordStrength password={form.password} mode="typing" />
                                    </div>

                                    {/* Expandable Inline Generator Options Drawer */}
                                    <AnimatePresence initial={false}>
                                        {showGeneratorOptions && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.18, ease: 'easeOut' }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-2 p-3.5 rounded-xl bg-[#f5fafc]/90 border border-white/90">
                                                    <GeneratorOptions settings={gen} onLength={updateLength} onToggle={toggleOption} />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleGenerate()}
                                                        className="mt-4 w-full py-2 px-4 bg-white/70 hover:bg-white text-[#3a5566] hover:text-[#0c1820] border border-white/80 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                        <span>Regenerate</span>
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                            </div>

                            {/* Footer Buttons */}
                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/60">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-[#3a5566] hover:text-[#0c1820] bg-white/60 hover:bg-white/90 border border-white/80 rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    {isSubmitting ? 'Saving...' : isEditing ? 'Update Account' : 'Save Account'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
