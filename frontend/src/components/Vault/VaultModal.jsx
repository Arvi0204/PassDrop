import React, { useState, useEffect } from 'react';
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

const CHARACTER_SETS = {
    letters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
    numbers: '0123456789',
    specialChars: '!@#$%^&*()_+[]{}|;:,.<>?'
};

const secureRandomChar = (str) => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return str.charAt(array[0] % str.length);
};

const secureRandomInt = (max) => {
    if (max <= 0) return 0;
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
};

const generateCustomPassword = (length = 16, includeNumbers = true, includeSpecialChars = true) => {
    let charset = CHARACTER_SETS.letters;
    const requiredChars = [];

    if (includeNumbers) {
        charset += CHARACTER_SETS.numbers;
        requiredChars.push(secureRandomChar(CHARACTER_SETS.numbers));
    }

    if (includeSpecialChars) {
        charset += CHARACTER_SETS.specialChars;
        requiredChars.push(secureRandomChar(CHARACTER_SETS.specialChars));
    }

    const effectiveLength = Math.max(requiredChars.length, length || 8);
    const fillLength = Math.max(0, effectiveLength - requiredChars.length);

    let password = Array.from({ length: fillLength }, () =>
        secureRandomChar(charset)
    ).join('');

    requiredChars.forEach((char) => {
        const randomIndex = secureRandomInt(password.length + 1);
        password = password.slice(0, randomIndex) + char + password.slice(randomIndex);
    });

    return password;
};

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
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Inline generator configuration state
    const [showGeneratorOptions, setShowGeneratorOptions] = useState(false);
    const [genLength, setGenLength] = useState(16);
    const [genNumbers, setGenNumbers] = useState(true);
    const [genSymbols, setGenSymbols] = useState(true);

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
        setShowGeneratorOptions(false);
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleGenerate = (targetLength = genLength, numbers = genNumbers, symbols = genSymbols, silent = false) => {
        const newPass = generateCustomPassword(targetLength, numbers, symbols);
        setForm((prev) => ({ ...prev, password: newPass }));
        setShowPassword(true);
        if (!silent) {
            toast.success(`Generated strong ${targetLength}-character password!`);
        }
    };

    const updateLength = (newLen) => {
        setGenLength(newLen);
        handleGenerate(newLen, genNumbers, genSymbols, true);
    };

    const updateNumbers = (enabled) => {
        setGenNumbers(enabled);
        handleGenerate(genLength, enabled, genSymbols, true);
    };

    const updateSymbols = (enabled) => {
        setGenSymbols(enabled);
        handleGenerate(genLength, genNumbers, enabled, true);
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
                        className="relative w-full max-w-lg bg-[#e1eef5]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/80 overflow-hidden flex flex-col max-h-[90vh] z-10"
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

                            {/* Password & Integrated Generator */}
                            <div className="space-y-1.5">
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
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder="Enter account password"
                                        autoComplete="new-password"
                                        className="w-full h-10 px-3.5 pr-10 text-sm font-mono bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all placeholder:text-[#5c7788]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        title={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-colors cursor-pointer"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Strength Meter */}
                                <div className="pt-0.5">
                                    <PasswordStrength password={form.password} />
                                </div>

                                {/* Expandable Inline Generator Options Drawer */}
                                <AnimatePresence>
                                    {showGeneratorOptions && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.18, ease: 'easeOut' }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-2 p-3.5 rounded-xl bg-[#f5fafc]/90 border border-white/90 space-y-3 text-xs">
                                                {/* Length Slider & Presets */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-[#0c1820]">
                                                            Length: <span className="font-mono font-bold text-[#112838]">{genLength} chars</span>
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            {[12, 16, 20, 24].map((preset) => (
                                                                <button
                                                                    key={preset}
                                                                    type="button"
                                                                    onClick={() => updateLength(preset)}
                                                                    className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                                                                        genLength === preset
                                                                            ? 'bg-[#112838] text-white shadow-xs'
                                                                            : 'bg-white/80 text-[#3a5566] hover:text-[#0c1820] border border-white/80'
                                                                    }`}
                                                                >
                                                                    {preset}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="8"
                                                        max="48"
                                                        value={genLength}
                                                        onChange={(e) => updateLength(Number(e.target.value))}
                                                        style={{
                                                            background: `linear-gradient(to right, #112838 0%, #112838 ${((genLength - 8) / 40) * 100}%, #b9d1df ${((genLength - 8) / 40) * 100}%, #b9d1df 100%)`
                                                        }}
                                                        className="w-full h-2.5 rounded-lg appearance-none cursor-pointer accent-[#112838] border border-white/90 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#112838]/20"
                                                    />
                                                </div>

                                                {/* Rule Checkboxes & Regenerate */}
                                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/80">
                                                    <div className="flex items-center gap-4">
                                                        <label className="flex items-center gap-1.5 cursor-pointer text-[#0c1820] select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={genNumbers}
                                                                onChange={(e) => updateNumbers(e.target.checked)}
                                                                className="w-3.5 h-3.5 rounded border-slate-300 text-[#112838] focus:ring-0 cursor-pointer"
                                                            />
                                                            <span className="font-medium">Numbers (0-9)</span>
                                                        </label>
                                                        <label className="flex items-center gap-1.5 cursor-pointer text-[#0c1820] select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={genSymbols}
                                                                onChange={(e) => updateSymbols(e.target.checked)}
                                                                className="w-3.5 h-3.5 rounded border-slate-300 text-[#112838] focus:ring-0 cursor-pointer"
                                                            />
                                                            <span className="font-medium">Symbols (!@#)</span>
                                                        </label>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleGenerate()}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#112838] hover:text-[#1b3d54] hover:underline cursor-pointer"
                                                    >
                                                        <RefreshCw className="w-3 h-3" />
                                                        <span>Regenerate</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Notes */}
                            <div className="space-y-1">
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
                                    className="px-5 py-2 text-sm font-semibold text-white bg-[#112838] hover:bg-[#1b3d54] rounded-xl shadow-md shadow-[#112838]/20 transition-all flex items-center gap-2 cursor-pointer"
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
