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
        <div className="flex-1 bg-transparent py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Profile Header */}
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

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column: Profile & Master Password */}
                    <div className="lg:col-span-7 space-y-6">
                        
                        {/* Profile Info Card */}
                        <div className="bg-[#e1eef5]/70 rounded-2xl border border-white/80 p-6 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl">
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/60">
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

                        {/* Master Password Update Card */}
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
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5c7788] hover:text-[#0c1820] cursor-pointer"
                                            onClick={() => setShowPassword(prev => !prev)}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1.5">
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
                                            className="w-full px-3.5 py-2.5 pr-10 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] shadow-xs transition-all"
                                        />
                                    </div>
                                </div>

                                {passwordError && (
                                    <p className="text-xs font-semibold text-rose-500">{passwordError}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#112838] hover:bg-[#1b3d54] rounded-xl shadow-md shadow-[#112838]/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                                >
                                    <span>{isLoading ? "Updating Password..." : "Update Master Password"}</span>
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Right Column: Danger Zone */}
                    <div className="lg:col-span-5">
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
