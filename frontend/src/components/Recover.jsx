import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LifeBuoy, ArrowRight } from 'lucide-react';
import IconSwap from './common/IconSwap';
import { ErrorLine } from './common/FormError';
import PasswordStrength from './Vault/PasswordStrength';
import { MIN_PASSWORD_LENGTH, TOO_SHORT_MESSAGE } from '../lib/passwordStrength';
import { recover } from '../lib/accountApi';
import { saveSignIn, saveVaultKey } from '../lib/session';

const field = 'w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all shadow-xs';
const label = 'block text-xs font-semibold text-[#0c1820] uppercase tracking-wider mb-1.5';

// Forgot the master password: the recovery key opens the vault, and a new master password locks it again. The key is
// turned into proofs in the browser; the server never sees it.
export default function Recover() {
    const [form, setForm] = useState({ email: '', recoveryKey: '', newPassword: '', confirmPassword: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const host = import.meta.env.VITE_BACKEND;

    const onChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.newPassword.length < MIN_PASSWORD_LENGTH) {
            setError(TOO_SHORT_MESSAGE);
            return;
        }
        if (form.newPassword !== form.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setIsLoading(true);
        try {
            const result = await recover(host, { email: form.email, recoveryKey: form.recoveryKey, newPassword: form.newPassword });
            if (result.ok) {
                saveSignIn({ token: result.token, userId: result.userId });
                await saveVaultKey(result.vaultKey);
                navigate('/');
            } else {
                setError(result.error);
            }
        } catch {
            setError('Cannot connect to the server. Try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-transparent">
            <div className="relative z-[26] w-full max-w-md bg-[#e1eef5]/70 rounded-3xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl p-6 sm:p-10">
                <div className="w-11 h-11 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs mb-4">
                    <LifeBuoy className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-[#0c1820]">Recover your vault</h3>
                <p className="text-xs sm:text-sm text-[#3a5566] mt-1.5">
                    Enter your email and the recovery key you saved when you signed up, then choose a new master password.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="email" className={label}>Email address</label>
                        <input id="email" name="email" type="email" autoComplete="email" required value={form.email} onChange={onChange} placeholder="name@example.com" className={field} />
                    </div>

                    <div>
                        <label htmlFor="recoveryKey" className={label}>Recovery key</label>
                        <input id="recoveryKey" name="recoveryKey" type="text" autoComplete="off" spellCheck="false" required value={form.recoveryKey} onChange={onChange} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" className={`${field} font-mono`} />
                    </div>

                    <div>
                        <label htmlFor="newPassword" className={label}>New master password</label>
                        <div className="relative">
                            <input id="newPassword" name="newPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={form.newPassword} onChange={onChange} placeholder="Choose a strong master key" className={`${field} pr-10 font-mono`} />
                            <button
                                type="button"
                                aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#5c7788] hover:text-[#0c1820] transition-colors cursor-pointer"
                                onClick={() => setShowPassword((prev) => !prev)}
                            >
                                <IconSwap swapped={showPassword} from={Eye} to={EyeOff} className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-2">
                            <PasswordStrength password={form.newPassword} mode="typing" />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className={label}>Confirm new master password</label>
                        <input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={form.confirmPassword} onChange={onChange} placeholder="Repeat master password" className={`${field} font-mono`} />
                    </div>

                    <ErrorLine>{error}</ErrorLine>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-70 cursor-pointer"
                    >
                        <span>{isLoading ? 'Recovering...' : 'Recover vault'}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>

                <div className="mt-5 text-center text-xs text-[#3a5566]">
                    Remembered it?{' '}
                    <Link to="/login" className="font-bold text-[#0284c7] hover:underline">Sign in</Link>
                </div>
            </div>
        </div>
    );
}
