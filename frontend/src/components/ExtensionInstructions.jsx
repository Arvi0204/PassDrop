import React from "react";
import { Download, ShieldAlert } from "lucide-react";
import PassDropLogo from "./common/PassDropLogo";

const ExtensionInstructions = () => {
  return (
    <div className="flex-1 bg-transparent py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-3xl w-full mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 mb-1">
            <PassDropLogo size={28} />
            <span className="font-extrabold text-lg text-[#112838] tracking-tight">
              PassDrop Browser Companion
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0c1820] tracking-tight">
            Install the Web Extension
          </h1>
          <p className="text-xs sm:text-sm text-[#3a5566] max-w-lg mx-auto font-medium">
            Autofill credentials across any web application instantly without leaving your workflow
          </p>
        </div>

        {/* Steps Card */}
        <div className="bg-[#e1eef5]/70 rounded-2xl border border-white/80 p-6 sm:p-8 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl space-y-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#3a5566]">
            Installation Steps
          </h2>

          <div className="space-y-4 text-sm text-[#0c1820]">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                1
              </span>
              <div>
                <strong className="text-[#0c1820]">Download the bundle:</strong> Download the pre-built{' '}
                <code className="text-xs px-2 py-0.5 rounded bg-[#f5fafc] border border-white/90 text-[#112838] font-mono">
                  PassDrop.zip
                </code>{' '}
                package and extract it into a local directory on your machine.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                2
              </span>
              <div>
                <strong className="text-[#0c1820]">Open Extensions Manager:</strong> In Chrome, Brave, Edge or Arc, navigate to{' '}
                <code className="text-xs px-2 py-0.5 rounded bg-[#f5fafc] border border-white/90 text-[#112838] font-mono">
                  chrome://extensions
                </code>.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                3
              </span>
              <div>
                <strong className="text-[#0c1820]">Enable Developer Mode:</strong> Toggle the switch located at the top-right corner of the Extensions dashboard.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                4
              </span>
              <div>
                <strong className="text-[#0c1820]">Load Unpacked:</strong> Click the <span className="font-semibold text-[#0c1820]">&ldquo;Load unpacked&rdquo;</span> button and pick the extracted extension folder.
              </div>
            </div>
          </div>

          {/* Developer Mode Disclaimer */}
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Developer Mode Permissions</p>
              <p className="text-amber-800 leading-relaxed">
                Chromium browsers may show standard developer warning banners during startup. This is normal for local unpacked extensions and ensures safe local execution.
              </p>
            </div>
          </div>

          {/* Download Action */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#112838] hover:bg-[#1b3d54] rounded-xl shadow-md shadow-[#112838]/20 transition-all hover:scale-[1.01] cursor-pointer"
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
