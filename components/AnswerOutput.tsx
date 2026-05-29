"use client";

import { useMemo } from "react";
import katex from "katex";
import type { Subject } from "@/lib/systemPrompt";

/* ─── Subject auto-detect marker ──────────────────────────────── */
// The system prompt forces the model to start every response with one of:
//   [SUBJECT: Physics]   [SUBJECT: Chemistry]   [SUBJECT: Maths]
// We parse it for the badge and strip it from the visible answer.

const SUBJECT_MARKER_RE =
  /^\s*\[\s*SUBJECT\s*:\s*(Physics|Chemistry|Maths)\s*\]\s*\n*/i;

function parseDetectedSubject(text: string): Subject | null {
  const m = text.match(SUBJECT_MARKER_RE);
  if (!m) return null;
  const lower = m[1].toLowerCase();
  if (lower === "physics") return "Physics";
  if (lower === "chemistry") return "Chemistry";
  if (lower === "maths") return "Maths";
  return null;
}

// Also hides a partial marker that is still streaming in (e.g. "[SUBJECT: Phys")
// so the raw marker never flashes on screen before it finishes arriving.
const PARTIAL_MARKER_RE = /^\s*\[\s*SUBJECT\b[^\]]*$/i;
const MARKER_PREFIX = "[SUBJECT:";

function stripSubjectMarker(text: string): string {
  const full = text.replace(SUBJECT_MARKER_RE, "");
  if (full !== text) return full; // complete marker found and removed

  // "[SUBJECT: Phys", opened but not yet closed
  if (PARTIAL_MARKER_RE.test(text)) return "";

  // The very first characters of the marker, e.g. "[", "[S", "[SUB"
  const lead = text.replace(/^\s+/, "");
  if (
    lead.length > 0 &&
    lead.length <= MARKER_PREFIX.length &&
    MARKER_PREFIX.toUpperCase().startsWith(lead.toUpperCase())
  ) {
    return "";
  }

  return text;
}

/* ─── Section detection ───────────────────────────────────────── */

const SECTION_HEADERS = [
  "QUICK TAKE",
  "THE CORE CONCEPT",
  "STEP-BY-STEP REASONING",
  "WHY NOT THE OTHER OPTIONS",
  "MEMORY HOOK",
] as const;

type SectionHeading = (typeof SECTION_HEADERS)[number];
type Section = { heading: SectionHeading | null; body: string };

