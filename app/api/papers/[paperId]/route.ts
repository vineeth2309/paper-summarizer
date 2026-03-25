import { rm } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ paperId: string }> }) {
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
    },
    select: {
      id: true
    }
  });

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  await prisma.paper.delete({
    where: {
      id: paperId
    }
  });

  const paperDir = path.join(process.cwd(), "public", "generated", "papers", paperId);
  await rm(paperDir, { recursive: true, force: true }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
