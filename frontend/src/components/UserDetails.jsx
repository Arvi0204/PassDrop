import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, User, Mail, Calendar, Clock, KeyRound, AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from './ConfirmationModal';
import authFetch from '../lib/authFetch';
import Reveal from './common/Reveal';
import PasswordStrength from './Vault/PasswordStrength';
import IconSwap from './common/IconSwap';
import { ErrorLine, useShake } from './common/FormError';
import { motion, AnimatePresence } from 'framer-motion';
import { MIN_PASSWORD_LENGTH, TOO_SHORT_MESSAGE } from '../lib/passwordStrength';
import { changePassword, reauthKey, regenerateRecoveryKey, unlock } from '../lib/accountApi';
import RecoveryKey from './RecoveryKey';
import { clearPendingRecoveryKey, getPendingRecoveryKey, getToken, getUserId, getVaultKey, saveSignIn, setPendingRecoveryKey as holdRecoveryKey, signOut } from '../lib/session';

export default function UserDetails() {
    const [user, setUser] = useState({
        username: "",
        email: "",
        createdAt: "",
        lastLogin: ""
    });
    const host = import.meta.env.VITE_BACKEND;
    const [updatedPassword, setUpdatedPassword] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [saveState, setSaveState] = useState('idle'); // idle | saving | done
    const confirmRef = useRef(null);
    const doneTimer = useRef(null);
    const { controls: confirmShake, shake } = useShake();
    const [modalState, setModalState] = useState({ isOpen: false, message: "", action: null, title: undefined, confirmText: "Yes, I'm sure" });
    const [confirmPassword, setConfirmPassword] = useState('');
    const token = getToken();
    const navigate = useNavigate();
    // the recovery key made at sign-up, shown here once (see lib/session.js)
    const [pendingRecoveryKey, setPendingRecoveryKey] = useState(getPendingRecoveryKey);

    useEffect(() => () => clearTimeout(doneTimer.current), []);

    useEffect(() => {
        if (!token) {
            navigate('/login');
        } else {
            fetchUserDetails();
        }
    }, [token]);

    const fetchUserDetails = async () => {
        try {
            const response = await authFetch(`${host}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': token
                }
            });
            if (!response.ok) throw new Error('Failed to fetch user details');
            setUser(await response.json());
        } catch {
            toast.error("Failed to fetch user details");
        }
    };

    const onChange = (e) => {
        setUpdatedPassword({ ...updatedPassword, [e.target.name]: e.target.value });
        if (passwordError) setPasswordError('');
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (updatedPassword.newPassword.length < MIN_PASSWORD_LENGTH) {
            setPasswordError(TOO_SHORT_MESSAGE);
            return;
        }
        if (updatedPassword.newPassword !== updatedPassword.confirmNewPassword) {
            setPasswordError("Passwords do not match");
            shake();
            confirmRef.current?.focus();
            return;
        } else {
            setPasswordError('');
        }

        setIsLoading(true);
        setSaveState('saving');
        try {
            // the vault key is re-wrapped, not changed. In a locked tab the current password opens it for this one step.
            let vaultKey = await getVaultKey();
            if (!vaultKey) {
                const opened = await unlock(host, token, updatedPassword.currentPassword);
                if (!opened.ok) {
                    setSaveState('idle');
                    toast.error(opened.error);
                    return;
                }
                vaultKey = opened.vaultKey;
            }
            const result = await changePassword(host, token, {
                currentPassword: updatedPassword.currentPassword,
                newPassword: updatedPassword.newPassword,
                vaultKey
            });
            if (result.ok) {
                // the button shows the success, so no toast
                // the old token stops working with the old password, so swap in the fresh one
                saveSignIn({ token: result.token, userId: getUserId() });
                setUpdatedPassword({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
                setSaveState('done');
                doneTimer.current = setTimeout(() => setSaveState('idle'), 2400);
            } else {
                setSaveState('idle');
                toast.error(result.error);
            }
        } catch {
            setSaveState('idle');
            toast.error("An error occurred. Check backend connection.");
        } finally {
            setIsLoading(false);
        }
    };

    const closeModal = () => {
        setModalState(prev => ({ ...prev, isOpen: false }));
        setConfirmPassword('');
    };

    const openConfirmModal = (actionType) => {
        if (actionType === 'recovery') {
            setModalState({
                isOpen: true,
                title: 'New recovery key',
                confirmText: 'Make a new key',
                message: "Making a new recovery key replaces the current one, which will stop working. You will see the new key once. Enter your master password to continue.",
                action: (password) => handleNewRecoveryKey(password)
            });
        } else if (actionType === 'passwords') {
            setModalState({
                isOpen: true,
                message: "Are you sure you want to delete ALL stored passwords? This cannot be undone.",
                action: (password) => handleDeleteAllPasswords(password)
            });
        } else if (actionType === 'account') {
            setModalState({
                isOpen: true,
                message: "Are you sure you want to delete your entire PassDrop account and all associated credentials? This cannot be undone.",
                action: (password) => handleDeleteAccount(password)
            });
        }
    };

    const handleNewRecoveryKey = async (password) => {
        try {
            const result = await regenerateRecoveryKey(host, token, password);
            if (result.ok) {
                closeModal();
                holdRecoveryKey(result.recoveryKey); // kept in this tab until it has been saved, so a reload does not lose it
                setPendingRecoveryKey(result.recoveryKey);
            } else {
                toast.error(result.error);
            }
        } catch {
            toast.error("An error occurred. Check backend connection.");
        }
    };

    const handleDeleteAllPasswords = async (password) => {
        try {
            const response = await authFetch(`${host}/api/passwords`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': token
                },
                body: JSON.stringify({ currentAuthKey: await reauthKey(host, token, password) })
            });
            const json = await response.json();
            if (json.success) {
                toast.success("All credentials deleted from vault");
                closeModal();
            } else {
                toast.error(json.error || "Failed to delete passwords");
            }
        } catch {
            toast.error("An error occurred");
        }
    };

    const handleDeleteAccount = async (password) => {
        try {
            const response = await authFetch(`${host}/api/auth/me`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': token
                },
                body: JSON.stringify({ currentAuthKey: await reauthKey(host, token, password) })
            });
            const json = await response.json();
            if (json.success) {
                toast.success(json.message || "Account deleted successfully");
                signOut();
                closeModal();
                navigate("/home");
            } else {
                toast.error(json.error || "Failed to delete account");
            }
        } catch {
            toast.error("An error occurred deleting account");
        }
    };

    return (
        <div className="flex-1 bg-transparent py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Profile Header */}
                <Reveal index={0}>
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#d0e4ee] text-[#0e293a] border border-[#b8d6e5] mb-2 shadow-xs">
                            <KeyRound className="w-3.5 h-3.5 text-[#112838]" />
                            <span>Vault Security &amp; Profile</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0c1820]">
                            Account &amp; Security
                        </h1>
                        <p className="text-xs sm:text-sm text-[#3a5566] mt-1">
                            Manage your vault identity, update master credentials, and oversee security settings
                        </p>
                    </div>
                </Reveal>

                <Reveal index={1}>
                    <div className="bg-[#e1eef5]/70 rounded-2xl border border-white/80 p-5 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl">
                        <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-white/60">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-[#d0e4ee] text-[#112838] flex items-center justify-center">
                                    <User className="w-4 h-4" />
                                </div>
                                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0c1820]">
                                    Personal Information
                                </h2>
                            </div>
                            <span className="text-[11px] font-semibold text-[#0e293a] bg-[#d0e4ee] border border-[#b8d6e5] px-2.5 py-0.5 rounded-full shadow-xs">
                                Encrypted Client-Side
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            <div className="p-3.5 rounded-xl bg-[#f5fafc]/85 border border-white/90 hover:border-[#112838]/30 transition-all flex items-start gap-3 shadow-xs">
                                <div className="w-8 h-8 rounded-lg bg-[#d0e4ee] text-[#112838] flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3a5566] block mb-0.5">
                                        Username
                                    </span>
                                    <p className="text-sm font-semibold text-[#0c1820] truncate">
                                        {user.username || '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-[#f5fafc]/85 border border-white/90 hover:border-[#112838]/30 transition-all flex items-start gap-3 shadow-xs">
                                <div className="w-8 h-8 rounded-lg bg-[#d0e4ee] text-[#112838] flex items-center justify-center shrink-0">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3a5566] block mb-0.5">
                                        Email Address
                                    </span>
                                    <p className="text-sm font-semibold text-[#0c1820] truncate">
                                        {user.email || '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-[#f5fafc]/85 border border-white/90 hover:border-[#112838]/30 transition-all flex items-start gap-3 shadow-xs">
                                <div className="w-8 h-8 rounded-lg bg-[#d0e4ee] text-[#112838] flex items-center justify-center shrink-0">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3a5566] block mb-0.5">
                                        Member Since
                                    </span>
                                    <p className="text-sm font-semibold text-[#0c1820] truncate">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-[#f5fafc]/85 border border-white/90 hover:border-[#112838]/30 transition-all flex items-start gap-3 shadow-xs">
                                <div className="w-8 h-8 rounded-lg bg-[#d0e4ee] text-[#112838] flex items-center justify-center shrink-0">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3a5566] block mb-0.5">
                                        Last Login
                                    </span>
                                    <p className="text-sm font-semibold text-[#0c1820] truncate">
                                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Current Session'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Reveal>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <Reveal index={2} className="lg:col-span-7">
                        <div className="bg-[#e1eef5]/70 rounded-2xl border border-white/80 p-6 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-7 h-7 rounded-lg bg-[#d0e4ee] text-[#112838] flex items-center justify-center">
                                    <KeyRound className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-[#0c1820]">
                                    Change Master Password
                                </h2>
                            </div>
                            <p className="text-xs text-[#3a5566] mb-5 pl-9">
                                Ensure your new password is long and complex. You use this to decrypt your entire vault.
                            </p>

                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1.5">
                                        Current Master Password
                                    </label>
                                    <input
                                        id="currentPassword"
                                        name="currentPassword"
                                        type="password"
                                        autoComplete="current-password"
                                        placeholder="Enter your current master password"
                                        required
                                        value={updatedPassword.currentPassword}
                                        onChange={onChange}
                                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] shadow-xs transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1.5">
                                        New Master Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="newPassword"
                                            name="newPassword"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            placeholder="Enter strong new master password"
                                            required
                                            value={updatedPassword.newPassword}
                                            onChange={onChange}
                                            className="w-full px-3.5 py-2.5 pr-10 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] shadow-xs transition-all"
                                        />
                                        <button
                                            type="button"
                                            aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5c7788] hover:text-[#0c1820] cursor-pointer"
                                            onClick={() => setShowPassword(prev => !prev)}
                                        >
                                            <IconSwap swapped={showPassword} from={Eye} to={EyeOff} className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="mt-3">
                                        <PasswordStrength password={updatedPassword.newPassword} mode="typing" />
                                    </div>
                                </div>

                                <motion.div animate={confirmShake}>
                                    <label className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1.5">
                                        Confirm New Master Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="confirmNewPassword"
                                        ref={confirmRef}
                                            name="confirmNewPassword"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            placeholder="Repeat new master password"
                                            required
                                            value={updatedPassword.confirmNewPassword}
                                            onChange={onChange}
                                            className={`w-full px-3.5 py-2.5 pr-10 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] shadow-xs transition-all ${passwordError ? 'border-rose-300 ring-2 ring-rose-400/30' : ''}`}
                                        />
                                    </div>
                                </motion.div>

                                <ErrorLine>{passwordError}</ErrorLine>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={`w-full py-3 px-4 text-sm font-semibold text-white rounded-xl shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-90 cursor-pointer ${
                                        saveState === 'done'
                                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-600/25'
                                            : 'bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] shadow-[#0284c7]/25'
                                    }`}
                                >
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.span
                                            key={saveState}
                                            className="flex items-center gap-2"
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -6 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            {saveState === 'saving' && (
                                                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                            )}
                                            {saveState === 'done' && (
                                                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                                    <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.1 }} />
                                                </svg>
                                            )}
                                            <span>
                                                {saveState === 'saving' ? 'Updating Password...' : saveState === 'done' ? 'Master Password Updated' : 'Update Master Password'}
                                            </span>
                                        </motion.span>
                                    </AnimatePresence>
                                </button>
                            </form>
                        </div>
                    </Reveal>
                    <div className="lg:col-span-5 space-y-6">
                    <Reveal index={3}>
                        <div className="bg-[#e1eef5]/70 rounded-2xl border border-white/80 p-6 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl">
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="w-8 h-8 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs">
                                    <ShieldAlert className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-[#0c1820]">Recovery key</h2>
                            </div>
                            <p className="text-xs text-[#3a5566] mb-4 leading-relaxed">
                                If you forget your master password, your recovery key is the only way back into your vault. It is shown once, so if you did not save it you can make a new one at any time. The old key then stops working.
                            </p>
                            <button
                                type="button"
                                onClick={() => openConfirmModal('recovery')}
                                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-[#112838] bg-white/80 hover:bg-white border border-white/90 rounded-xl shadow-xs transition-all cursor-pointer"
                            >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>Make a new recovery key</span>
                            </button>
                        </div>
                    </Reveal>
                    <Reveal index={4}>
                        <div className="bg-[#e1eef5]/70 rounded-2xl border border-rose-300/80 p-6 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl">
                            <div className="flex items-center gap-2.5 mb-2 text-rose-600">
                                <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-200/80 flex items-center justify-center shadow-xs">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                <h2 className="text-base font-bold text-rose-700">
                                    Danger Zone
                                </h2>
                            </div>
                            <p className="text-xs text-[#3a5566] mb-6 leading-relaxed">
                                Irreversible actions. Deleting passwords or your entire account cannot be undone. Please proceed with caution.
                            </p>

                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => openConfirmModal('passwords')}
                                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-rose-600 bg-white/80 hover:bg-rose-50 border border-rose-200/80 rounded-xl shadow-xs transition-all cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete All Passwords</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => openConfirmModal('account')}
                                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-xl shadow-md shadow-rose-600/20 active:scale-[0.99] transition-all cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete PassDrop Account</span>
                                </button>
                            </div>
                        </div>
                    </Reveal>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                onConfirm={() => modalState.action(confirmPassword)}
                message={modalState.message}
                title={modalState.title}
                confirmText={modalState.confirmText || "Yes, I'm sure"}
            >
                <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your master password to confirm"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-4 w-full px-3.5 py-2.5 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] shadow-xs transition-all"
                />
            </ConfirmationModal>
            {/* after the dialog above, so it is on top of it (and of its fading backdrop) */}
            {pendingRecoveryKey && (
                <RecoveryKey
                    recoveryKey={pendingRecoveryKey}
                    onContinue={() => { clearPendingRecoveryKey(); setPendingRecoveryKey(null); }}
                />
            )}
        </div>
    );
}
