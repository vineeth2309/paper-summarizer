import pdf from "pdf-parse";
import { PaperSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { embedText, projectEmbedding } from "@/lib/embedding";
import { downloadPdfBuffer, ensureLocalPdf, extractFiguresFromPdf, mergeFigureData, writeUploadedPdf } from "@/lib/figure-extraction";

type ArxivMetadata = {
  title: string;
  abstract: string;
  authors: string[];
  pdfUrl: string;
  publishedAt?: Date;
};

function sanitizeText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function decodeXmlEntities(value: string) {
  return sanitizeText(
    value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
  );
}

function parseArxivId(url: string) {
  const match = url.match(/arxiv\.org\/(?:abs|pdf)\/([^?#]+)/i);
  return match?.[1]?.replace(".pdf", "");
}

function stripHtml(html: string) {
  return sanitizeText(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function derivePmcArticleUrl(url: string) {
  const pmcMatch = url.match(/pmc\.ncbi\.nlm\.nih\.gov\/articles\/(PMC\d+)/i);
  if (!pmcMatch) {
    return null;
  }

  return `https://pmc.ncbi.nlm.nih.gov/articles/${pmcMatch[1]}/`;
}

async function fetchHtmlArticleFallback(sourceUrl: string) {
  const articleUrl = derivePmcArticleUrl(sourceUrl) ?? sourceUrl;
  const response = await fetch(articleUrl, {
    cache: "no-store",
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error("Unable to load article HTML.");
  }

  const html = await response.text();
  const title = sanitizeText(html.match(/name="citation_title"\s+content="([^"]+)"/i)?.[1] ?? "");
  const abstract = sanitizeText(html.match(/name="citation_abstract" content="([^"]+)"/i)?.[1] ?? "");
  const authors = Array.from(html.matchAll(/name="citation_author"\s+content="([^"]+)"/gi)).map((match) => sanitizeText(match[1]));
  const publishedRaw = html.match(/name="citation_publication_date"\s+content="([^"]+)"/i)?.[1];
  const rawText = stripHtml(html);

  return {
    articleUrl,
    title: title || "Untitled article",
    abstract: abstract || undefined,
    authors,
    publishedAt: publishedRaw ? new Date(publishedRaw) : undefined,
    rawText
  };
}

async function fetchArxivMetadata(arxivId: string): Promise<ArxivMetadata | null> {
  const response = await fetch(`https://export.arxiv.org/api/query?id_list=${arxivId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const xml = await response.text();
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];

  if (!entry) {
    return null;
  }

  const title = decodeXmlEntities(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "");
  const summary = decodeXmlEntities(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "");
  const publishedRaw = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim();
  const authors = Array.from(entry.matchAll(/<name>([\s\S]*?)<\/name>/g)).map((match) => decodeXmlEntities(match[1].trim()));

  if (!title || !summary) {
    return null;
  }

  return {
    title,
    abstract: summary,
    authors,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
    publishedAt: publishedRaw ? new Date(publishedRaw) : undefined
  };
}

async function extractPdfText(pdfBuffer: Buffer) {
  const parsed = await pdf(pdfBuffer);
  return sanitizeText(parsed.text).replace(/\s+\n/g, "\n").trim();
}

function buildSections(rawText: string) {
  const chunks = rawText
    .split(/\n(?=(?:\d+\s+)?[A-Z][A-Za-z0-9 ,\-:()]{4,80}\n)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.slice(0, 24).map((chunk, index) => {
    const [headingLine, ...rest] = chunk.split("\n");
    const heading = headingLine.length < 120 ? headingLine.trim() : undefined;

    return {
      heading,
      content: sanitizeText(rest.length ? rest.join("\n").trim() : chunk),
      orderIndex: index
    };
  });
}

function extractReferences(rawText: string) {
  const referencesStart = rawText.search(/\nreferences\n/i);

  if (referencesStart === -1) {
    return [];
  }

  const referenceChunk = rawText.slice(referencesStart).split("\n").slice(1).join("\n");
  return referenceChunk
    .split(/\n(?=\[\d+\]|\d+\.)/)
    .map((entry) => sanitizeText(entry).replace(/\s+/g, " ").trim())
    .filter((entry) => entry.length > 20)
    .slice(0, 20)
    .map((rawTextEntry, index) => ({
      citeKey: `[${index + 1}]`,
      title: rawTextEntry.split(".")[1]?.trim() ?? rawTextEntry.slice(0, 120),
      authors: rawTextEntry
        .split(".")[0]
        ?.split(",")
        .map((author) => sanitizeText(author).trim())
        .filter(Boolean) ?? [],
      rawText: sanitizeText(rawTextEntry),
      year: Number(rawTextEntry.match(/(19|20)\d{2}/)?.[0] ?? 0) || null
    }));
}

function extractFigureMentions(rawText: string) {
  const matches = Array.from(rawText.matchAll(/(Figure|Fig\.)\s*(\d+)[:.\s-]+([^\n]+)/gi));

  return matches.slice(0, 12).map((match) => ({
    label: `Figure ${match[2]}`,
    caption: sanitizeText(match[3].trim()),
    imageUrl: null,
    page: null
  }));
}

async function finalizePaperImport(input: {
  paperId: string;
  userId: string;
  title: string;
  abstract?: string;
  authors: string[];
  readerUrl?: string;
  publishedAt?: Date;
  rawText: string;
  pdfPath?: string;
}) {
  const sections = buildSections(input.rawText);
  const references = extractReferences(input.rawText);
  const mentionedFigures = extractFigureMentions(input.rawText);
  const extractedFigures = input.pdfPath ? await extractFiguresFromPdf(input.paperId, input.pdfPath) : [];
  const figures = mergeFigureData(extractedFigures, mentionedFigures);
  const vector = await embedText(
    `${sanitizeText(input.title)}\n${sanitizeText(input.abstract ?? "")}\n${sanitizeText(input.rawText.slice(0, 4000))}`
  );
  const projection = projectEmbedding(vector);

  const updated = await prisma.paper.update({
    where: { id: input.paperId },
    data: {
      title: sanitizeText(input.title),
      abstract: input.abstract ? sanitizeText(input.abstract) : undefined,
      authors: input.authors.map((author) => sanitizeText(author)),
      rawText: sanitizeText(input.rawText),
      pdfUrl: input.readerUrl ? sanitizeText(input.readerUrl) : null,
      publishedAt: input.publishedAt,
      status: "READY",
      sections: {
        createMany: {
          data: sections
        }
      },
      references: {
        createMany: {
          data: references
        }
      },
      figures: {
        createMany: {
          data: figures
        }
      },
      embeddings: {
        create: {
          userId: input.userId,
          kind: "PAPER",
          sourceId: input.paperId,
          vector: vector as Prisma.JsonArray,
          projection2d: projection as Prisma.JsonObject
        }
      },
      embedding2d: projection as Prisma.JsonObject
    }
  });

  await prisma.chatThread.create({
    data: {
      userId: input.userId,
      paperId: updated.id,
      title: `${input.title.slice(0, 52)} discussion`
    }
  });

  return updated;
}

export async function ingestPaper(userId: string, sourceUrl: string) {
  const normalizedSourceUrl = sanitizeText(sourceUrl);
  const sourceType = normalizedSourceUrl.includes("arxiv.org") ? PaperSource.ARXIV : PaperSource.PDF_URL;

  const paper = await prisma.paper.create({
    data: {
      userId,
      sourceType,
      sourceUrl: normalizedSourceUrl,
      title: "Importing paper...",
      authors: [],
      status: "INGESTING"
    }
  });

  try {
    let title = "Untitled paper";
    let abstract: string | undefined;
    let authors: string[] = [];
    let pdfUrl = normalizedSourceUrl;
    let publishedAt: Date | undefined;

    if (sourceType === PaperSource.ARXIV) {
      const arxivId = parseArxivId(sourceUrl);

      if (!arxivId) {
        throw new Error("Could not parse the arXiv identifier from the provided URL.");
      }

      const metadata = await fetchArxivMetadata(arxivId);

      if (!metadata) {
        throw new Error("Unable to load arXiv metadata.");
      }

      title = sanitizeText(metadata.title);
      abstract = sanitizeText(metadata.abstract);
      authors = metadata.authors.map((author) => sanitizeText(author));
      pdfUrl = sanitizeText(metadata.pdfUrl);
      publishedAt = metadata.publishedAt;
    }

    let rawText = "";
    let readerUrl: string | undefined = pdfUrl;
    let localPdfPath: string | undefined;

    try {
      const pdfBuffer = await downloadPdfBuffer(pdfUrl);
      const pdfHeader = pdfBuffer.subarray(0, 5).toString("utf8");

      if (pdfHeader !== "%PDF-") {
        throw new Error("Source did not return a PDF.");
      }

      const pdfPath = await ensureLocalPdf(paper.id, pdfUrl);
      rawText = await extractPdfText(pdfBuffer);
      localPdfPath = pdfPath;
    } catch (error) {
      if (sourceType !== PaperSource.PDF_URL) {
        throw error;
      }

      const fallback = await fetchHtmlArticleFallback(normalizedSourceUrl);
      title = fallback.title;
      abstract = fallback.abstract;
      authors = fallback.authors.length ? fallback.authors : authors;
      publishedAt = fallback.publishedAt ?? publishedAt;
      rawText = fallback.rawText;
      readerUrl = fallback.articleUrl;
      pdfUrl = fallback.articleUrl;
    }

    return finalizePaperImport({
      paperId: paper.id,
      userId,
      title,
      abstract,
      authors,
      readerUrl,
      publishedAt,
      rawText,
      pdfPath: localPdfPath
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ingest paper.";

    await prisma.paper.update({
      where: { id: paper.id },
      data: {
        title: "Import failed",
        status: "FAILED",
        ingestionError: message
      }
    });

    throw error;
  }
}

export async function ingestUploadedPaper(userId: string, fileName: string, pdfBuffer: Buffer) {
  const safeName = sanitizeText(fileName).trim() || "uploaded-paper.pdf";
  const paper = await prisma.paper.create({
    data: {
      userId,
      sourceType: PaperSource.PDF_URL,
      sourceUrl: `upload://${safeName}`,
      title: "Importing paper...",
      authors: [],
      status: "INGESTING"
    }
  });

  try {
    const pdfPath = await writeUploadedPdf(paper.id, pdfBuffer);
    const rawText = await extractPdfText(pdfBuffer);

    return finalizePaperImport({
      paperId: paper.id,
      userId,
      title: safeName.replace(/\.pdf$/i, ""),
      authors: [],
      readerUrl: `/generated/papers/${paper.id}/paper.pdf`,
      rawText,
      pdfPath
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import uploaded PDF.";

    await prisma.paper.update({
      where: { id: paper.id },
      data: {
        title: "Import failed",
        status: "FAILED",
        ingestionError: message
      }
    });

    throw error;
  }
}
