"use client";

import { ChevronLeft, ChevronRight, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { SummarizeButton } from "@/components/summarize-button";
import { SummaryView } from "@/components/summary-view";
import { ChatPanel } from "@/components/chat-panel";
import { PaperReader } from "@/components/paper-reader";
import { DeletePaperButton } from "@/components/delete-paper-button";

type WorkspacePaper = {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  summaryStatus: string;
  pdfUrl?: string | null;
  figures: { label: string; caption: string | null; imageUrl?: string | null }[];
  references: { citeKey: string | null; title: string | null; rawText: string }[];
  summaryData: unknown;
};

type Message = {
  id: string;
  role: string;
  content: string;
};

export function PaperWorkspace({
  paper,
  threadId,
  initialMessages
}: {
  paper: WorkspacePaper;
  threadId: string;
  initialMessages: Message[];
}) {
  const [chatWidth, setChatWidth] = useState(300);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  return (
    <div className="flex items-start gap-3 p-3">
      <div className="min-w-0 flex-1 rounded-[24px] border border-white/8 bg-[#171717]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-mist">{paper.sourceType === "ARXIV" ? "arXiv import" : "Direct PDF"}</p>
            <h1 className="truncate text-2xl font-semibold text-white">{paper.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <DeletePaperButton paperId={paper.id} variant="inline" />
            <SummarizeButton paperId={paper.id} status={paper.summaryStatus} />
          </div>
        </div>

        <div className="space-y-4 p-4">
          <PaperReader title={paper.title} pdfUrl={paper.pdfUrl} />
          <SummaryView
            summary={paper.summaryData}
            summaryStatus={paper.summaryStatus}
            figures={paper.figures}
            references={paper.references}
          />
        </div>
      </div>

      <div
        className="hidden w-2 shrink-0 cursor-col-resize rounded-full bg-white/[0.04] transition hover:bg-white/[0.12] xl:block"
        onMouseDown={(event) => {
          if (chatCollapsed) {
            return;
          }

          event.preventDefault();
          const startX = event.clientX;
          const startWidth = chatWidth;

          const handleMove = (moveEvent: MouseEvent) => {
            const nextWidth = Math.min(Math.max(startWidth - (moveEvent.clientX - startX), 260), 420);
            setChatWidth(nextWidth);
          };

          const handleUp = () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
          };

          window.addEventListener("mousemove", handleMove);
          window.addEventListener("mouseup", handleUp);
        }}
      />

      <div
        className="hidden shrink-0 self-start xl:block"
        style={{
          width: chatCollapsed ? 72 : chatWidth
        }}
      >
        <div className="sticky top-3 h-[calc(100vh-2rem)]">
          {chatCollapsed ? (
            <aside className="flex h-full flex-col items-center rounded-[24px] border border-white/8 bg-[#171717] py-4">
              <button
                type="button"
                onClick={() => setChatCollapsed(false)}
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="mt-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-mist">
                <MessageSquareText className="h-4 w-4" />
              </div>
            </aside>
          ) : (
            <ChatPanel
              paperId={paper.id}
              threadId={threadId}
              initialMessages={initialMessages}
              onToggleCollapse={() => setChatCollapsed(true)}
            />
          )}
        </div>
      </div>

      <div className="xl:hidden">
        <button
          type="button"
          onClick={() => setChatCollapsed((value) => !value)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#171717] text-white transition hover:bg-white/[0.08]"
        >
          {chatCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
