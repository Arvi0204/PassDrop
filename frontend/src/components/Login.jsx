import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, KeyRound, Sparkles, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, Link } from "react-router-dom";
import PassDropLogo from './common/PassDropLogo';
import IconSwap from './common/IconSwap';
import { useTide } from '../context/useTide';
import { signIn } from '../lib/accountApi';
import { saveSignIn, saveVaultKey } from '../lib/session';

export default function Login() {
    const [credentials, setCredentials] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const host = import.meta.env.VITE_BACKEND;

    // Tide transition: water rises behind the card while the server checks credentials
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
        setIsLoading(true);
        let drained = Promise.resolve();
        tide.begin();

        try {
            const result = await signIn(host, credentials);

            if (result.ok) {
                saveSignIn({ token: result.token, userId: result.userId });
                await saveVaultKey(result.vaultKey);
                succeeded.current = true;
                tide.leave(cardRef.current);
                await tide.complete();
                tide.queueEntrance();
                navigate("/");
                // the vault releases the water once its data is ready (see Manager.jsx)
            } else {
                drained = failTide();
                result.errors.forEach(msg => {
                    toast.error(msg);
                });
            }
        } catch (error) {
            console.error("Login fetch error:", error);
            drained = failTide();
            toast.error("Cannot connect to backend server. Make sure it is running on port 3000.");
        } finally {
            // keep the button locked until the water has receded after a failed attempt
            drained.then(() => setIsLoading(false));
        }
    };

    const onChange = (e) => {
        const { name, value } = e.target;
        setCredentials((prev) => ({ ...prev, [name]: value }));
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
                            Every password, <br />
                            <span className="bg-gradient-to-r from-white via-[#d0e4ee] to-[#bce1f2] bg-clip-text text-transparent">
                                one secure drop.
                            </span>
                        </h2>

                        <p className="text-xs text-white/80 leading-relaxed mb-6 font-medium">
                            Unlock your encrypted vault to access credentials, generate high-entropy keys, and share securely.
                        </p>

                        <div className="space-y-3 text-xs text-white/90">
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-white/20 text-[#d0e4ee] flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                </div>
                                <span>AES-256-GCM encryption in your browser</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-white/20 text-[#d0e4ee] flex items-center justify-center shrink-0">
                                    <KeyRound className="w-3.5 h-3.5" />
                                </div>
                                <span>Your master password never leaves this device</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-lg bg-white/20 text-[#d0e4ee] flex items-center justify-center shrink-0">
                                    <Sparkles className="w-3.5 h-3.5" />
                                </div>
                                <span>PassDrop ephemeral sharing</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-[11px] text-white/60 pt-6 border-t border-white/10">
                        Zero logs stored · Open-source design
                    </div>
                </div>

                {/* Right Form Panel */}
                <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold text-[#0c1820]">
                                Welcome back
                            </h3>
                            <p className="text-xs sm:text-sm text-[#3a5566] mt-1">
                                Enter your master credentials to decrypt your vault
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1.5"
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
                                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all shadow-xs"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label
                                        htmlFor="password"
                                        className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider"
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
                                        className="w-full px-3.5 py-2.5 pr-10 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all shadow-xs"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5c7788] hover:text-[#0c1820] transition-colors cursor-pointer"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                    >
                                        <IconSwap swapped={showPassword} from={Eye} to={EyeOff} className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-2 py-3 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-70 cursor-pointer"
                            >
                                <span>{isLoading ? "Decrypting Vault..." : "Unlock Vault"}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>

                        <div className="mt-6 text-center text-xs text-[#3a5566]">
                            <span>Don&apos;t have a PassDrop vault yet? </span>
                            <Link to="/signup" className="text-[#0284c7] font-bold hover:underline">
                                Create one here
                            </Link>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
