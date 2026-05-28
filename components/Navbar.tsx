import { Atom } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="bg-navy border-b border-emerald-accent/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-accent/15 text-emerald-accent">
            <Atom size={20} strokeWidth={2.2} />
          </span>
          <div className="leading-tight">
            <div className="text-white font-bold text-lg tracking-tight">
              ClearDoubt
            </div>
            <div className="text-emerald-accent text-[11px] font-medium -mt-0.5">
              JEE AI Solver
            </div>
          </div>
        </div>

        <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-accent" />
          Powered by Gemini
        </div>
      </div>
    </nav>
  );
}
