import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, KeyRound, Sparkles, ArrowRight } from 'lucide-react';
import toast from "react-hot-toast";
import { useNavigate, Link } from "react-router-dom";
import PassDropLogo from './common/PassDropLogo';

export default function Signup() {
    const [form, setForm] = useState({
        username: "",
        email: "",
        password: "",
        confirmPassword: ""
    });
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const host = import.meta.env.VITE_BACKEND;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            setPasswordError("Passwords do not match");
            return;
        } else {
            setPasswordError('');
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${host}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: form.username,
                    email: form.email,
                    password: form.password
                })
            });

            const json = await response.json();
            if (json.success) {
                sessionStorage.setItem('token', json.authToken);
                navigate("/");
                toast.success("Account created! Vault initialized.");
            } else {
                const errors = json.errors || [{ msg: json.error || 'Failed to create account' }];
                errors.forEach(error => {
                    toast.error(error.msg);
                });
            }
        } catch (error) {
            console.error("Signup error:", error);
            toast.error("An error occurred connecting to the server.");
        } finally {
            setIsLoading(false);
        }
    };

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm(prevForm => ({ ...prevForm, [name]: value }));
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
            <div className="w-full max-w-4xl bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
                
                {/* Left Brand Panel (Desktop) */}
                <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-8 flex-col justify-between relative overflow-hidden border-r border-slate-800">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div>
                        <div className="flex items-center gap-2 mb-8">
                            <PassDropLogo size={28} />
                            <span className="font-extrabold text-base tracking-tight">
                                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Pass</span>
                                <span>Drop</span>
                            </span>
                        </div>

                        <h2 className="text-2xl font-black leading-tight mb-3">
                            Set up your <br />
                            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-cyan-400 bg-clip-text text-transparent">
                                private vault.
                            </span>
                        </h2>

                        <p className="text-xs text-slate-400 leading-relaxed mb-6">
                            Start securing your digital identity today with military-grade encryption and one-time password drops.
                        </p>

                        <div className="space-y-3 text-xs text-slate-300">
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                </div>
                                <span>Zero-knowledge client security</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                                    <KeyRound className="w-3.5 h-3.5" />
                                </div>
                                <span>Encrypted credential storage</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-3.5 h-3.5" />
                                </div>
                                <span>Single-view ephemeral sharing</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-[11px] text-slate-500 pt-6 border-t border-slate-800/80">
                        100% free · Open source · No trackers
                    </div>
                </div>

                {/* Right Form Panel */}
                <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Create your account
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Create a master password to encrypt your entire vault
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3.5">
                            <div>
                                <label
                                    htmlFor="username"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
                                >
                                    Full Name / Username
                                </label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={form.username}
                                    onChange={onChange}
                                    placeholder="Jane Doe"
                                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
                                >
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={form.email}
                                    onChange={onChange}
                                    placeholder="name@example.com"
                                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
                                >
                                    Master Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={form.password}
                                        onChange={onChange}
                                        placeholder="Choose a strong master key"
                                        className="w-full px-3.5 py-2 pr-10 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
                                >
                                    Confirm Master Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={form.confirmPassword}
                                        onChange={onChange}
                                        placeholder="Repeat master password"
                                        className="w-full px-3.5 py-2 pr-10 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all"
                                    />
                                </div>
                            </div>

                            {passwordError && (
                                <p className="text-xs font-semibold text-rose-500">{passwordError}</p>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-3 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-70"
                            >
                                <span>{isLoading ? "Creating Vault..." : "Create Free Vault"}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>

                        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/80 text-center text-xs text-slate-500 dark:text-slate-400">
                            Already have an account?{' '}
                            <Link
                                to="/login"
                                className="font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                            >
                                Sign in to vault
                            </Link>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