function parseSections(text: string): Section[] {
  if (!text) return [];
  const lines = text.split("\n");
  const sections: Section[] = [];
  let current: Section = { heading: null, body: "" };

  for (const line of lines) {
    if (/^-{3,}$/.test(line.trim())) continue; // skip --- dividers
    const stripped = line.trim().replace(/[*_:#]+/g, "").trim();
    const matchedHeader = SECTION_HEADERS.find((h) =>
      stripped.toUpperCase().startsWith(h)
    );
    if (matchedHeader && stripped.length <= matchedHeader.length + 30) {
      if (current.heading !== null || current.body.trim()) {
        sections.push(current);
      }
      current = { heading: matchedHeader, body: "" };
    } else {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current.heading !== null || current.body.trim()) sections.push(current);
  return sections;
}

/* ─── HTML helpers ────────────────────────────────────────────── */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─── Inline renderer (bulletproof) ───────────────────────────── */
//
// Strategy: extract ALL math first, replace each match with an opaque
// placeholder, then process bold/italic on the remaining text, finally
// restore the math HTML. Because the placeholders are made of Unicode
// Private-Use-Area characters (U+E000 and U+E001), they are guaranteed
// never to appear in user text and they cannot be touched by the bold
// (\*\*...\*\*) or italic (\*...\*, _..._) regexes.
//
// Handles every nesting case Gemini produces, e.g.:
//   **Half-life ($t_{1/2}$) Dependence:**   → bold with math inside
//   *Note: $F = ma$ is Newton's law*        → italic with math inside
//   _Energy $E = mc^2$ is conserved_        → italic with math inside

// Defined via String.fromCharCode so the SOURCE is pure ASCII and no tool
// can accidentally strip these characters. At runtime they become real
// PUA codepoints.
const PH_OPEN  = String.fromCharCode(0xE000);
const PH_CLOSE = String.fromCharCode(0xE001);
// Regex built dynamically so it uses the actual runtime characters.
const PH_RESTORE_RE = new RegExp(PH_OPEN + "(\\d+)" + PH_CLOSE, "g");

function renderInlineHtml(raw: string): string {
  const slots: string[] = [];
  const stash = (html: string) => {
    slots.push(html);
    return PH_OPEN + (slots.length - 1) + PH_CLOSE;
  };

  let s = raw;

  /* 1) Extract display math  $$...$$  (most specific, multi-line allowed) */
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, math: string) => {
    try {
      const html = katex.renderToString(math.trim(), {
        throwOnError: false,
        displayMode: true,
        output: "html",
      });
      return stash(
        `<span style="display:inline-block;overflow-x:auto;max-width:100%;vertical-align:middle">${html}</span>`
      );
    } catch {
      return stash(`<code>${esc(math)}</code>`);
    }
  });

  /* 2) Extract inline math  $...$  */
  s = s.replace(/\$([^$\n]+?)\$/g, (_, math: string) => {
    try {
      return stash(
        katex.renderToString(math, { throwOnError: false, output: "html" })
      );
    } catch {
      return stash(esc(`$${math}$`));
    }
  });

  /* 3) HTML-escape everything else. Placeholders survive, esc() only
        touches & < > and " . */
  s = esc(s);

  /* 4) Process bold and italic. Placeholders are opaque to these regexes
        because PUA chars are not in [^*\n] or [^_\n] exclusion sets... wait,
        they ARE in those sets (since PUA chars are not * or _ or \n).  So
        a placeholder INSIDE a bold/italic span is fine, it gets included
        as inner content and survives untouched into step 5. */
  s = s.replace(
    /\*\*([^*\n]+?)\*\*/g,
    (_, inner: string) =>
      `<strong style="font-weight:600;color:#111827">${inner}</strong>`
  );
  s = s.replace(
    /(?<!\*)\*([^*\n]+?)\*(?!\*)/g,
    (_, inner: string) =>
      `<em style="font-style:italic;color:#4b5563">${inner}</em>`
  );
  s = s.replace(
    /_([^_\n]+?)_/g,
    (_, inner: string) =>
      `<em style="font-style:italic;color:#4b5563">${inner}</em>`
  );

  /* 5) Restore math placeholders with their KaTeX HTML */
  s = s.replace(PH_RESTORE_RE, (_, idx: string) => slots[parseInt(idx, 10)] ?? "");

  return s;
}

/* ─── Display-math block renderer  ($$...$$ on its own line) ──── */

function renderDisplayMathHtml(math: string): string {
  try {
    const inner = katex.renderToString(math.trim(), {
      throwOnError: false,
      displayMode: true,
      output: "html",
    });
    return (
      `<div style="overflow-x:auto;text-align:center;` +
      `background:#f8fafc;border:1px solid rgba(16,185,129,0.18);` +
      `border-radius:12px;padding:16px 12px;margin:10px 0">` +
      inner +
      `</div>`
    );
  } catch {
    return `<pre style="font-family:monospace;font-size:0.875rem;color:#6b7280">${esc(math)}</pre>`;
  }
}

/* ─── bodyToHtml ─────────────────────────────────────────────── */
//
// Converts a section body string into a complete HTML snippet. Handles:
//   $$...$$ (one-line or multi-line) → display math block
//   1. ...  → <ol> items (with correct start number)
//   * / -   → <ul> items
//   everything else → <p> paragraphs
// Inline math / bold / italic are processed inside every text node
// via renderInlineHtml.

function bodyToHtml(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let inOL = false;
  let inUL = false;
  let olStart = 1;
  let i = 0;

  function closeLists() {
    if (inOL) { out.push("</ol>"); inOL = false; }
    if (inUL) { out.push("</ul>"); inUL = false; }
  }

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    i++;

    if (!t) { closeLists(); continue; }

    // ── display math: $$...$$ on a single line ──────────────────
    if (t.startsWith("$$") && t.endsWith("$$") && t.length > 4) {
      closeLists();
      out.push(renderDisplayMathHtml(t.slice(2, -2)));
      continue;
    }

    // ── display math: opening $$ of a multi-line block ──────────
    if (t === "$$") {
      closeLists();
      const mathLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "$$") {
        mathLines.push(lines[i]);
        i++;
      }
      i++; // consume closing $$
      out.push(renderDisplayMathHtml(mathLines.join("\n")));
      continue;
    }

    // ── numbered list item ───────────────────────────────────────
    const numM = t.match(/^(\d+)\.\s+([\s\S]*)/);
    if (numM) {
      if (!inOL) {
        closeLists();
        olStart = parseInt(numM[1], 10);
        out.push(
          `<ol start="${olStart}" style="list-style-type:decimal;padding-left:1.5rem;margin:6px 0">`
        );
        inOL = true;
      }
      out.push(
        `<li style="margin-bottom:8px;line-height:1.75;color:#374151">` +
          renderInlineHtml(numM[2]) +
          `</li>`
      );
      continue;
    }

    // ── bullet list item ─────────────────────────────────────────
    const bulM = t.match(/^[*\-]\s+([\s\S]*)/);
    if (bulM) {
      if (!inUL) {
        closeLists();
        out.push(
          `<ul style="list-style-type:disc;padding-left:1.5rem;margin:6px 0">`
        );
        inUL = true;
      }
      out.push(
        `<li style="margin-bottom:6px;line-height:1.75;color:#374151">` +
          renderInlineHtml(bulM[1]) +
          `</li>`
      );
      continue;
    }

    // ── regular paragraph line ───────────────────────────────────
    closeLists();
    out.push(
      `<p style="margin:5px 0;line-height:1.75;color:#374151">` +
        renderInlineHtml(t) +
        `</p>`
    );
  }

  closeLists();
  return out.join("\n");
}

