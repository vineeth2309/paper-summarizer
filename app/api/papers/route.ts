import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ingestPaper, ingestUploadedPaper } from "@/lib/paper-ingestion";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing PDF file" }, { status: 400 });
      }

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const paper = await ingestUploadedPaper(session.user.id, file.name, buffer);
      return NextResponse.json({ paperId: paper.id });
    }

    const body = (await request.json()) as { sourceUrl?: string };

    if (!body.sourceUrl) {
      return NextResponse.json({ error: "Missing sourceUrl" }, { status: 400 });
    }

    const paper = await ingestPaper(session.user.id, body.sourceUrl.trim());
    return NextResponse.json({ paperId: paper.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import paper.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
