import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "@/components/formatters";
import { DeletePaperButton } from "@/components/delete-paper-button";

export default async function DashboardPage() {
  const session = await auth();

  const [papers, paperCount, summaryReadyCount] = await Promise.all([
    prisma.paper.findMany({
      where: {
        user: {
          email: session?.user?.email ?? undefined
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 5
    }),
    prisma.paper.count({
      where: {
        user: {
          email: session?.user?.email ?? undefined
        }
      }
    }),
    prisma.paper.count({
      where: {
        user: {
          email: session?.user?.email ?? undefined
        },
        summaryStatus: "READY"
      }
    })
  ]);

  return (
    <div className="grid h-full gap-4 p-4 xl:grid-cols-[0.88fr_1.12fr]">
      <section className="rounded-[24px] border border-white/8 bg-[#171717] p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-mist">Home</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Your reading workspace at a glance.</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-mist">
          Jump into imports, revisit prior papers, open the embedding map, or adjust your agent instructions from settings.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-mist">Imported papers</p>
            <p className="mt-3 text-3xl font-semibold text-white">{paperCount}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-mist">Summaries ready</p>
            <p className="mt-3 text-3xl font-semibold text-white">{summaryReadyCount}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-mist">Last activity</p>
            <p className="mt-3 text-lg font-semibold text-white">{papers[0] ? formatDistanceToNow(papers[0].updatedAt) : "No papers yet"}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Link
            href="/dashboard/papers"
            className="rounded-[22px] border border-white/10 bg-[#f0e6d8] px-5 py-4 text-sm font-semibold text-[#111111] transition hover:bg-white"
          >
            Open papers
          </Link>
          <Link
            href="/dashboard/map"
            className="rounded-[22px] border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Open map
          </Link>
          <Link
            href="/dashboard/settings"
            className="rounded-[22px] border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Open settings
          </Link>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/8 bg-[#121212] p-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mist">Recent papers</p>
            <h2 className="text-2xl font-semibold text-white">Continue reading</h2>
          </div>
          <Link href="/dashboard/papers" className="text-sm text-[#f4d4bc] transition hover:text-white">
            View all papers
          </Link>
        </div>

        <div className="space-y-3">
          {papers.length ? (
            papers.map((paper) => (
              <div key={paper.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/dashboard/papers/${paper.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-mist">
                      <span>{paper.sourceType === "ARXIV" ? "arXiv" : "PDF"}</span>
                      <span>{paper.summaryStatus}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-white">{paper.title}</h3>
                    <p className="mt-3 text-xs text-mist">Updated {formatDistanceToNow(paper.updatedAt)}</p>
                  </Link>
                  <DeletePaperButton paperId={paper.id} />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm leading-6 text-mist">
              No papers imported yet. Go to Papers to import your first paper.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
