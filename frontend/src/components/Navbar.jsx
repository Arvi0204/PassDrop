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
  X
} from "lucide-react";
import toast from "react-hot-toast";
import passwordContext from "../context/passwordContext";
import PassDropLogo from "./common/PassDropLogo";
import Generator from "./Generator";
import ConfirmationModal from "./ConfirmationModal";

const Navbar = () => {
  const { setPasswordArray } = useContext(passwordContext);
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
      <header className="sticky top-0 z-30 bg-[#e1eef5]/75 backdrop-blur-xl border-b border-white/80 shadow-[0_4px_20px_-4px_rgba(22,44,58,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* PassDrop Logo & Wordmark */}
            <Link to={token ? "/" : "/home"} className="flex items-center gap-2.5 group">
              <PassDropLogo size={32} className="group-hover:scale-105 transition-transform" />
              <span className="font-extrabold text-lg tracking-tight flex items-center">
                <span className="text-[#112838]">
                  Pass
                </span>
                <span className="text-[#0284c7]">
                  Drop
                </span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            {token && (
              <nav className="hidden md:flex items-center gap-1.5">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  if (item.onClick) {
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.onClick}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl text-[#3a5566] hover:text-[#0c1820] hover:bg-white/60 transition-colors cursor-pointer"
                      >
                        <Icon className="w-4 h-4 text-[#4a6b82]" />
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
                          ? "bg-[#d0e4ee] text-[#0e293a] border border-[#b8d6e5] shadow-xs"
                          : "text-[#3a5566] hover:text-[#0c1820] hover:bg-white/60"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive(item.path) ? "text-[#112838]" : "text-[#4a6b82]"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Right Action: Auth / User Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              {token ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsLogoutModalOpen(true)}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#3a5566] hover:text-rose-600 hover:bg-rose-50/80 border border-white/80 hover:border-rose-200/80 rounded-xl transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>

                  {/* Mobile Menu Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-2 text-[#3a5566] hover:text-[#0c1820] hover:bg-white/60 rounded-xl"
                  >
                    {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#112838] hover:text-[#0c1820] hover:bg-white/60 rounded-xl transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#112838] hover:bg-[#1b3d54] rounded-xl shadow-md shadow-[#112838]/20 transition-all"
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
              className="md:hidden border-t border-white/60 bg-[#e1eef5]/95 px-4 py-3 space-y-1 backdrop-blur-xl"
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-xl text-[#3a5566] hover:text-[#0c1820] hover:bg-white/60"
                    >
                      <Icon className="w-4 h-4 text-[#4a6b82]" />
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
                        ? "bg-[#d0e4ee] text-[#0e293a] border border-[#b8d6e5]"
                        : "text-[#3a5566] hover:text-[#0c1820] hover:bg-white/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive(item.path) ? "text-[#112838]" : "text-[#4a6b82]"}`} />
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
