"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { paperSummarySchema, type PaperSummaryPayload } from "@/lib/summary-schema";
import { pickArchitectureFigure } from "@/lib/figure-ranking";
import { GraphVisualization } from "@/components/graph-visualization";

type Props = {
  summary: unknown;
  summaryStatus: string;
  figures: { label: string; caption: string | null; imageUrl?: string | null }[];
  references: { citeKey: string | null; title: string | null; rawText: string }[];
};

function FigureLightbox({ imageUrl, title, onClose }: { imageUrl: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full flex-col rounded-[28px] border border-white/10 bg-[#101010] p-4 shadow-halo" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-white/8 pb-4">
          <h3 className="truncate text-2xl font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <img src={imageUrl} alt={title} className="max-h-full max-w-full rounded-[20px] border border-white/8 bg-black/20 object-contain" />
        </div>
      </div>
    </div>
  );
}

function FigurePanel({
  figure,
  extractedFigure,
  compact = false
}: {
  figure: PaperSummaryPayload["importantFigures"][number];
  extractedFigure?: { label: string; caption: string | null; imageUrl?: string | null };
  compact?: boolean;
}) {
  const imageUrl = figure.imageUrl ?? extractedFigure?.imageUrl ?? undefined;
  const caption = figure.caption || extractedFigure?.caption || "";
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
        {imageUrl ? (
          <button type="button" onClick={() => setOpen(true)} className="mb-4 block w-full">
            <img
              src={imageUrl}
              alt={figure.title}
              className="h-[260px] w-full rounded-[18px] border border-white/8 object-contain bg-black/20 transition hover:border-white/20"
            />
          </button>
        ) : compact ? (
          <div className="mb-4 flex h-[260px] items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-[#121212] px-6 text-center text-sm leading-6 text-mist">
            Figure image extraction is not available for this paper yet.
          </div>
        ) : null}

        {!compact ? (
          <>
            <h4 className="text-2xl font-semibold text-white">{figure.title}</h4>
            <p className="mt-3 text-sm leading-7 text-[#ebe2d6]">{figure.reason}</p>
            {caption ? <p className="mt-4 text-sm leading-6 text-mist">Caption: {caption}</p> : null}
          </>
        ) : caption ? (
          <p className="text-sm leading-6 text-mist">Caption: {caption}</p>
        ) : null}
      </div>

      {open && imageUrl ? <FigureLightbox imageUrl={imageUrl} title={figure.title} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function SummaryView({ summary, summaryStatus, figures, references }: Props) {
  const parsed = paperSummarySchema.safeParse(summary);

  if (!parsed.success) {
    return (
      <div className="rounded-[22px] border border-white/8 bg-[#111111] p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-mist">Summary</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">No summary yet</h2>
        <p className="mt-3 text-sm leading-6 text-mist">
          {summaryStatus === "FAILED"
            ? "The last summary attempt failed. Adjust your prompt or API key and try again."
            : "Click Summarize to generate a story-driven explanation with a key figure, graph visualization, and detailed interpretation."}
        </p>
        <div className="mt-5 rounded-3xl border border-dashed border-white/10 p-4 text-sm leading-6 text-mist">
          <div>Figures detected: {figures.length}</div>
          <div>References detected: {references.length}</div>
        </div>
      </div>
    );
  }

  const data = parsed.data;
  const heroFigure = figures.find((figure) => figure.label === data.figureStory.label);
  const nonHeroFigures = data.importantFigures.filter((figure) => figure.label !== data.figureStory.label);
  const paperTypeLabel = data.paperType.replace(/_/g, " ");
  const architectureFigure =
    figures.find((figure) => figure.label === pickArchitectureFigure(figures)?.label) ??
    figures.find((figure) => figure.imageUrl && /architecture|overview|pipeline|framework|method|system|workflow|diagram|model/i.test(figure.caption ?? "")) ??
    null;

  return (
    <div className="space-y-5">
      <div className="rounded-[26px] border border-white/8 bg-[#111111] p-6">
        <p className="text-sm uppercase tracking-[0.22em] text-mist">Interactive summary</p>
        <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#e6ddd1]">
          {paperTypeLabel}
        </div>
        <h2 className="mt-3 text-4xl font-semibold leading-tight text-white">{data.title}</h2>
        <p className="mt-4 max-w-4xl text-xl leading-9 text-[#f0e6d8]">{data.oneLiner}</p>
        <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-mist">The story</p>
            <p className="mt-4 text-base leading-8 text-[#e6ded3]">{data.narrativeSummary}</p>
          </div>
          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-mist">Why this paper matters</p>
            <p className="mt-4 text-base leading-8 text-[#e6ded3]">{data.whyItMatters}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[26px] border border-white/8 bg-[#111111] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-mist">One figure summary</p>
          <h3 className="mt-3 text-3xl font-semibold text-white">{data.figureStory.title}</h3>
          <p className="mt-4 text-base leading-8 text-[#ebe2d6]">{data.figureStory.takeaway}</p>
          {data.figureStory.caption || heroFigure?.caption ? (
            <p className="mt-4 text-sm leading-6 text-mist">Caption: {data.figureStory.caption || heroFigure?.caption}</p>
          ) : null}
          <p className="mt-5 rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-mist">
            {data.figureStory.whyThisFigure}
          </p>
        </div>
        <FigurePanel
          figure={{
            label: data.figureStory.label,
            title: data.figureStory.title,
            reason: data.figureStory.takeaway,
            caption: data.figureStory.caption,
            imageUrl: data.figureStory.imageUrl
          }}
          extractedFigure={heroFigure}
          compact
        />
      </div>

      {data.visualization.type === "architecture" && architectureFigure ? (
        <div className="rounded-[26px] border border-white/8 bg-[#111111] p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-mist">Paper architecture figure</p>
              <h3 className="mt-2 text-3xl font-semibold text-white">Original figure from the paper</h3>
            </div>
            <p className="max-w-xl text-sm leading-6 text-mist">
              This is the source paper&apos;s own system diagram or closest architecture-style figure, surfaced directly so
              you can compare the summary graph against the original presentation.
            </p>
          </div>

          <FigurePanel
            figure={{
              label: architectureFigure.label,
              title: architectureFigure.label,
              reason: architectureFigure.caption ?? "Architecture-style figure extracted from the paper.",
              caption: architectureFigure.caption ?? "",
              imageUrl: architectureFigure.imageUrl ?? undefined
            }}
            extractedFigure={architectureFigure}
          />
        </div>
      ) : null}

      <GraphVisualization visualization={data.visualization} />

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[26px] border border-white/8 bg-[#111111] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-mist">Intuition first</p>
          <div className="mt-5 space-y-4">
            {data.intuition.map((section) => (
              <div key={section.title} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <h4 className="text-2xl font-semibold text-white">{section.title}</h4>
                <p className="mt-3 text-sm leading-7 text-mist">{section.body}</p>
                {section.bullets.length ? (
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[#e5ded3] marker:text-[#cdb79e]">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/8 bg-[#111111] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-mist">Key takeaways</p>
          <div className="mt-5 space-y-3">
            {data.keyTakeaways.map((point) => (
              <div key={point} className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-[#e6ddd1]">
                {point}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[26px] border border-white/8 bg-[#111111] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-mist">Related concepts</p>
          <div className="mt-5 space-y-4">
            {data.relatedConcepts.map((concept) => (
              <div key={concept.label} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <h4 className="text-2xl font-semibold text-white">{concept.label}</h4>
                <p className="mt-3 text-sm leading-7 text-mist">{concept.whyItMatters}</p>
                {concept.paperReference ? <p className="mt-4 text-xs uppercase tracking-[0.15em] text-mist">{concept.paperReference}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/8 bg-[#111111] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-mist">
            {data.paperType === "benchmark_dataset" || data.paperType === "survey_review" ? "Important figures and artifacts" : "Important figures"}
          </p>
          <div className="mt-5 space-y-4">
            {nonHeroFigures.length ? (
              nonHeroFigures.map((figure) => (
                <FigurePanel
                  key={figure.label}
                  figure={figure}
                  extractedFigure={figures.find((item) => item.label === figure.label)}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-mist">
                No additional figures were selected beyond the main explanatory figure.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-white/8 bg-[#111111] p-6">
        <p className="text-sm uppercase tracking-[0.22em] text-mist">Detailed explanation</p>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {data.detailSections.map((section) => (
            <div key={section.title} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
              <h4 className="text-2xl font-semibold text-white">{section.title}</h4>
              <p className="mt-3 text-sm leading-7 text-mist">{section.body}</p>
              {section.bullets.length ? (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[#e5ded3] marker:text-[#cdb79e]">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[26px] border border-white/8 bg-[#111111] p-6">
        <p className="text-sm uppercase tracking-[0.22em] text-mist">Limitations and caveats</p>
        <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-mist marker:text-[#cdb79e]">
          {data.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
