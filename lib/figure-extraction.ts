import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prioritizeFigures } from "@/lib/figure-ranking";

const execFileAsync = promisify(execFile);

type FigureRow = {
  label: string;
  caption: string | null;
  imageUrl: string | null;
  page: number | null;
};

type ExtractedFigure = {
  label: string;
  caption: string;
  imagePath: string | null;
  page: number | null;
};

export async function ensurePaperStorage(paperId: string) {
  const paperDir = path.join(process.cwd(), "public", "generated", "papers", paperId);
  const figuresDir = path.join(paperDir, "figures");
  await mkdir(figuresDir, { recursive: true });
  return {
    paperDir,
    figuresDir,
    pdfPath: path.join(paperDir, "paper.pdf")
  };
}

export async function downloadPdfBuffer(pdfUrl: string) {
  const response = await fetch(pdfUrl, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Unable to download PDF.");
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function ensureLocalPdf(paperId: string, pdfUrl: string) {
  const storage = await ensurePaperStorage(paperId);

  try {
    await access(storage.pdfPath);
    return storage.pdfPath;
  } catch {
    const pdfBuffer = await downloadPdfBuffer(pdfUrl);
    await writeFile(storage.pdfPath, pdfBuffer);
    return storage.pdfPath;
  }
}

export async function writeUploadedPdf(paperId: string, pdfBuffer: Buffer) {
  const storage = await ensurePaperStorage(paperId);
  await writeFile(storage.pdfPath, pdfBuffer);
  return storage.pdfPath;
}

export async function extractFiguresFromPdf(paperId: string, pdfPath: string) {
  const { figuresDir } = await ensurePaperStorage(paperId);
  const scriptPath = path.join(process.cwd(), "scripts", "extract_figures.py");

  try {
    const { stdout } = await execFileAsync("uv", ["run", "python", scriptPath, pdfPath, figuresDir], {
      cwd: process.cwd(),
      windowsHide: true
    });

    const parsed = JSON.parse(stdout) as {
      figures?: ExtractedFigure[];
    };

    return (parsed.figures ?? []).map((figure) => ({
      label: figure.label,
      caption: figure.caption,
      imageUrl: figure.imagePath ? `/generated/papers/${paperId}/figures/${figure.imagePath}` : null,
      page: figure.page
    }));
  } catch (error) {
    console.error("Figure extraction failed", error);
    return [];
  }
}

export function mergeFigureData(extractedFigures: FigureRow[], existingFigures: FigureRow[]) {
  const merged = new Map<string, FigureRow>();

  for (const figure of existingFigures) {
    merged.set(figure.label, figure);
  }

  for (const figure of extractedFigures) {
    const existing = merged.get(figure.label);
    merged.set(figure.label, {
      label: figure.label,
      caption: figure.caption || existing?.caption || null,
      imageUrl: figure.imageUrl ?? existing?.imageUrl ?? null,
      page: figure.page ?? existing?.page ?? null
    });
  }

  return prioritizeFigures(Array.from(merged.values())).slice(0, 12);
}
