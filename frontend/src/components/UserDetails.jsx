import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Mail, Calendar, Clock, KeyRound, AlertTriangle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from './ConfirmationModal';

export default function UserDetails() {
    const [user, setUser] = useState({
        username: "",
        email: "",
        createdAt: "",
        lastLogin: ""
    });
    const host = import.meta.env.VITE_BACKEND;
    const [updatedPassword, setUpdatedPassword] = useState({ newPassword: "", confirmNewPassword: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [modalState, setModalState] = useState({ isOpen: false, message: "", action: null });
    const token = sessionStorage.getItem("token");
    const navigate = useNavigate();

    useEffect(() => {
        if (!token) {
            navigate('/login');
        } else {
            fetchUserDetails();
        }
    }, [token]);

    const fetchUserDetails = async () => {
        try {
            const response = await fetch(`${host}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': token
                }
            });
            const data = await response.json();
            setUser(data);
        } catch (error) {
            toast.error("Failed to fetch user details");
        }
    };

    const onChange = (e) => {
        setUpdatedPassword({ ...updatedPassword, [e.target.name]: e.target.value });
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (updatedPassword.newPassword !== updatedPassword.confirmNewPassword) {
            setPasswordError("Passwords do not match");
            return;
        } else {
            setPasswordError('');
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${host}/api/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': token
                },
                body: JSON.stringify({
                    newPassword: updatedPassword.newPassword
                })
            });
            const json = await response.json();
            if (json.success) {
                toast.success(json.message || "Master password updated successfully");
                setUpdatedPassword({ newPassword: "", confirmNewPassword: "" });
            } else {
                toast.error(json.error || "Failed to update master password");
            }
        } catch (error) {
            toast.error("An error occurred. Check backend connection.");
        } finally {
            setIsLoading(false);
        }
    };

    const openConfirmModal = (actionType) => {
        if (actionType === 'passwords') {
            setModalState({
                isOpen: true,
                message: "Are you sure you want to delete ALL stored passwords? This cannot be undone.",
                action: () => handleDeleteAllPasswords()
            });
        } else if (actionType === 'account') {
            setModalState({
                isOpen: true,
                message: "Are you sure you want to delete your entire PassDrop account and all associated credentials? This cannot be undone.",
                action: () => handleDeleteAccount()
            });
        }
    };

    const handleDeleteAllPasswords = async () => {
        try {
            const response = await fetch(`${host}/api/passwords`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': token
                }
            });
            const json = await response.json();
            if (json.success) {
                toast.success("All credentials deleted from vault");
                setModalState({ ...modalState, isOpen: false });
            } else {
                toast.error(json.error || "Failed to delete passwords");
            }
        } catch (error) {
            toast.error("An error occurred");
            setModalState({ ...modalState, isOpen: false });
        }
    };

    const handleDeleteAccount = async () => {
        try {
            const response = await fetch(`${host}/api/auth/me`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'auth-token': token
                }
            });
            const json = await response.json();
            if (json.success) {
                toast.success(json.message || "Account deleted successfully");
                sessionStorage.removeItem('token');
                setModalState({ ...modalState, isOpen: false });
                navigate("/home");
            } else {
                toast.error(json.error || "Failed to delete account");
            }
        } catch (error) {
            toast.error("An error occurred deleting account");
            setModalState({ ...modalState, isOpen: false });
        }
    };

    return (
        <div className="flex-1 bg-slate-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Profile Header */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Account & Security
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Manage your vault identity, update master credentials, and oversee security settings
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column: Profile & Master Password */}
                    <div className="lg:col-span-7 space-y-6">
                        
                        {/* Profile Info Card */}
                        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm transition-colors">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                                Personal Information
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                                        <User className="w-3.5 h-3.5 text-blue-500 dark:text-cyan-400" />
                                        <span>Username</span>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                        {user.username || '—'}
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                                        <Mail className="w-3.5 h-3.5 text-blue-500 dark:text-cyan-400" />
                                        <span>Email Address</span>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                        {user.email || '—'}
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Member Since</span>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Last Login</span>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Current Session'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Master Password Update Card */}
                        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                                <KeyRound className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                    Change Master Password
                                </h2>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                                Ensure your new password is long and complex. You use this to decrypt your entire vault.
                            </p>

                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
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
                                            className="w-full px-3.5 py-2.5 pr-10 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                            onClick={() => setShowPassword(prev => !prev)}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                        Confirm New Master Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="confirmNewPassword"
                                            name="confirmNewPassword"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            placeholder="Repeat new master password"
                                            required
                                            value={updatedPassword.confirmNewPassword}
                                            onChange={onChange}
                                            className="w-full px-3.5 py-2.5 pr-10 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all"
                                        />
                                    </div>
                                </div>

                                {passwordError && (
                                    <p className="text-xs font-semibold text-rose-500">{passwordError}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                >
                                    <span>{isLoading ? "Updating Password..." : "Update Master Password"}</span>
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Right Column: Danger Zone */}
                    <div className="lg:col-span-5">
                        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-rose-200/80 dark:border-rose-950/80 p-6 shadow-sm transition-colors">
                            <div className="flex items-center gap-2 mb-2 text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <h2 className="text-base font-bold">
                                    Danger Zone
                                </h2>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                Irreversible actions. Deleting passwords or your entire account cannot be undone. Please proceed with caution.
                            </p>

                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => openConfirmModal('passwords')}
                                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 rounded-xl transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete All Passwords</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => openConfirmModal('account')}
                                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete PassDrop Account</span>
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ ...modalState, isOpen: false })}
                onConfirm={modalState.action}
                message={modalState.message}
                confirmText="Yes, I'm sure"
            />
        </div>
    );
}