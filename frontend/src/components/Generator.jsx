import { useState, useEffect, useRef, useId } from 'react';
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Sparkles, X, RefreshCw } from "lucide-react";
import PasswordStrength from "./Vault/PasswordStrength";
import GeneratorOptions from "./common/GeneratorOptions";
import { flyDropInto, dropIsInstant } from "../lib/dropIn";
import { generatePassword as buildPassword, DEFAULT_OPTIONS } from "../lib/passwordGen";
import "../styles/water.css";
import useEscapeKey from "../lib/useEscapeKey";
import useDialogFocus from "../lib/useDialogFocus";

// Visual only: characters shown while a new password "rolls in". The real password is chosen
// separately with crypto.getRandomValues and is what gets copied.
const ROLL_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

/**
 * Shows `value`. When `rollId` changes, the characters spin through random ones and settle
 * on the real ones one after another from left to right, like a slot machine. A change of
 * `value` without a new `rollId` (slider, toggles) is shown immediately.
 */
const RollingPassword = ({ value, rollId, flash }) => {
  const [shown, setShown] = useState(value);
  const rolling = useRef(false);
  const lastRoll = useRef(rollId);
  const latest = useRef(value);
  latest.current = value;

  // declared before the value effect so `rolling` is already set when both run together
  useEffect(() => {
    if (rollId === lastRoll.current) return undefined;
    lastRoll.current = rollId;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(latest.current);
      return undefined;
    }

    rolling.current = true;
    const start = performance.now();
    const tick = () => {
      const target = latest.current;
      const stagger = Math.min(24, 460 / Math.max(target.length, 1));
      const locked = Math.floor((performance.now() - start - 160) / stagger);
      if (locked >= target.length) {
        clearInterval(timer);
        rolling.current = false;
        setShown(target);
        return;
      }
      let out = "";
      for (let i = 0; i < target.length; i += 1) {
        out += i < locked ? target[i] : ROLL_CHARS[Math.floor(Math.random() * ROLL_CHARS.length)];
      }
      setShown(out);
    };
    const timer = setInterval(tick, 45);
    tick();

    return () => {
      clearInterval(timer);
      rolling.current = false;
    };
  }, [rollId]);

  useEffect(() => {
    if (!rolling.current) setShown(value);
  }, [value]);

  return (
    <>
      {[...shown].map((ch, i) => {
        const added =
          flash && !rolling.current && (flash.kind === "symbol" ? /[^A-Za-z0-9]/.test(ch) : /[0-9]/.test(ch));
        return (
          <span key={i} className={added ? "pw-flash" : undefined}>
            {ch}
          </span>
        );
      })}
    </>
  );
};

const Generator = ({ isOpen, setIsGeneratorModalOpen }) => {
  useEscapeKey(isOpen, () => setIsGeneratorModalOpen(false));
  const dialogRef = useRef(null);
  const titleId = useId();
  useDialogFocus(isOpen, dialogRef);

  const [settings, setSettings] = useState(DEFAULT_OPTIONS);

  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [rollId, setRollId] = useState(0); // bump to make the password roll in
  const [flash, setFlash] = useState(null); // characters a drop has just carried in: { kind: 'symbol' | 'number' }
  const skipRegen = useRef(false); // set while a drop is in flight, so the new password waits for it to land
  const previewRef = useRef(null);

  const generatePassword = (cfg = settings) => {
    setGeneratedPassword(buildPassword(cfg));
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error('Could not copy. Select the password and copy it by hand.'); // the dialog stays open so it can be selected
      return;
    }
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setCopied(false);
      setIsGeneratorModalOpen(false);
    }, 700);
  };

  useEffect(() => {
    if (isOpen) {
      if (skipRegen.current) {
        skipRegen.current = false;
        return;
      }
      setFlash(null);
      generatePassword();
    }
  }, [settings, isOpen]);

  // the password rolls in when the dialog opens and when Regenerate is pressed, not while the
  // length slider or the toggles are being adjusted
  useEffect(() => {
    if (isOpen) setRollId((n) => n + 1);
  }, [isOpen]);

  const regenerate = () => {
    setFlash(null);
    generatePassword();
    setRollId((n) => n + 1);
  };

  // Ticking an option carries its characters into the password: a drop flies from the check
  // box to the preview and the new password appears where it lands, with the new characters
  // highlighted. Unticking just regenerates.
  const toggleOption = (key, boxEl) => {
    const next = { ...settings, [key]: !settings[key] };

    if (!next[key] || dropIsInstant() || !previewRef.current) {
      setSettings(next);
      return;
    }

    skipRegen.current = true;
    setSettings(next);
    flyDropInto(boxEl, previewRef.current, () => {
      generatePassword(next);
      setFlash({ kind: key === "includeNumbers" ? "number" : "symbol" });
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0c1820]/50 backdrop-blur-sm"
            onClick={() => setIsGeneratorModalOpen(false)}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative w-full max-w-md bg-[#e1eef5]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/80 p-6 z-10 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/60 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 id={titleId} className="text-lg font-bold text-[#0c1820]">
                  Password Generator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGeneratorModalOpen(false)}
                className="p-1 rounded-lg text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Password Preview Box */}
            <div className="space-y-2 mb-6">
              <div className="relative flex items-center justify-between p-3.5 bg-[#f5fafc]/85 border border-white/90 rounded-xl shadow-xs">
                <span ref={previewRef} className="font-mono text-base font-semibold text-[#0c1820] select-all truncate pr-10">
                  <RollingPassword value={generatedPassword} rollId={rollId} flash={flash} />
                </span>
                <button
                  type="button"
                  onClick={() => copyText(generatedPassword)}
                  className="p-2 rounded-lg bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] text-white transition-all shrink-0 shadow-xs cursor-pointer"
                  title="Copy password"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={generatedPassword} />
            </div>

            <div className="mb-6">
              <GeneratorOptions
                settings={settings}
                onLength={(length) => setSettings({ ...settings, length })}
                onToggle={toggleOption}
              />
            </div>

            {/* Regenerate & Copy Button */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={regenerate}
                className="flex-1 py-2.5 px-4 bg-white/70 hover:bg-white text-[#3a5566] hover:text-[#0c1820] border border-white/80 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
              <button
                type="button"
                onClick={() => copyText(generatedPassword)}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] text-white text-xs font-semibold rounded-xl shadow-md shadow-[#0284c7]/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy &amp; Close</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Generator;
