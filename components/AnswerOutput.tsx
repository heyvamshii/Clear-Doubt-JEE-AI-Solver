"use client";

import { useMemo } from "react";
import type { Subject } from "@/lib/systemPrompt";

const SECTION_HEADERS = [
  "QUICK TAKE",
  "THE CORE CONCEPT",
  "STEP-BY-STEP REASONING",
  "WHY NOT THE OTHER OPTIONS",
  "MEMORY HOOK",
] as const;

type Section = { heading: string | null; body: string };

function parseSections(text: string): Section[] {
  if (!text) return [];
  const lines = text.split("\n");
  const sections: Section[] = [];
  let current: Section = { heading: null, body: "" };

  for (const line of lines) {
    const stripped = line.trim().replace(/[*_:#]+/g, "").trim();
    const matchedHeader = SECTION_HEADERS.find((h) =>
      stripped.toUpperCase().startsWith(h)
    );

    if (matchedHeader && stripped.length <= matchedHeader.length + 30) {
      if (current.heading !== null || current.body.trim().length > 0) {
        sections.push(current);
      }
      current = { heading: matchedHeader, body: "" };
    } else {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current.heading !== null || current.body.trim().length > 0) {
    sections.push(current);
  }
  return sections;
}

function renderInline(text: string) {
  // Lightweight bold for **...** so the model's emphasis still reads well.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-gray-900">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function AnswerOutput({
  subject,
  text,
  isStreaming,
  error,
}: {
  subject: Subject;
  text: string;
  isStreaming: boolean;
  error: string | null;
}) {
  const sections = useMemo(() => parseSections(text), [text]);
  const hasContent = text.trim().length > 0;

  return (
    <div
      className="mt-6 rounded-2xl bg-emerald-tint border border-emerald-accent/20 p-5 sm:p-6 animate-fadeInUp"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-accent" />
          <span className="text-sm font-semibold text-gray-800 tracking-wide">
            AI Explanation
          </span>
          {isStreaming && (
            <span className="text-xs text-emerald-accent font-medium">
              streaming…
            </span>
          )}
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-emerald-accent/30 text-emerald-accent text-xs font-semibold">
          {subject}
        </span>
      </div>

      <div className="mt-4 answer-scroll">
        {error && (
          <div className="text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        {!error && !hasContent && (
          <p className="text-gray-400 italic text-[15px]">
            Your explanation will appear here...
          </p>
        )}

        {!error && hasContent && (
          <div className="space-y-5 text-[16px] leading-[1.7] text-gray-700">
            {sections.map((s, idx) => {
              const isWhyNot = s.heading === "WHY NOT THE OTHER OPTIONS";
              return (
                <div key={idx}>
                  {isWhyNot && (
                    <hr className="border-t border-emerald-accent/25 mb-5" />
                  )}
                  {s.heading && (
                    <h3
                      className={[
                        "font-bold tracking-wide mb-1.5",
                        isWhyNot
                          ? "text-gray-900 text-[15px] uppercase"
                          : "text-emerald-accent text-[13px] uppercase",
                      ].join(" ")}
                    >
                      {isWhyNot ? "Why not the other options?" : s.heading}
                    </h3>
                  )}
                  {s.body && (
                    <div className="whitespace-pre-wrap">
                      {renderInline(s.body.trim())}
                    </div>
                  )}
                </div>
              );
            })}
            {isStreaming && (
              <span
                aria-hidden
                className="inline-block w-2 h-4 align-text-bottom bg-emerald-accent/70 animate-pulse ml-0.5"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
