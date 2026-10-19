import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Sparkles, Star, Globe, User, KeyRound, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import PasswordStrength from './PasswordStrength';

const generateQuickPassword = (length = 16) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (num) => chars[num % chars.length]).join('');
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
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleGenerate = () => {
        const strongPass = generateQuickPassword(16);
        setForm((prev) => ({ ...prev, password: strongPass }));
        setShowPassword(true);
        toast.success('Generated strong 16-character password!');
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
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Window */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-10 flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {isEditing ? 'Edit Account' : 'Add New Account'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {isEditing
                                        ? 'Update your stored credential details'
                                        : 'Store a new password securely in your vault'}
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
                            <div className="flex gap-3 items-start">
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        Title <span className="text-slate-400 font-normal">(Friendly name)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="title"
                                        value={form.title}
                                        onChange={handleChange}
                                        placeholder="e.g. GitHub, Netflix, Work Email"
                                        className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        autoFocus
                                    />
                                </div>
                                <div className="pt-6">
                                    <button
                                        type="button"
                                        title={form.isFavorite ? 'Favorited' : 'Mark as favorite'}
                                        onClick={() => setForm((prev) => ({ ...prev, isFavorite: !prev.isFavorite }))}
                                        className={`p-2.5 rounded-xl border transition-all ${
                                            form.isFavorite
                                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-500'
                                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        <Star className={`w-5 h-5 ${form.isFavorite ? 'fill-amber-500' : ''}`} />
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
                                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                            </div>

                            {/* Password & Generator */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <KeyRound className="w-3.5 h-3.5 text-slate-400" /> Password *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleGenerate}
                                        className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:text-blue-800 dark:hover:text-cyan-300 flex items-center gap-1 hover:underline"
                                    >
                                        <Sparkles className="w-3 h-3" /> Generate Strong
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder="Enter account password"
                                        autoComplete="new-password"
                                        className="w-full px-3.5 py-2 pr-10 text-sm font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <div className="pt-1">
                                    <PasswordStrength password={form.password} />
                                </div>
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
