"use client";

import { Expand, X } from "lucide-react";
import { useState } from "react";

export function PaperReader({
  title,
  pdfUrl
}: {
  title: string;
  pdfUrl?: string | null;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const isPdfDocument = Boolean(pdfUrl && /\.pdf(?:$|\?)/i.test(pdfUrl));
  const sourceLabel = isPdfDocument ? "PDF" : "Source";

  return (
    <>
      <div className="rounded-[22px] border border-white/8 bg-[#111111] p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-mist">Raw paper</p>
            <p className="text-sm text-mist">Read the original source here, then scroll down for the summary.</p>
          </div>
          <div className="flex items-center gap-3">
            {pdfUrl ? (
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-[#f4d4bc] transition hover:text-white">
                Open {sourceLabel}
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition hover:bg-white/[0.08]"
            >
              <Expand className="h-4 w-4" />
              Full screen
            </button>
          </div>
        </div>

        {pdfUrl ? (
          <iframe
            title={title}
            src={pdfUrl}
            className="h-[78vh] min-h-[760px] w-full rounded-[20px] border border-white/8 bg-black/20"
          />
        ) : (
          <div className="flex h-[50vh] items-center justify-center rounded-[20px] border border-white/8 bg-black/20 text-sm text-mist">
            No PDF is available for this paper.
          </div>
        )}
      </div>

      {fullscreen ? (
        <div className="fixed inset-0 z-50 bg-black/85 p-4 backdrop-blur-sm">
          <div className="flex h-full flex-col rounded-[28px] border border-white/10 bg-[#101010] p-4 shadow-halo">
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-white/8 pb-4">
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-[0.2em] text-mist">Reading mode</p>
                <h2 className="truncate text-2xl font-semibold text-white">{title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition hover:bg-white/[0.08]"
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 rounded-[22px] border border-white/8 bg-[#0d0d0d] p-3">
              {pdfUrl ? (
                <iframe title={`${title} fullscreen`} src={pdfUrl} className="h-full min-h-0 w-full rounded-[18px] border border-white/8 bg-black/20" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-mist">No PDF is available for this paper.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
