import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Sparkles, X, RefreshCw } from "lucide-react";
import PasswordStrength from "./Vault/PasswordStrength";

const CHARACTER_SETS = {
  letters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  specialChars: "!@#$%^&*()_+[]{}|;:,.<>?",
};

const Generator = ({ isOpen, setIsGeneratorModalOpen }) => {
  const [settings, setSettings] = useState({
    length: 16,
    includeNumbers: true,
    includeSpecialChars: true,
  });

  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const secureRandomChar = (str) => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return str.charAt(array[0] % str.length);
  };

  const secureRandomInt = (max) => {
    if (max <= 0) return 0;
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
  };

  const generatePassword = () => {
    let charset = CHARACTER_SETS.letters;
    const requiredChars = [];

    if (settings.includeNumbers) {
      charset += CHARACTER_SETS.numbers;
      requiredChars.push(secureRandomChar(CHARACTER_SETS.numbers));
    }

    if (settings.includeSpecialChars) {
      charset += CHARACTER_SETS.specialChars;
      requiredChars.push(secureRandomChar(CHARACTER_SETS.specialChars));
    }

    const effectiveLength = Math.max(requiredChars.length, settings.length || 8);
    const fillLength = Math.max(0, effectiveLength - requiredChars.length);

    let password = Array.from({ length: fillLength }, () =>
      secureRandomChar(charset)
    ).join("");

    requiredChars.forEach((char) => {
      const randomIndex = secureRandomInt(password.length + 1);
      password =
        password.slice(0, randomIndex) + char + password.slice(randomIndex);
    });
    setGeneratedPassword(password);
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setCopied(false);
      setIsGeneratorModalOpen(false);
    }, 700);
  };

  useEffect(() => {
    if (isOpen) {
      generatePassword();
    }
  }, [settings, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsGeneratorModalOpen(false)}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 z-10 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/80 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Password Generator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGeneratorModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Password Preview Box */}
            <div className="space-y-2 mb-6">
              <div className="relative flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                <span className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100 select-all truncate pr-10">
                  {generatedPassword}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(generatedPassword)}
                  className="p-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white transition-all shrink-0 shadow-sm"
                  title="Copy password"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={generatedPassword} />
            </div>

            {/* Length Slider */}
            <div className="mb-6 space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Password Length</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-blue-600 dark:text-cyan-400 font-mono">
                  {settings.length} characters
                </span>
              </div>
              <input
                type="range"
                min="6"
                max="40"
                value={settings.length}
                onChange={(e) =>
                  setSettings({ ...settings, length: Number(e.target.value) })
                }
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 mb-6">
              {[
                { id: "numbers", label: "Include Numbers (0-9)", key: "includeNumbers" },
                { id: "symbols", label: "Include Symbols (!@#$...)", key: "includeSpecialChars" },
              ].map(({ id, label, key }) => (
                <label
                  key={id}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={() =>
                      setSettings({ ...settings, [key]: !settings[key] })
                    }
                    className="w-4 h-4 text-blue-600 dark:text-cyan-400 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 dark:focus:ring-cyan-400 bg-white dark:bg-slate-800"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {/* Regenerate & Copy Button */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={generatePassword}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
              <button
                type="button"
                onClick={() => copyText(generatedPassword)}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy & Close</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Generator;