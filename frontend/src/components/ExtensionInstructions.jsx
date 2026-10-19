import React from "react";
import { Download, Chrome, ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";
import PassDropLogo from "./common/PassDropLogo";

const ExtensionInstructions = () => {
  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-900 py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-200 flex items-center justify-center">
      <div className="max-w-3xl w-full mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 mb-1">
            <PassDropLogo size={28} />
            <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
              PassDrop Browser Companion
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Install the Web Extension
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
            Autofill credentials across any web application instantly without leaving your workflow
          </p>
        </div>

        {/* Steps Card */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm transition-colors space-y-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Installation Steps
          </h2>

          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-blue-600 dark:text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white">Download the bundle:</strong> Download the pre-built{' '}
                <code className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-blue-600 dark:text-cyan-300">
                  PassDrop.zip
                </code>{' '}
                package and extract it into a local directory on your machine.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-blue-600 dark:text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white">Open Extensions Manager:</strong> In Chrome, Brave, Edge or Arc, navigate to{' '}
                <code className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-blue-600 dark:text-cyan-300">
                  chrome://extensions
                </code>.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-blue-600 dark:text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white">Enable Developer Mode:</strong> Toggle the switch located at the top-right corner of the Extensions dashboard.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-blue-600 dark:text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                4
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white">Load Unpacked:</strong> Click the <span className="font-semibold text-slate-900 dark:text-white">"Load unpacked"</span> button and pick the extracted extension folder.
              </div>
            </div>
          </div>

          {/* Developer Mode Disclaimer */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Developer Mode Permissions</p>
              <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
                Chromium browsers may show standard developer warning banners during startup. This is normal for local unpacked extensions and ensures safe local execution.
              </p>
            </div>
          </div>

          {/* Download Action */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01]"
              onClick={() => {
                const link = document.createElement("a");
                link.href = "/PassHavenWeb.zip";
                link.download = "PassDrop.zip";
                link.click();
              }}
            >
              <Download className="w-4 h-4" />
              <span>Download PassDrop Web Extension</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExtensionInstructions;
