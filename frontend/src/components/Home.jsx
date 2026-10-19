import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, KeyRound, Sparkles, Send, Download, ArrowRight, CheckCircle2 } from 'lucide-react';
import PassDropLogo from './common/PassDropLogo';

const Home = () => {
    const token = sessionStorage.getItem('token');

    const features = [
        {
            title: 'AES-256 GCM Vault',
            description: 'Zero-knowledge client-side encryption. Passwords and credentials are fully shielded before reaching the database.',
            icon: KeyRound,
            accent: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
        },
        {
            title: 'Autofill Web Extension',
            description: 'Effortlessly log into your favorite sites with our smart browser companion. Autofill with a single click.',
            icon: Download,
            accent: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20'
        },
        {
            title: 'Crypto-Grade Generator',
            description: 'Generate high-entropy, mathematically random passwords locally using cryptographic APIs. Never predictable.',
            icon: Sparkles,
            accent: 'text-sky-500 bg-sky-500/10 border-sky-500/20'
        }
    ];

    return (
        <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-200">
            {/* Hero Section */}
            <section className="relative overflow-hidden pt-16 pb-20 px-4 sm:px-6 lg:px-8">
                {/* Subtle radial ambient glow */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/15 via-cyan-500/15 to-transparent blur-3xl pointer-events-none rounded-full" />

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    {/* Trust Pill */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-cyan-300 text-xs font-semibold mb-8 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                        <span>Zero-knowledge · AES-256 encrypted · Secure by design</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15] mb-6">
                        Your passwords,{' '}
                        <br className="hidden sm:inline" />
                        <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 dark:from-blue-400 dark:via-sky-400 dark:to-cyan-400 bg-clip-text text-transparent">
                            one secure drop.
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
                        PassDrop securely stores, generates, and autofills your digital identities.
                        And with instant encrypted sharing, drop passwords to colleagues and family that self-destruct once viewed.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link
                            to={token ? "/" : "/signup"}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                        >
                            <span>{token ? "Open My Vault" : "Get Started for Free"}</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <a
                            href="#features"
                            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all"
                        >
                            Explore Features
                        </a>
                    </div>
                </div>
            </section>

            {/* Core Features Grid */}
            <section id="features" className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Vault Architecture
                    </h2>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        Built for ultimate digital hygiene
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feat) => {
                        const Icon = feat.icon;
                        return (
                            <div
                                key={feat.title}
                                className="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700"
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-4 ${feat.accent}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                    {feat.title}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {feat.description}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Standout Feature Spotlight: PassDrop One-Time Sharing */}
                <div className="mt-8 rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-blue-900/20 via-slate-900/40 to-cyan-900/20 border border-blue-500/20 dark:border-cyan-500/30 relative overflow-hidden shadow-lg backdrop-blur-sm">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                        <div className="space-y-3 max-w-xl">
                            <div className="inline-flex items-center gap-2">
                                <PassDropLogo size={28} />
                                <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
                                    PassDrop Sharing
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/20">
                                    Coming Soon
                                </span>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-snug">
                                Share credentials once. Then gone forever.
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                Need to send a WiFi password, API key, or account access to a client or team member?
                                Generate an ephemeral, zero-knowledge link. The moment it is opened or expires, the secret self-destructs without saving any server logs.
                            </p>
                        </div>

                        <div className="w-full md:w-auto shrink-0">
                            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>Client-side URL fragment key</span>
                                </div>
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>Single-view TTL expiration</span>
                                </div>
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>Zero backend plaintext storage</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Bottom Footer Callout */}
            <footer className="py-8 border-t border-slate-200/80 dark:border-slate-800/80 mt-12 text-center text-xs text-slate-400 dark:text-slate-500">
                <p>PassDrop · Secure Password Vault & Instant Sharing · Built by Arvind M</p>
            </footer>
        </div>
    );
};

export default Home;
