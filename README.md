# Paper Summarizer

Dark, full-stack `Next.js` app for importing research papers, reading the raw document first, generating structured summaries with OpenAI, chatting with the paper, and browsing a simple embedding map of prior reading history.

## Stack

- `Next.js` App Router
- `Auth.js` for sign-in
- `Prisma` with `Postgres`
- `OpenAI` for summaries, chat, and embeddings
- `Tailwind CSS` for the UI

## Features

- Landing page and dark dashboard shell inspired by the reference design
- Email-based local sign-in with optional GitHub OAuth
- Paper import from `arXiv` links or direct `PDF` URLs
- Raw paper view with embedded PDF and extracted text sections
- Prompt-driven `Summarize` flow using `prompts/paper-agent.md`
- Structured summary rendering for:
  - application summary
  - main talking points
  - architecture flow with conservative shape annotations
  - important figures
  - related concepts from references
- Right-side grounded chat panel for paper Q&A
- Paper history and a basic 2D semantic map

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/paper_summarizer?schema=public"
AUTH_SECRET="replace-with-a-long-random-string"
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY=""
GITHUB_ID=""
GITHUB_SECRET=""
```

3. Generate the Prisma client:

```bash
npx prisma generate
```

4. Create your initial database migration:

```bash
npx prisma migrate dev --name init
```

5. Start the app:

```bash
npm run dev
```

## Notes

- Without `OPENAI_API_KEY`, the app still works with a local fallback summarizer and chat response mode so the UI can be exercised end-to-end.
- The editable summarization instructions live in [prompts/paper-agent.md](/C:/Users/HP/Desktop/projects/paper-summarizer/prompts/paper-agent.md).
- User data is modeled with shared tables scoped by `userId`, which is the correct multitenant design for this product.

## Verified

- `prisma generate`
- `npm run build`
