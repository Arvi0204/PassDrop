import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, LogOut, Trash2, X } from 'lucide-react';

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
                        className="fixed inset-0 bg-[#0c1820]/50 backdrop-blur-sm"
                    />

                    {/* Dialog Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="relative w-full max-w-md bg-[#e1eef5]/95 backdrop-blur-2xl border border-white/80 rounded-2xl shadow-2xl p-6 overflow-hidden z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1.5 rounded-lg text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                            <span className="sr-only">Close</span>
                        </button>

                        <div className="flex flex-col items-center text-center">
                            {/* Icon Badge */}
                            <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border shadow-xs ${
                                    isLogout
                                        ? 'bg-[#d0e4ee] border-[#b8d6e5] text-[#112838]'
                                        : isDelete
                                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                                        : 'bg-amber-50 border-amber-200 text-amber-600'
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
                            <h3 className="text-lg font-bold text-[#0c1820]">
                                {displayTitle}
                            </h3>
                            <p className="mt-2 text-sm text-[#3a5566] leading-relaxed max-w-sm">
                                {message}
                            </p>

                            {/* Action Buttons */}
                            <div className="mt-6 flex items-center gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-white/80 bg-white/70 hover:bg-white text-[#3a5566] hover:text-[#0c1820] transition-all cursor-pointer shadow-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onConfirm();
                                    }}
                                    className={`flex-1 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-white transition-all shadow-md cursor-pointer ${
                                        isDelete
                                            ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                                            : 'bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] shadow-[#0284c7]/25'
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
