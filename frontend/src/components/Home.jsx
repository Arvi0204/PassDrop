import { Link } from 'react-router-dom';
import { KeyRound, Sparkles, Download, ArrowRight } from 'lucide-react';
import Reveal from './common/Reveal';
import { getToken } from '../lib/session';

const Home = () => {
    const token = getToken();

    const features = [
        {
            title: 'AES-256 GCM Vault',
            description: 'Zero-knowledge client-side encryption. Passwords and credentials are fully shielded before reaching the database.',
            icon: KeyRound,
            accent: 'text-[#112838] bg-[#d0e4ee] border-[#b8d6e5]'
        },
        {
            title: 'Autofill Web Extension',
            description: 'Effortlessly log into your favorite sites with our smart browser companion. Autofill with a single click.',
            icon: Download,
            accent: 'text-[#112838] bg-[#d0e4ee] border-[#b8d6e5]'
        },
        {
            title: 'Crypto-Grade Generator',
            description: 'Generate high-entropy, mathematically random passwords locally using cryptographic APIs. Never predictable.',
            icon: Sparkles,
            accent: 'text-emerald-700 bg-emerald-100 border-emerald-200'
        }
    ];

    return (
        <div className="min-h-[calc(100vh-64px)] bg-transparent text-[#0c1820]">
            {/* Hero Section */}
            <section className="relative overflow-hidden pt-16 pb-20 px-4 sm:px-6 lg:px-8">
                {/* Subtle radial ambient glow */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-white/20 via-sky-100/30 to-transparent blur-3xl pointer-events-none rounded-full" />

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    {/* Trust Pill */}
                    <Reveal index={0}>
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/90 bg-white/80 text-[#0e293a] text-xs font-semibold mb-8 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-[#112838] animate-pulse" />
                            <span>Zero-knowledge · AES-256 encrypted · Secure by design</span>
                        </div>
                    </Reveal>

                    <Reveal index={1}>
                        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#0c1820] leading-[1.15] mb-6">
                            Your passwords,{' '}
                            <br className="hidden sm:inline" />
                            <span className="bg-gradient-to-r from-[#112838] via-[#24546e] to-[#3a7594] bg-clip-text text-transparent">
                                one secure drop.
                            </span>
                        </h1>
                    </Reveal>

                    <Reveal index={2}>
                        <p className="text-base sm:text-lg text-[#1e3b4d] max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                            PassDrop securely stores, generates, and autofills your digital identities.
                            Experience clean Nordic frosted glass privacy engineered for zero-knowledge safety.
                        </p>
                    </Reveal>

                    <Reveal index={3}>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link
                                to={token ? "/" : "/signup"}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 transition-all hover:scale-[1.02]"
                            >
                                <span>{token ? "Open My Vault" : "Get Started for Free"}</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                            <a
                                href="#features"
                                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-[#0c1820] bg-white/80 hover:bg-white border border-white/90 rounded-xl shadow-xs transition-all"
                            >
                                Explore Features
                            </a>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* Core Features Grid */}
            <section id="features" className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
                <div className="text-center mb-10">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-[#2d4d60]">
                        Vault Architecture
                    </h2>
                    <p className="text-2xl font-bold text-[#0c1820] mt-1">
                        Built for ultimate digital hygiene
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feat, i) => {
                        const Icon = feat.icon;
                        return (
                            <Reveal
                                key={feat.title}
                                index={i}
                                inView
                                className="p-6 rounded-2xl bg-[#e1eef5]/70 border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl transition-all"
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-4 shadow-xs ${feat.accent}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-bold text-[#0c1820] mb-2">
                                    {feat.title}
                                </h3>
                                <p className="text-sm text-[#3a5566] leading-relaxed">
                                    {feat.description}
                                </p>
                            </Reveal>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

export default Home;
