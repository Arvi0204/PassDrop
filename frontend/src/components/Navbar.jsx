import React, { useContext, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Sparkles,
  User,
  Download,
  LogOut,
  Menu,
  X,
  Sun,
  Moon
} from "lucide-react";
import toast from "react-hot-toast";
import passwordContext from "../context/passwordContext";
import { useTheme } from "../context/ThemeContext";
import PassDropLogo from "./common/PassDropLogo";
import Generator from "./Generator";
import ConfirmationModal from "./ConfirmationModal";

const Navbar = () => {
  const { setPasswordArray } = useContext(passwordContext);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const token = sessionStorage.getItem("token");

  const confirmLogout = async () => {
    await setPasswordArray([]);
    sessionStorage.removeItem("token");
    navigate("/login");
    toast.success("Logged out successfully");
    setIsLogoutModalOpen(false);
  };

  const navLinks = [
    { label: "Vault", path: "/", icon: KeyRound },
    { label: "Generator", onClick: () => setIsGeneratorModalOpen(true), icon: Sparkles },
    { label: "Account", path: "/user", icon: User },
    { label: "Extension", path: "/extension", icon: Download }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* PassDrop Logo & Wordmark */}
            <Link to={token ? "/" : "/home"} className="flex items-center gap-2.5 group">
              <PassDropLogo size={32} className="group-hover:scale-105 transition-transform" />
              <span className="font-extrabold text-lg tracking-tight flex items-center">
                <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 dark:from-blue-400 dark:via-sky-400 dark:to-cyan-400 bg-clip-text text-transparent">
                  Pass
                </span>
                <span className="text-slate-900 dark:text-slate-100">
                  Drop
                </span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            {token && (
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  if (item.onClick) {
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.onClick}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <span>{item.label}</span>
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={item.label}
                      to={item.path}
                      className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                        isActive(item.path)
                          ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-cyan-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive(item.path) ? "text-blue-600 dark:text-cyan-400" : "text-slate-400 dark:text-slate-500"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Right Action: Theme Switch + Auth Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                className="p-2 rounded-xl text-slate-600 dark:text-amber-400 hover:text-slate-900 dark:hover:text-amber-300 bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" /> : <Moon className="w-4 h-4 text-slate-700 fill-slate-700/10" />}
              </button>

              {token ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsLogoutModalOpen(true)}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900/50 rounded-xl transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>

                  {/* Mobile Menu Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-sm shadow-blue-500/20 transition-all"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {token && isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-1"
            >
              {navLinks.map((item) => {
                const Icon = item.icon;
                if (item.onClick) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        item.onClick();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <span>{item.label}</span>
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-xl ${
                      isActive(item.path)
                        ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-cyan-400"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive(item.path) ? "text-blue-600 dark:text-cyan-400" : "text-slate-400 dark:text-slate-500"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
        message="Are you sure you want to log out of PassDrop?"
        confirmText="Log Out"
      />

      {/* Password Generator Modal */}
      <Generator
        isOpen={isGeneratorModalOpen}
        setIsGeneratorModalOpen={setIsGeneratorModalOpen}
      />
    </>
  );
};

export default Navbar;