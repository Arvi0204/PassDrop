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
            className="fixed inset-0 bg-[#0c1820]/50 backdrop-blur-sm"
            onClick={() => setIsGeneratorModalOpen(false)}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-[#e1eef5]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/80 p-6 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/60 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-[#0c1820]">
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
                <span className="font-mono text-base font-semibold text-[#0c1820] select-all truncate pr-10">
                  {generatedPassword}
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

            {/* Length Slider & Quick Presets */}
            <div className="mb-6 space-y-2.5">
              <div className="flex justify-between items-center text-xs font-semibold text-[#0c1820]">
                <span>Password Length</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    {[12, 16, 20, 24].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSettings({ ...settings, length: preset })}
                        className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                          settings.length === preset
                            ? 'bg-gradient-to-r from-[#0284c7] to-[#0077b6] text-white shadow-xs'
                            : 'bg-white/80 text-[#3a5566] hover:text-[#0c1820] border border-white/80'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#e0f2fe] text-[#0284c7] font-mono font-bold text-xs border border-[#bae6fd] shadow-xs">
                    {settings.length}
                  </span>
                </div>
              </div>

              {/* High-visibility Slider Track with fill gradient */}
              <div className="relative py-1">
                <input
                  type="range"
                  min="6"
                  max="40"
                  value={settings.length}
                  onChange={(e) =>
                    setSettings({ ...settings, length: Number(e.target.value) })
                  }
                  style={{
                    background: `linear-gradient(to right, #0284c7 0%, #0284c7 ${((settings.length - 6) / 34) * 100}%, #b9d1df ${((settings.length - 6) / 34) * 100}%, #b9d1df 100%)`
                  }}
                  className="w-full h-2.5 rounded-lg appearance-none cursor-pointer accent-[#0284c7] border border-white/90 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
                />
                <div className="flex justify-between items-center text-[10px] font-mono text-[#4a697e] mt-1 px-0.5 font-medium">
                  <span>6 chars</span>
                  <span>40 chars</span>
                </div>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 mb-6">
              {[
                { id: "numbers", label: "Include Numbers (0-9)", key: "includeNumbers" },
                { id: "symbols", label: "Include Symbols (!@#$...)", key: "includeSpecialChars" },
              ].map(({ id, label, key }) => (
                <label
                  key={id}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-white/80 bg-white/50 hover:bg-white/80 cursor-pointer transition-colors shadow-xs"
                >
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={() =>
                      setSettings({ ...settings, [key]: !settings[key] })
                    }
                    className="w-4 h-4 text-[#0284c7] rounded border-slate-300 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-[#0c1820]">
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
