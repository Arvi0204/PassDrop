import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, LogOut, Trash2, X, HelpCircle } from 'lucide-react';

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm'
}) {
    // Inferred intent based on text
    const lowerMsg = (message || '').toLowerCase();
    const lowerConfirm = (confirmText || '').toLowerCase();
    const isLogout = lowerMsg.includes('log out') || lowerMsg.includes('logout') || lowerConfirm.includes('log out');
    const isDelete = lowerMsg.includes('delete') || lowerMsg.includes('remove') || lowerMsg.includes('clear') || lowerConfirm.includes('delete');

    // Title fallback
    const displayTitle = title || (isLogout ? 'Confirm Log Out' : isDelete ? 'Confirm Deletion' : 'Are You Sure?');

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

                    {/* Dialog Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/50 p-6 overflow-hidden z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Ambient top light */}
                        <div
                            className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 rounded-full blur-2xl pointer-events-none opacity-40 ${
                                isLogout ? 'bg-cyan-500' : isDelete ? 'bg-rose-500' : 'bg-amber-500'
                            }`}
                        />

                        {/* Close button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-4 h-4" />
                            <span className="sr-only">Close</span>
                        </button>

                        <div className="flex flex-col items-center text-center">
                            {/* Icon Badge */}
                            <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border shadow-sm ${
                                    isLogout
                                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-cyan-400'
                                        : isDelete
                                        ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                                        : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                                }`}
                            >
                                {isLogout ? (
                                    <LogOut className="w-5 h-5" />
                                ) : isDelete ? (
                                    <Trash2 className="w-5 h-5" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5" />
                                )}
                            </div>

                            {/* Title & Message */}
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {displayTitle}
                            </h3>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
                                {message}
                            </p>

                            {/* Action Buttons */}
                            <div className="mt-6 flex items-center gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-slate-400/20"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onConfirm();
                                    }}
                                    className={`flex-1 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-white transition-all shadow-sm focus:outline-none focus:ring-2 ${
                                        isLogout
                                            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-blue-500/20 focus:ring-blue-500/30'
                                            : isDelete
                                            ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/20 focus:ring-rose-500/30'
                                            : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-blue-500/20 focus:ring-blue-500/30'
                                    }`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
