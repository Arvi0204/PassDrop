import React from 'react';
import { Shield } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="bg-white border-t border-slate-200/80 py-6 text-slate-500 text-xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white">
                        <Shield className="w-3 h-3" />
                    </div>
                    <span className="font-semibold text-slate-800">
                        PassHaven
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-400">Zero-compromise security</span>
                </div>
                <div className="text-slate-400">
                    Built by <span className="font-medium text-slate-600">Arvind M</span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
