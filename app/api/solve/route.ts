import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { buildSystemPrompt, type Subject } from "@/lib/systemPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SUBJECTS: Subject[] = ["Physics", "Chemistry", "Maths"];

// Allowed image MIME types Gemini accepts
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(req: Request) {
  /* ── API key guard ───────────────────────────────────────────── */
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "Server is missing GEMINI_API_KEY. Set it in .env.local and restart.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  /* ── Parse body ──────────────────────────────────────────────── */
  let body: {
    subject?:   string;
    question?:  string;
    imageData?: string; // base64, no data-URL prefix
    imageMime?: string; // e.g. "image/jpeg"
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  /* ── Validate subject ────────────────────────────────────────── */
  const subject = body.subject as Subject | undefined;
  if (!subject || !VALID_SUBJECTS.includes(subject)) {
    return new Response(
      JSON.stringify({ error: "Subject must be Physics, Chemistry, or Maths." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  /* ── Validate content (need at least one of: text or image) ──── */
  const question  = (body.question  ?? "").trim();
  const imageData = (body.imageData ?? "").trim();
  const imageMime = (body.imageMime ?? "image/jpeg").trim();

  if (!question && !imageData) {
    return new Response(
      JSON.stringify({ error: "Please type a question or upload an image." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (imageData && !ALLOWED_MIMES.has(imageMime)) {
    return new Response(
      JSON.stringify({ error: `Unsupported image type: ${imageMime}. Use JPG, PNG, or WEBP.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  /* ── Build Gemini parts array ────────────────────────────────── */
  // Gemini multimodal: image part first, then the text instruction.
  const parts: Part[] = [];

  if (imageData) {
    parts.push({
      inlineData: { data: imageData, mimeType: imageMime },
    });
  }

  parts.push({
    text: question ||
      "Read this image carefully. Identify the JEE question shown and solve it completely, " +
      "including all options if it is an MCQ. Explain every step clearly.",
  });

  /* ── Stream from Gemini ──────────────────────────────────────── */
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
    systemInstruction: buildSystemPrompt(subject),
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await model.generateContentStream({
          contents: [{ role: "user", parts }],
        });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown model error";
        controller.enqueue(encoder.encode(`\n\n[stream error] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type":   "text/plain; charset=utf-8",
      "Cache-Control":  "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
