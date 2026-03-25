import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmbeddingMap } from "@/components/embedding-map";

export default async function MapPage() {
  const session = await auth();

  const papers = await prisma.paper.findMany({
    where: {
      user: {
        email: session?.user?.email ?? undefined
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return (
    <div className="h-full p-4">
      <div className="mb-4 rounded-[24px] border border-white/8 bg-[#171717] p-5">
        <p className="text-sm uppercase tracking-[0.24em] text-mist">Semantic explorer</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Paper similarity map</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-mist">
          Each point is a paper in your account. The initial projection uses summary and paper embeddings and can later be swapped for a more advanced reducer without changing the UI contract.
        </p>
      </div>
      <EmbeddingMap
        points={papers.map((paper) => ({
          id: paper.id,
          title: paper.title,
          status: paper.summaryStatus,
          abstract: paper.abstract ?? "",
          projection: paper.embedding2d as { x: number; y: number } | null
        }))}
      />
    </div>
  );
}
