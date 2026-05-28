# ClearDoubt – JEE AI Solver

A clean, single-page web app for JEE doubt-solving. Built with Next.js (App Router), Tailwind, and the Google Generative AI SDK. Streams answers from `gemini-3.5-flash` server-side so the API key stays out of the browser.

Type the question, paste it from the clipboard, drag-and-drop a screenshot, or upload a photo from your phone — the model reads the image, solves it, and explains it like a JEE teacher.

## Features

- **Three subjects** — Physics, Chemistry, Maths (each gets a tailored explanation style)
- **Multimodal input** — text, clipboard paste (Ctrl+V), drag-and-drop, or file upload
- **Streaming answers** — tokens appear as they're generated, no full-page wait
- **Section-styled output** — Quick Take, Core Concept, Step-by-Step, Why Not Others, Memory Hook
- **KaTeX math rendering** — fractions, Greek letters, integrals, and equations render as real math, not raw LaTeX
- **Client-side image resize** — phone photos are downscaled to max 1280 px before upload, keeping requests fast

## Run it

```bash
npm install

# Put your key in .env.local
#   GEMINI_API_KEY=AIza...
# Get a free key at https://aistudio.google.com/apikey

npm run dev
```

Open `http://localhost:3000`.

## Layout

- `app/page.tsx` — composes the page
- `app/layout.tsx` — root layout, KaTeX CSS import, fonts, metadata
- `app/api/solve/route.ts` — streaming endpoint, calls Gemini server-side, supports text + image
- `lib/systemPrompt.ts` — the exact JEE-teacher system prompt with `${subject}` substitution and strict math-formatting rules
- `components/Navbar.tsx`, `HeroSection.tsx`, `SolverCard.tsx`, `AnswerOutput.tsx`, `HowItWorks.tsx`, `Footer.tsx`

## How streaming + rendering works

1. `SolverCard.tsx` posts `{ subject, question, imageData?, imageMime? }` to `/api/solve`.
2. The route builds a Gemini `parts` array (image inlineData first, then the text instruction) and starts `generateContentStream`.
3. Each chunk is enqueued onto a `ReadableStream<Uint8Array>` and sent back over a plain `text/plain` response.
4. The client reads with `response.body.getReader()` and accumulates the text in React state.
5. `AnswerOutput.tsx` splits the text into known sections, then converts each section body into HTML — `$...$` and `$$...$$` are rendered via `katex.renderToString()`, lists and bold/italic are handled directly, and the final HTML is injected with `dangerouslySetInnerHTML`. All non-math text is HTML-escaped first.

## Image upload flow

- File picker, clipboard paste, and drag-and-drop all converge on `processFile(file: File)`.
- `encodeImage` draws the image onto a `<canvas>` at max 1280 px on the long side, then exports JPEG at quality 0.85.
- The resulting base64 is sent alongside the text question. When only an image is provided, the server inserts a built-in prompt telling Gemini to read and solve the question from the image.
