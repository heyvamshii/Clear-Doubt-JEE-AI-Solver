import { Camera, Zap, CircleCheck } from "lucide-react";

const ITEMS = [
  {
    Icon: Camera,
    title: "Type, Paste, or Snap",
    body: "MCQ, theory, or a photo of the question",
  },
  {
    Icon: Zap,
    title: "AI Analyzes It",
    body: "Like a top JEE teacher breaking it down",
  },
  {
    Icon: CircleCheck,
    title: "Get the Full Reasoning",
    body: "Correct answer + why others are wrong",
  },
];

export default function HowItWorks() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 mt-16 mb-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-center text-white/90 font-semibold text-lg sm:text-xl mb-8">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ITEMS.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl bg-white/5 border border-white/10 p-5 backdrop-blur-sm hover:border-emerald-accent/40 transition-colors"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-accent/15 text-emerald-accent mb-3">
                <Icon size={20} strokeWidth={2.2} />
              </div>
              <h3 className="text-white font-semibold text-base">{title}</h3>
              <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
