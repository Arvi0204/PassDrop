import { useRef, useState } from 'react';
import useDialogFocus from '../lib/useDialogFocus';
import { motion } from 'framer-motion';
import { Copy, Check, Download, ArrowRight, ShieldAlert } from 'lucide-react';

// A popup, shown once, the first time the Account page is opened after sign-up (it used to interrupt sign-up itself,
// which fought with the water animation). The key is made in the browser and never sent anywhere, so this popup is the
// only place it will ever be displayed. It cannot be dismissed until the box is ticked.
export default function RecoveryKey({ recoveryKey, onContinue }) {
    const [copied, setCopied] = useState(false);
    const [saved, setSaved] = useState(false);
    const [failed, setFailed] = useState(false);
    const dialogRef = useRef(null);
    useDialogFocus(true, dialogRef);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(recoveryKey);
            setFailed(false);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setFailed(true); // no clipboard access: the key is on screen and can be downloaded instead
        }
    };

    const download = () => {
        const text = `PassDrop recovery key\n\n${recoveryKey}\n\nKeep this somewhere safe and private. Together with your account email it can reset your master password. Without your master password and this key, nobody (including PassDrop) can recover your vault.\n`;
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'passdrop-recovery-key.txt';
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none" role="dialog" aria-modal="true" aria-labelledby="recovery-key-title">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 bg-[#0c1820]/50 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="relative z-10 w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#e1eef5]/95 backdrop-blur-2xl border border-white/80 rounded-2xl shadow-2xl p-6"
            >
                <div className="w-11 h-11 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs mb-4">
                    <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 id="recovery-key-title" className="text-xl font-bold text-[#0c1820]">Save your recovery key</h3>
                <p className="text-xs sm:text-sm text-[#3a5566] mt-1.5 leading-relaxed">
                    This key is shown once. If you forget your master password, it is the only way back into your vault.
                    Without your master password and this key, your vault cannot be recovered by anyone, including PassDrop.
                </p>

                <div
                    data-testid="recovery-key"
                    className="mt-5 px-4 py-4 text-center text-lg font-mono font-bold tracking-wider text-[#0c1820] rounded-xl bg-[#f5fafc]/85 border border-white/90 shadow-xs select-all break-words"
                >
                    {recoveryKey}
                </div>

                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <button
                        type="button"
                        onClick={copy}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-[#112838] bg-white/80 hover:bg-white border border-white/90 rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={download}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-[#112838] bg-white/80 hover:bg-white border border-white/90 rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                        <Download className="w-4 h-4" />
                        <span>Download (.txt)</span>
                    </button>
                </div>

                <p role="status" className={failed ? 'mt-2 text-xs text-rose-700' : 'sr-only'}>
                    {failed ? 'Your browser would not copy it. Select the key and copy it by hand, or use Download.' : ''}
                </p>

                <label className="mt-5 flex items-center gap-2.5 text-sm font-semibold text-[#0c1820] cursor-pointer">
                    <input
                        type="checkbox"
                        checked={saved}
                        onChange={(e) => setSaved(e.target.checked)}
                        className="w-4 h-4 accent-[#0284c7]"
                    />
                    <span>I have saved my recovery key</span>
                </label>

                <button
                    type="button"
                    disabled={!saved}
                    onClick={onContinue}
                    className="w-full mt-4 py-3 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                </button>
            </motion.div>
        </div>
    );
}
