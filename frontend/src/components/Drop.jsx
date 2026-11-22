import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Check, Copy, Eye, EyeOff, ExternalLink, Gift, Link2Off } from 'lucide-react';
import { openDrop } from '../lib/dropApi';
import { describeRule, keyFromHash } from '../lib/drop';

const card = 'w-full max-w-md bg-[#e1eef5]/70 rounded-3xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl p-6 sm:p-10';
const copyButton = 'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#112838] bg-white/80 hover:bg-white border border-white/90 rounded-lg shadow-xs cursor-pointer';

function Field({ label, value, secret }) {
    const [shown, setShown] = useState(false);
    const [copied, setCopied] = useState(false);
    if (!value) return null;
    const copy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div>
            <p className="text-xs font-semibold text-[#0c1820] mb-1.5">{label}</p>
            <div className="flex items-center gap-2">
                <p className="flex-1 min-w-0 px-3.5 py-2.5 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] break-all">
                    {secret && !shown ? '••••••••••••' : value}
                </p>
                {secret && (
                    <button type="button" onClick={() => setShown(!shown)} className={copyButton} aria-label={shown ? `Hide ${label}` : `Show ${label}`}>
                        {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                )}
                <button type="button" onClick={copy} className={copyButton} aria-label={`Copy ${label}`}>
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </div>
        </div>
    );
}

/**
 * What the person who gets a drop link sees (/drop/:id#key). No account needed. Nothing is fetched until they press Reveal,
 * so a chat app previewing the link cannot use up a view. The login is decrypted here and held in memory only.
 */
export default function Drop() {
    const host = import.meta.env.VITE_BACKEND;
    const { id } = useParams();
    const linkKey = keyFromHash(useLocation().hash);
    const [state, setState] = useState({ status: 'ready' }); // ready | opening | open | gone | error
    // a link without its key can never be opened, so it does not even offer to try
    const status = linkKey ? state.status : 'broken';

    const reveal = async () => {
        setState({ status: 'opening' });
        try {
            const result = await openDrop(host, id, linkKey);
            if (result.ok) setState({ status: 'open', ...result });
            else setState({ status: result.gone ? 'gone' : 'error', error: result.error });
        } catch {
            setState({ status: 'error', error: 'Cannot connect to the server. Try again.' });
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className={card}>
                {status === 'open' ? (
                    <div className="space-y-4">
                        <div>
                            <h1 className="text-2xl font-bold text-[#0c1820] break-words">{state.item.title || state.item.url || 'Shared login'}</h1>
                            {state.item.url && (
                                <a href={/^https?:\/\//.test(state.item.url) ? state.item.url : `https://${state.item.url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#0284c7] hover:underline mt-1 font-medium break-all">
                                    {state.item.url} <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                            )}
                        </div>
                        <Field label="Username" value={state.item.username} />
                        <Field label="Password" value={state.item.password} secret />
                        {state.item.notes && (
                            <div>
                                <p className="text-xs font-semibold text-[#0c1820] mb-1.5">Notes</p>
                                <p className="px-3.5 py-2.5 text-sm rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] whitespace-pre-wrap break-words">{state.item.notes}</p>
                            </div>
                        )}
                        <p className="text-xs text-[#3a5566] leading-relaxed">
                            {describeRule(state)}. This page keeps the login in memory only: it is gone when you leave, so copy what you need now.
                        </p>
                    </div>
                ) : status === 'gone' || status === 'broken' ? (
                    <div className="text-center">
                        <div className="w-11 h-11 mx-auto rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs mb-4">
                            <Link2Off className="w-6 h-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-[#0c1820]">{status === 'gone' ? 'This drop is gone' : 'This link is incomplete'}</h1>
                        <p className="text-sm text-[#3a5566] mt-2">
                            {status === 'gone' ? 'It has ended, or the sender revoked it. Ask them for a new one.' : 'The part after the # is missing or was changed. Ask the sender to send the whole link again.'}
                        </p>
                    </div>
                ) : (
                    <div>
                        <div className="w-11 h-11 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs mb-4">
                            <Gift className="w-6 h-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-[#0c1820]">Someone shared a login with you</h1>
                        <p className="text-sm text-[#3a5566] mt-1.5">
                            It is encrypted, and only this link can open it. If the sender limited its views, revealing it uses one, so press Reveal when you are ready to copy what you need.
                        </p>
                        {status === 'error' && <p role="alert" className="mt-3 text-sm text-rose-700">{state.error}</p>}
                        <button
                            type="button"
                            onClick={reveal}
                            disabled={status === 'opening'}
                            className="mt-6 w-full py-3 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 disabled:opacity-70 cursor-pointer"
                        >
                            {status === 'opening' ? 'Opening...' : 'Reveal login'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
