import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { summarizePaper } from "@/lib/summarize-paper";

export async function POST(_: Request, { params }: { params: Promise<{ paperId: string }> }) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paperId } = await params;
  const paper = await prisma.paper.findFirst({
    where: {
      id: paperId,
      user: {
        email: session.user.email
      }
    }
  });

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  try {
    const summary = await summarizePaper(paperId);
    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to summarize paper.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
