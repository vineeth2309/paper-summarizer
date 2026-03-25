import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaperImportForm } from "@/components/paper-import-form";
import { formatDistanceToNow } from "@/components/formatters";
import { DeletePaperButton } from "@/components/delete-paper-button";

export default async function DashboardPage() {
  const session = await auth();

  const papers = await prisma.paper.findMany({
    where: {
      user: {
        email: session?.user?.email ?? undefined
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 8
  });

  return (
    <div className="grid h-full gap-4 p-4 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-[24px] border border-white/8 bg-[#171717] p-5">
        <div className="mb-6 space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-mist">Start reading</p>
          <h1 className="text-3xl font-semibold text-white">Import a paper and open the raw document first.</h1>
          <p className="max-w-xl text-sm leading-6 text-mist">
            Paste an arXiv link or direct PDF URL. The app extracts text, sections, references, and candidate figure mentions before you summarize.
          </p>
        </div>
        <PaperImportForm />
      </section>

      <section className="rounded-[24px] border border-white/8 bg-[#121212] p-5">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-mist">Recent papers</p>
            <h2 className="text-2xl font-semibold text-white">Your reading history</h2>
          </div>
          <Link href="/dashboard/map" className="text-sm text-[#f4d4bc] transition hover:text-white">
            Open embedding map
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
                      <span>{paper.status}</span>
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
              No papers imported yet. Start with an arXiv link and the dashboard will build your history automatically.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
