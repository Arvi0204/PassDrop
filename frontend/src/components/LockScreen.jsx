import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { ErrorLine } from './common/FormError';
import { unlock } from '../lib/accountApi';
import { getToken, saveVaultKey, signOut } from '../lib/session';

// Signed in but locked: a reopened tab has the sign-in (localStorage) but not the vault key (sessionStorage). The master
// password opens the vault again; nothing is stored unless it is right.
export default function LockScreen({ onUnlocked }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const host = import.meta.env.VITE_BACKEND;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const result = await unlock(host, getToken(), password);
            if (result.ok) {
                await saveVaultKey(result.vaultKey);
                onUnlocked?.();
            } else {
                setError(result.error);
            }
        } catch {
            setError('Cannot connect to the server. Try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOut = () => {
        signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-transparent">
            <div className="relative z-[26] w-full max-w-md bg-[#e1eef5]/70 rounded-3xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl p-6 sm:p-10">
                <div className="w-11 h-11 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs mb-4">
                    <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-[#0c1820]">Vault frozen</h3>
                <p className="text-xs sm:text-sm text-[#3a5566] mt-1.5">
                    Your passwords are encrypted. Enter your master password to unlock them.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label
                            htmlFor="lock-password"
                            className="block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1.5"
                        >
                            Master Password
                        </label>
                        <input
                            id="lock-password"
                            type="password"
                            autoComplete="current-password"
                            autoFocus
                            required
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            placeholder="Enter master password"
                            className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all shadow-xs"
                        />
                    </div>

                    <ErrorLine>{error}</ErrorLine>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-70 cursor-pointer"
                    >
                        <span>{isLoading ? 'Unlocking...' : 'Unlock Vault'}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>

                <button
                    type="button"
                    onClick={handleSignOut}
                    className="mt-5 w-full text-center text-xs font-semibold text-[#3a5566] hover:text-[#0c1820] hover:underline cursor-pointer"
                >
                    Sign out instead
                </button>
            </div>
        </div>
    );
}
