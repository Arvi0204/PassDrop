import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, KeyRound, Sparkles, ArrowRight } from 'lucide-react';
import toast from "react-hot-toast";
import { useNavigate, Link } from "react-router-dom";
import PassDropLogo from './common/PassDropLogo';
import { useTide } from '../context/useTide';

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

    // Tide transition: water rises behind the card while the account is created
    const tide = useTide();
    const cardRef = useRef(null);
    const succeeded = useRef(false);

    useEffect(() => () => {
        if (!succeeded.current) tide.abort();
    }, [tide]);

    const failTide = async () => {
        tide.shake(cardRef.current);
        await tide.cancel();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            setPasswordError("Passwords do not match");
            return;
        } else {
            setPasswordError('');
        }

        setIsLoading(true);
        let drained = Promise.resolve();
        tide.begin();

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
                succeeded.current = true;
                tide.leave(cardRef.current);
                await tide.complete();
                tide.queueEntrance();
                navigate("/");
                // the vault releases the water once its data is ready (see Manager.jsx)
                toast.success("Account created! Vault initialized.");
            } else {
                drained = failTide();
                const errors = json.errors || [{ msg: json.error || 'Failed to create account' }];
                errors.forEach(error => {
                    toast.error(error.msg);
                });
            }
        } catch (error) {
            console.error("Signup error:", error);
            drained = failTide();
            toast.error("An error occurred connecting to the server.");
        } finally {
            // keep the button locked until the water has receded after a failed attempt
            drained.then(() => setIsLoading(false));
        }
    };

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm(prevForm => ({ ...prevForm, [name]: value }));
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-transparent">
            <div ref={cardRef} className="relative z-[26] w-full max-w-4xl bg-[#e1eef5]/70 rounded-3xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
                
                {/* Left Brand Panel (Desktop) */}
                <div className="hidden md:flex md:col-span-5 bg-gradient-to-br from-[#112838] via-[#1a384e] to-[#244c66] text-white p-8 flex-col justify-between relative overflow-hidden border-r border-white/20">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

                    <div>
                        <div className="flex items-center gap-2 mb-8">
                            <PassDropLogo size={28} />
                            <span className="font-extrabold text-base tracking-tight">
                                <span className="text-white">Pass</span>
                                <span className="text-[#38bdf8]">Drop</span>
                            </span>
                        </div>

                        <h2 className="text-2xl font-black leading-tight mb-3">
                            Set up your <br />
                            <span className="bg-gradient-to-r from-white via-[#d0e4ee] to-[#bce1f2] bg-clip-text text-transparent">
                                private vault.
                            </span>
                        </h2>

                        <p className="text-xs text-white/80 leading-relaxed mb-6 font-medium">
                            Start securing your digital identity today with military-grade encryption and one-time password drops.
                        </p>

                        <div className="space-y-3 text-xs text-white/90">
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-white/20 text-[#d0e4ee] flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                </div>
                                <span>Zero-knowledge client security</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-white/20 text-[#d0e4ee] flex items-center justify-center shrink-0">
                                    <KeyRound className="w-3.5 h-3.5" />
                                </div>
                                <span>Encrypted credential storage</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-white/20 text-[#d0e4ee] flex items-center justify-center shrink-0">
                                    <Sparkles className="w-3.5 h-3.5" />
                                </div>
                                <span>Single-view ephemeral sharing</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-[11px] text-white/60 pt-6 border-t border-white/10">
                        100% free · Open source · No trackers
                    </div>
                </div>

                {/* Right Form Panel */}
                <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold text-[#0c1820]">
                                Create your account
                            </h3>
                            <p className="text-xs sm:text-sm text-[#3a5566] mt-1">
                                Create a master password to encrypt your entire vault
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3.5">
                            <div>
                                <label
                                    htmlFor="username"
                                    className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1"
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
                                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all shadow-xs"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1"
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
                                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all shadow-xs"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1"
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
                                        className="w-full px-3.5 py-2 pr-10 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all shadow-xs"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5c7788] hover:text-[#0c1820] transition-colors cursor-pointer"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1"
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
                                        className="w-full px-3.5 py-2 pr-10 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all shadow-xs"
                                    />
                                </div>
                            </div>

                            {passwordError && (
                                <p className="text-xs font-semibold text-rose-500">{passwordError}</p>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-3 py-3 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-70 cursor-pointer"
                            >
                                <span>{isLoading ? "Creating Vault..." : "Create Free Vault"}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>

                        <div className="mt-5 pt-4 border-t border-white/60 text-center text-xs text-[#3a5566]">
                            Already have an account?{' '}
                            <Link
                                to="/login"
                                className="font-bold text-[#0284c7] hover:underline"
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
