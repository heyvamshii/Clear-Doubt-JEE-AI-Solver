"use client";

import { useRef, useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import AnswerOutput from "./AnswerOutput";
import type { Subject } from "@/lib/systemPrompt";

const SUBJECTS: Subject[] = ["Physics", "Chemistry", "Maths"];

export default function SolverCard() {
  const [subject, setSubject] = useState<Subject>("Physics");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSolve() {
    const trimmed = question.trim();
    if (!trimmed || isStreaming) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setAnswer("");
    setHasSubmitted(true);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, question: trimmed }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        let msg = `Request failed (${res.status})`;
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) msg = parsed.error;
        } catch {
          if (text) msg = text;
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setAnswer((prev) => prev + chunk);
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="max-w-[760px] w-full mx-auto bg-white text-gray-900 rounded-[20px] shadow-card p-5 sm:p-8 -mt-2">
      {/* Subject selector */}
      <div
        className="grid grid-cols-3 gap-2 p-1 bg-soft rounded-full"
        role="tablist"
        aria-label="Subject"
      >
        {SUBJECTS.map((s) => {
          const active = subject === s;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={active}
              onClick={() => setSubject(s)}
              className={[
                "rounded-full py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-emerald-accent text-white shadow"
                  : "text-gray-700 hover:bg-white",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Question input */}
      <label htmlFor="question" className="sr-only">
        Your JEE question
      </label>
      <textarea
        id="question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Paste your JEE question here... include all 4 options if it's MCQ"
        className="mt-5 w-full min-h-[140px] resize-y bg-soft text-gray-900 placeholder:text-gray-400 rounded-2xl p-4 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-accent/40 focus:border-emerald-accent/40 text-[15px] leading-relaxed"
      />

      {/* Solve button */}
      <button
        type="button"
        onClick={handleSolve}
        disabled={isStreaming || question.trim().length === 0}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-accent hover:bg-emerald-accentHover disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 transition-colors"
      >
        {isStreaming ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Zap size={18} strokeWidth={2.5} />
        )}
        {isStreaming ? "Solving..." : "Solve This Question"}
      </button>

      {/* Answer */}
      {hasSubmitted && (
        <AnswerOutput
          subject={subject}
          text={answer}
          isStreaming={isStreaming}
          error={error}
        />
      )}
    </div>
  );
}
