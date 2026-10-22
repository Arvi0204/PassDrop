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
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
                    />

                    {/* Modal Window */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh] z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {isEditing ? 'Edit Account' : 'New Vault Item'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {isEditing
                                        ? 'Update your stored credential details'
                                        : 'Save a password or credential to your secure vault'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* Title & Favorite */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        Title <span className="text-slate-400 font-normal">(Friendly name)</span>
                                    </label>
                                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
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
                                        className="flex-1 h-10 px-3.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        title={form.isFavorite ? 'Favorited (Click to unpin)' : 'Mark as favorite'}
                                        onClick={() => setForm((prev) => ({ ...prev, isFavorite: !prev.isFavorite }))}
                                        className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border transition-all ${
                                            form.isFavorite
                                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-500 shadow-sm shadow-amber-500/10'
                                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <Star className={`w-4 h-4 ${form.isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Website URL */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-slate-400" /> Website URL
                                </label>
                                <input
                                    type="text"
                                    name="url"
                                    value={form.url}
                                    onChange={handleChange}
                                    placeholder="e.g. https://github.com/login"
                                    className="w-full h-10 px-3.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                            </div>

                            {/* Username */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-400" /> Username or Email
                                </label>
                                <input
                                    type="text"
                                    name="username"
                                    value={form.username}
                                    onChange={handleChange}
                                    placeholder="e.g. user@example.com"
                                    autoComplete="username"
                                    className="w-full h-10 px-3.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                            </div>

                            {/* Password & Integrated Generator */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <KeyRound className="w-3.5 h-3.5 text-slate-400" /> Password *
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleGenerate()}
                                            className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:text-blue-800 dark:hover:text-cyan-300 flex items-center gap-1 hover:underline"
                                        >
                                            <Sparkles className="w-3 h-3" /> Generate
                                        </button>
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <button
                                            type="button"
                                            onClick={() => setShowGeneratorOptions((prev) => !prev)}
                                            className={`text-xs px-2 py-0.5 rounded-md border transition-all flex items-center gap-1 ${
                                                showGeneratorOptions
                                                    ? 'bg-blue-50 dark:bg-slate-700/80 text-blue-600 dark:text-cyan-400 border-blue-200 dark:border-cyan-500/40 shadow-sm'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700'
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
                                        className="w-full h-10 px-3.5 pr-10 text-sm font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        title={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
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
                                            <div className="mt-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/80 space-y-3 text-xs">
                                                {/* Length Slider & Presets */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                            Length: <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">{genLength} chars</span>
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            {[12, 16, 20, 24].map((preset) => (
                                                                <button
                                                                    key={preset}
                                                                    type="button"
                                                                    onClick={() => updateLength(preset)}
                                                                    className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold transition-all ${
                                                                        genLength === preset
                                                                            ? 'bg-blue-600 dark:bg-cyan-500 text-white shadow-sm'
                                                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
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
                                                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
                                                    />
                                                </div>

                                                {/* Rule Checkboxes & Regenerate */}
                                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                                                    <div className="flex items-center gap-4">
                                                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={genNumbers}
                                                                onChange={(e) => updateNumbers(e.target.checked)}
                                                                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 cursor-pointer"
                                                            />
                                                            <span className="font-medium">Numbers (0-9)</span>
                                                        </label>
                                                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={genSymbols}
                                                                onChange={(e) => updateSymbols(e.target.checked)}
                                                                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 cursor-pointer"
                                                            />
                                                            <span className="font-medium">Symbols (!@#)</span>
                                                        </label>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleGenerate()}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 hover:underline"
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
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-slate-400" /> Secure Notes (Optional)
                                </label>
                                <textarea
                                    name="notes"
                                    rows={3}
                                    value={form.notes}
                                    onChange={handleChange}
                                    placeholder="Add 2FA backup codes, security questions, or notes..."
                                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-sm transition-all flex items-center gap-2"
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
