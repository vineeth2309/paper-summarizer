import Link from "next/link";
import { ArrowRight, Bot, ChartNoAxesCombined, FileText } from "lucide-react";

const features = [
  {
    title: "Raw paper first",
    body: "Open arXiv or direct PDF links and read the paper in full before asking the agent to summarize it.",
    icon: FileText
  },
  {
    title: "Interactive summary",
    body: "Generate application-level summaries, architecture flows, important figures, and related reference context.",
    icon: Bot
  },
  {
    title: "Embedding map",
    body: "Track your reading history, cluster similar papers, and reopen old research from a 2D semantic map.",
    icon: ChartNoAxesCombined
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen px-2 py-2 md:px-3 md:py-3">
      <div className="grid min-h-[calc(100vh-1rem)] gap-3 rounded-[32px] border border-white/10 bg-[#151515]/90 p-3 shadow-halo md:min-h-[calc(100vh-1.5rem)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col justify-between rounded-[24px] border border-white/6 bg-[#1a1a1a] p-6">
          <div className="space-y-8">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.25em] text-mist">Paper Summarizer</p>
              <p className="max-w-[14rem] text-sm leading-6 text-mist">
                Dark, focused reading workspace for research-heavy workflows.
              </p>
            </div>
            <nav className="space-y-3 text-sm text-mist">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">Interactive Reader</div>
              <div className="px-4 py-3">Summary Blocks</div>
              <div className="px-4 py-3">Figure-aware Agent</div>
              <div className="px-4 py-3">Semantic Paper Map</div>
            </nav>
          </div>

          <div className="space-y-4">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-xs leading-5 text-mist">
              Use email-and-password sign-in by default. GitHub OAuth activates automatically when env vars are set.
            </p>
          </div>
        </aside>

        <section className="flex flex-col justify-between rounded-[24px] bg-[#121212] p-8 md:p-12">
          <div className="max-w-4xl space-y-8">
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-mist">
              Read first. Summarize when ready.
            </div>
            <div className="space-y-6">
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-white md:text-7xl">
                Turn dense papers into a visual, grounded research workspace.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[#c7c2b8]">
                Import an arXiv or PDF link, inspect the original paper, then ask the agent to produce an intuitive summary
                with figures, architecture flow, shape reasoning, related references, and a persistent chat.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {features.map(({ title, body, icon: Icon }) => (
                <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <Icon className="mb-6 h-5 w-5 text-[#f4d4bc]" />
                  <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
                  <p className="text-sm leading-6 text-mist">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-4 rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-6 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.24em] text-mist">Included in the MVP</p>
              <p className="text-2xl font-semibold text-white">Reader, summary cards, chat, history, and a semantic map.</p>
            </div>
            <div className="space-y-3 text-sm leading-6 text-mist">
              <p>Summaries are driven by an editable prompt file and a strict JSON output contract so the UI can render them reliably.</p>
              <p>The chat stays grounded in the selected paper&apos;s sections, figures, references, and generated summary artifacts.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
