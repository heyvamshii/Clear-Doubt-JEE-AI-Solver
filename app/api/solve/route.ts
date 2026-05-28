import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, type Subject } from "@/lib/systemPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SUBJECTS: Subject[] = ["Physics", "Chemistry", "Maths"];

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "Server is missing ANTHROPIC_API_KEY. Set it in .env.local and restart.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { subject?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const subject = body.subject as Subject | undefined;
  const question = (body.question ?? "").trim();

  if (!subject || !VALID_SUBJECTS.includes(subject)) {
    return new Response(
      JSON.stringify({ error: "Subject must be Physics, Chemistry, or Maths." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!question) {
    return new Response(JSON.stringify({ error: "Question is empty." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 2048,
          system: buildSystemPrompt(subject),
          messages: [{ role: "user", content: question }],
        });

        stream.on("text", (text) => {
          controller.enqueue(encoder.encode(text));
        });

        await stream.finalMessage();
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error from model";
        controller.enqueue(
          encoder.encode(`\n\n[stream error] ${message}`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
