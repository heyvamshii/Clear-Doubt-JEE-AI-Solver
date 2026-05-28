# ClearDoubt – JEE AI Solver

A clean, single-page web app for JEE doubt-solving. Built with Next.js (App Router), Tailwind, and the Anthropic SDK. Streams answers from `claude-opus-4-7` server-side so the API key stays out of the browser.

## Run it

```bash
npm install
# Put your key in .env.local
#   ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Open http://localhost:3000.

## Layout

- `app/page.tsx` — composes the page
- `app/api/solve/route.ts` — streaming endpoint, calls Claude server-side
- `lib/systemPrompt.ts` — the exact JEE-teacher system prompt with `[SUBJECT]` substitution
- `components/` — `Navbar`, `HeroSection`, `SolverCard`, `AnswerOutput`, `HowItWorks`, `Footer`

The frontend reads the stream via `fetch` + `ReadableStream` and re-renders the answer card as text arrives. Section headings from the model (QUICK TAKE, THE CORE CONCEPT, …) are detected and styled; a divider is inserted before "Why not the other options?".
