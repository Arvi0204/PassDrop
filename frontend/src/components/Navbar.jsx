import { useContext, useState } from 'react';
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
import passwordContext from "../context/passwordContext";
import PassDropLogo from "./common/PassDropLogo";
import Generator from "./Generator";
import ConfirmationModal from "./ConfirmationModal";
import { spring } from "../lib/motion";
import { useTide } from "../context/useTide";
import { getToken, signOut } from "../lib/session";

const Navbar = () => {
  const { setPasswordArray } = useContext(passwordContext);
  const tide = useTide();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const token = getToken();

  // Logout is the vault being drained, like pulling the plug on a full tub: the water fades
  // in behind the confirmation dialog, and the moment the user confirms the level falls to
  // reveal the login page.
  const openLogoutDialog = () => {
    setIsLogoutModalOpen(true);
    tide.fillIn();
  };

  const cancelLogout = () => {
    setIsLogoutModalOpen(false);
    tide.fadeOut();
  };

  const confirmLogout = () => {
    setIsLogoutModalOpen(false);
    setPasswordArray([]);
    signOut(); // the token and the vault key
    // navigate and drain in the same tick, so the first frame already has the login page under the water
    navigate("/login");
    tide.drain();
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
      <header className="sticky top-0 z-30 bg-[#e1eef5]/75 backdrop-blur-xl shadow-[0_4px_20px_-4px_rgba(22,44,58,0.1)]">
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
                      className={`relative flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors ${
                        isActive(item.path)
                          ? "text-[#0284c7]"
                          : "text-[#3a5566] hover:text-[#0c1820] hover:bg-white/60"
                      }`}
                    >
                      {/* shared layoutId: the highlight slides to whichever link becomes active */}
                      {isActive(item.path) && (
                        <motion.span
                          layoutId="nav-active-pill"
                          transition={spring.snappy}
                          className="absolute inset-0 rounded-xl bg-[#e0f2fe] border border-[#bae6fd] shadow-xs"
                        />
                      )}
                      <Icon className={`relative w-4 h-4 ${isActive(item.path) ? "text-[#0284c7]" : "text-[#4a6b82]"}`} />
                      <span className="relative">{item.label}</span>
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
                    onClick={openLogoutDialog}
                    type="button"
                    title="Log Out"
                    className="group inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100/90 border border-rose-200/80 hover:border-rose-300 shadow-xs rounded-xl transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
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
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 transition-all"
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
        onClose={cancelLogout}
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
