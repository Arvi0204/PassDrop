import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, KeyRound, Sparkles, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, Link } from "react-router-dom";
import PassDropLogo from './common/PassDropLogo';

export default function Login() {
    const [credentials, setCredentials] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const host = import.meta.env.VITE_BACKEND;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch(`${host}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            const json = await response.json();

            if (json.success) {
                sessionStorage.setItem('token', json.authToken);
                navigate("/");
                toast.success("Welcome back to your vault!");
            } else {
                const errors = json.errors || [{ msg: json.error || "Login failed. Check your credentials." }];
                errors.forEach(error => {
                    toast.error(error.msg);
                });
            }
        } catch (error) {
            console.error("Login fetch error:", error);
            toast.error("Cannot connect to backend server. Make sure it is running on port 3000.");
        } finally {
            setIsLoading(false);
        }
    };

    const onChange = (e) => {
        const { name, value } = e.target;
        setCredentials((prev) => ({ ...prev, [name]: value }));
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
                            Every password, <br />
                            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-cyan-400 bg-clip-text text-transparent">
                                one secure drop.
                            </span>
                        </h2>

                        <p className="text-xs text-slate-400 leading-relaxed mb-6">
                            Unlock your encrypted vault to access credentials, generate high-entropy keys, and share securely.
                        </p>

                        <div className="space-y-3 text-xs text-slate-300">
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                </div>
                                <span>AES-256 client-level encryption</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                                    <KeyRound className="w-3.5 h-3.5" />
                                </div>
                                <span>Zero-knowledge master password</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-3.5 h-3.5" />
                                </div>
                                <span>PassDrop ephemeral sharing</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-[11px] text-slate-500 pt-6 border-t border-slate-800/80">
                        Zero logs stored · Open-source design
                    </div>
                </div>

                {/* Right Form Panel */}
                <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Welcome back
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Enter your master credentials to decrypt your vault
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
                                >
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={credentials.email}
                                    onChange={onChange}
                                    placeholder="name@example.com"
                                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label
                                        htmlFor="password"
                                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                                    >
                                        Master Password
                                    </label>
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        required
                                        value={credentials.password}
                                        onChange={onChange}
                                        placeholder="Enter master password"
                                        className="w-full px-3.5 py-2.5 pr-10 text-sm font-mono rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all"
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

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-2 py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-70"
                            >
                                <span>{isLoading ? "Decrypting Vault..." : "Unlock Vault"}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>

                        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700/80 text-center text-xs text-slate-500 dark:text-slate-400">
                            Don't have an account yet?{' '}
                            <Link
                                to="/signup"
                                className="font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                            >
                                Create your free vault
                            </Link>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
