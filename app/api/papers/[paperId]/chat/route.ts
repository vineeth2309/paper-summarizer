import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { askPaperQuestion } from "@/lib/chat-with-paper";

export async function POST(request: Request, { params }: { params: Promise<{ paperId: string }> }) {
  const session = await auth();

  if (!session?.user?.email || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paperId } = await params;
  const body = (await request.json()) as {
    question?: string;
    threadId?: string;
  };

  if (!body.question || !body.threadId) {
    return NextResponse.json({ error: "Missing question or threadId" }, { status: 400 });
  }

  const thread = await prisma.chatThread.findFirst({
    where: {
      id: body.threadId,
      paperId,
      userId: session.user.id
    }
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  try {
    const message = await askPaperQuestion({
      userId: session.user.id,
      paperId,
      threadId: body.threadId,
      question: body.question
    });

    return NextResponse.json({ message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to chat with paper.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
