import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaperWorkspace } from "@/components/paper-workspace";

export default async function PaperPage({ params }: { params: Promise<{ paperId: string }> }) {
  const session = await auth();
  const { paperId } = await params;

  if (!session?.user?.email) {
    redirect("/login");
  }

  const paper = await prisma.paper.findFirst({
    where: {
      id: paperId,
      user: {
        email: session.user.email
      }
    },
    include: {
      sections: {
        orderBy: {
          orderIndex: "asc"
        }
      },
      figures: true,
      references: true,
      chatThreads: {
        orderBy: {
          updatedAt: "desc"
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc"
            }
          }
        },
        take: 1
      }
    }
  });

  if (!paper) {
    notFound();
  }

  const thread = paper.chatThreads[0];

  return (
    <PaperWorkspace
      paper={{
        id: paper.id,
        title: paper.title,
        sourceType: paper.sourceType,
        status: paper.status,
        summaryStatus: paper.summaryStatus,
        pdfUrl: paper.pdfUrl,
        figures: paper.figures.map((figure) => ({
          label: figure.label,
          caption: figure.caption,
          imageUrl: figure.imageUrl
        })),
        references: paper.references.map((reference) => ({
          citeKey: reference.citeKey,
          title: reference.title,
          rawText: reference.rawText
        })),
        summaryData: paper.summaryData
      }}
      threadId={thread?.id ?? ""}
      initialMessages={
        thread?.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content
        })) ?? []
      }
    />
  );
}
