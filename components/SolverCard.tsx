"use client";

import { useRef, useState, useCallback } from "react";
import { Zap, Loader2, ImagePlus, X, Camera } from "lucide-react";
import AnswerOutput from "./AnswerOutput";
import type { Subject } from "@/lib/systemPrompt";

const SUBJECTS: Subject[] = ["Physics", "Chemistry", "Maths"];

/* ─── Image resize utility ────────────────────────────────────────
   Resizes any image to max 1280px on its longest side and returns
   a JPEG base64 string.  Runs entirely in the browser via Canvas.
────────────────────────────────────────────────────────────────── */
type ImagePayload = { dataUrl: string; data: string; mime: string };

async function encodeImage(file: File): Promise<ImagePayload> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const MAX = 1280;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round((h * MAX) / w); w = MAX; }
        else        { w = Math.round((w * MAX) / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ dataUrl, data: dataUrl.split(",")[1], mime: "image/jpeg" });
    };

    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error("Image load failed")); };
    img.src = objUrl;
  });
}

/* ─── Component ───────────────────────────────────────────────── */

export default function SolverCard() {
  const [subject,      setSubject]      = useState<Subject>("Physics");
  const [question,     setQuestion]     = useState("");
  const [image,        setImage]        = useState<ImagePayload | null>(null);
  const [answer,       setAnswer]       = useState("");
  const [error,        setError]        = useState<string | null>(null);
  const [imgError,     setImgError]     = useState<string | null>(null);
  const [isStreaming,  setIsStreaming]   = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [dragOver,     setDragOver]     = useState(false);

  const abortRef    = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = !isStreaming && (question.trim().length > 0 || image !== null);

  /* ── Process any image File object ──────────────────────────── */
  const processFile = useCallback(async (file: File) => {
    setImgError(null);
    if (!file.type.startsWith("image/")) {
      setImgError("Only image files are supported (JPG, PNG, WEBP, HEIC…)");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setImgError("Image too large — please use a file under 20 MB.");
      return;
    }
    try {
      setImage(await encodeImage(file));
    } catch {
      setImgError("Could not process the image. Try a different file.");
    }
  }, []);

  /* ── File input ──────────────────────────────────────────────── */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = ""; // allow re-picking the same file
  }

  /* ── Clipboard paste (Ctrl+V / ⌘+V) ─────────────────────────── */
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (!e.clipboardData) return;
    const imgItem = Array.from(e.clipboardData.items)
      .find((it) => it.type.startsWith("image/"));
    if (imgItem) {
      e.preventDefault(); // don't paste image bytes as text
      const f = imgItem.getAsFile();
      if (f) processFile(f);
    }
    // Non-image pastes fall through → textarea handles them normally
  }

  /* ── Drag-and-drop ───────────────────────────────────────────── */
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }
  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0] ??
      (Array.from(e.dataTransfer.items).find(
        (it) => it.kind === "file" && it.type.startsWith("image/")
      )?.getAsFile() ?? null);
    if (f) processFile(f);
  }

  /* ── Solve ───────────────────────────────────────────────────── */
  async function handleSolve() {
    if (!canSubmit) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setError(null);
    setAnswer("");
    setHasSubmitted(true);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          question: question.trim(),
          ...(image && { imageData: image.data, imageMime: image.mime }),
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const raw = await res.text().catch(() => "");
        let msg = `Request failed (${res.status})`;
        try { const p = JSON.parse(raw); if (p?.error) msg = p.error; } catch { if (raw) msg = raw; }
        throw new Error(msg);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsStreaming(false);
    }
  }

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div
      className="max-w-[760px] w-full mx-auto bg-white text-gray-900 rounded-[20px] shadow-card p-5 sm:p-8 -mt-2"
      onPaste={handlePaste}
    >
      {/* Subject tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-soft rounded-full" role="tablist" aria-label="Subject">
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
                active ? "bg-emerald-accent text-white shadow" : "text-gray-700 hover:bg-white",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* ── Drop zone ── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "mt-5 relative rounded-2xl transition-all duration-150",
          dragOver ? "ring-2 ring-emerald-accent ring-offset-2" : "",
        ].join(" ")}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-emerald-accent/10 pointer-events-none gap-2">
            <Camera size={28} className="text-emerald-accent" />
            <p className="text-emerald-accent font-semibold text-sm">Drop image here</p>
          </div>
        )}

        {/* Textarea */}
        <label htmlFor="question" className="sr-only">Your JEE question</label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSolve(); }}
          placeholder={
            image
              ? "Optional: add extra context or a specific part of the question…"
              : "Type your JEE question here… or upload / paste a photo below"
          }
          className="w-full min-h-[140px] resize-y bg-soft text-gray-900 placeholder:text-gray-400 rounded-2xl p-4 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-accent/40 focus:border-emerald-accent/40 text-[15px] leading-relaxed"
        />

        {/* Upload toolbar */}
        <div className="mt-2.5 flex items-center justify-between gap-3 px-0.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-emerald-accent border border-gray-200 hover:border-emerald-accent/40 px-3 py-1.5 rounded-xl transition-colors hover:bg-emerald-accent/5"
          >
            <ImagePlus size={15} strokeWidth={2} />
            Upload image
          </button>

          <p className="text-xs text-gray-400 hidden sm:block select-none">
            Ctrl + V to paste &nbsp;·&nbsp; Drag &amp; drop supported
          </p>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Image error */}
        {imgError && (
          <p className="mt-2 text-xs text-red-500 font-medium px-0.5">{imgError}</p>
        )}

        {/* Image preview */}
        {image && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-soft rounded-xl border border-emerald-accent/25">
            <img
              src={image.dataUrl}
              alt="Uploaded question"
              className="h-[72px] w-auto max-w-[100px] object-contain rounded-lg border border-gray-200 bg-white shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">Image ready</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-snug">
                The model will read and solve the question from this image
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setImage(null); setImgError(null); }}
              aria-label="Remove image"
              className="shrink-0 p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Solve button */}
      <button
        type="button"
        onClick={handleSolve}
        disabled={!canSubmit}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-accent hover:bg-emerald-accentHover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 transition-colors"
      >
        {isStreaming
          ? <Loader2 size={18} className="animate-spin" />
          : <Zap size={18} strokeWidth={2.5} />}
        {isStreaming ? "Solving…" : "Solve This Question"}
      </button>

      {/* Answer output */}
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