/* ─── SectionBody (memoised) ─────────────────────────────────── */

function SectionBody({ body }: { body: string }) {
  const html = useMemo(() => bodyToHtml(body), [body]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ─── AnswerOutput ───────────────────────────────────────────── */

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
  const detectedSubject = useMemo(() => parseDetectedSubject(text), [text]);
  const cleanText       = useMemo(() => stripSubjectMarker(text),  [text]);
  const sections        = useMemo(() => parseSections(cleanText),  [cleanText]);
  const hasContent      = cleanText.trim().length > 0;

  // Badge shows the *detected* subject once available; falls back to the
  // user's selected tab during the first few streaming tokens.
  const displaySubject = detectedSubject ?? subject;
  const isMismatch     = detectedSubject !== null && detectedSubject !== subject;

  return (
    <div
      className="mt-6 rounded-2xl bg-emerald-tint border border-emerald-accent/20 p-5 sm:p-6 animate-fadeInUp"
      aria-live="polite"
    >
      {/* Header bar */}
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
        <span
          title={
            isMismatch
              ? `You picked ${subject}, but this looks like a ${displaySubject} question, so the style switched to match.`
              : displaySubject
          }
          className={[
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border text-xs font-semibold transition-colors",
            isMismatch
              ? "border-amber-400/50 text-amber-600"
              : "border-emerald-accent/30 text-emerald-accent",
          ].join(" ")}
        >
          {isMismatch && <span aria-hidden>↻</span>}
          {displaySubject}
        </span>
      </div>

      <div className="mt-4 answer-scroll">
        {error && (
          <div className="text-red-600 text-sm font-medium">{error}</div>
        )}

        {!error && !hasContent && (
          <p className="text-gray-400 italic text-[15px]">
            Your explanation will appear here…
          </p>
        )}

        {!error && hasContent && (
          <div className="space-y-5 text-[16px]">
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
                        "font-bold tracking-wide mb-2",
                        isWhyNot
                          ? "text-gray-900 text-[15px] uppercase"
                          : "text-emerald-accent text-[13px] uppercase",
                      ].join(" ")}
                    >
                      {isWhyNot ? "Why not the other options?" : s.heading}
                    </h3>
                  )}
                  {s.body.trim() && <SectionBody body={s.body.trim()} />}
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
