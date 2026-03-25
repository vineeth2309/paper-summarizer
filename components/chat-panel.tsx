"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

type Message = {
  id: string;
  role: string;
  content: string;
};

export function ChatPanel({
  paperId,
  threadId,
  initialMessages,
  onToggleCollapse
}: {
  paperId: string;
  threadId: string;
  initialMessages: Message[];
  onToggleCollapse?: () => void;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [isPending, startTransition] = useTransition();
  const messagesRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const isNearBottom = distanceFromBottom < 96;
      shouldStickToBottomRef.current = isNearBottom;
      setShowJumpToLatest(!isNearBottom && messages.length > 0);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll);

    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  useEffect(() => {
    const container = messagesRef.current;

    if (!container || !shouldStickToBottomRef.current) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isPending]);

  return (
    <aside className="grid h-full min-h-0 grid-rows-[auto,minmax(0,1fr),auto] overflow-hidden rounded-[24px] border border-white/8 bg-[#171717]">
      <div className="border-b border-white/8 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-mist">Paper chat</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Ask the paper</h2>
            <p className="mt-2 text-sm leading-6 text-mist">
              Questions are grounded in the selected paper&apos;s extracted sections, references, figures, and summary.
            </p>
          </div>
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
              title="Collapse chat"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0">
        <div ref={messagesRef} className="h-full min-h-0 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length ? (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-3xl px-4 py-3 text-sm leading-6 shadow-[0_12px_30px_rgba(0,0,0,0.14)] ${
                  message.role === "user"
                    ? "ml-8 bg-[#f0e6d8] text-[#111111]"
                    : "mr-8 border border-white/10 bg-white/[0.04] text-[#e7dfd4]"
                }`}
              >
                {message.content}
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 p-4 text-sm leading-6 text-mist">
              No chat messages yet. Ask about a figure, a section, a contribution, or why a reference matters.
            </div>
          )}
        </div>

        {showJumpToLatest ? (
          <button
            type="button"
            onClick={() => {
              const container = messagesRef.current;
              if (!container) {
                return;
              }

              shouldStickToBottomRef.current = true;
              container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
              setShowJumpToLatest(false);
            }}
            className="absolute bottom-4 right-4 rounded-full border border-white/10 bg-[#111111]/95 px-4 py-2 text-xs uppercase tracking-[0.15em] text-white shadow-lg transition hover:bg-[#1b1b1b]"
          >
            Latest
          </button>
        ) : null}
      </div>

      <form
        className="border-t border-white/8 bg-[#171717] p-4"
        onSubmit={(event) => {
          event.preventDefault();

          if (!question.trim()) {
            return;
          }

          const pendingQuestion = question;
          setQuestion("");
          setError("");

          const userMessage: Message = {
            id: `local-user-${Date.now()}`,
            role: "user",
            content: pendingQuestion
          };

          shouldStickToBottomRef.current = true;
          setShowJumpToLatest(false);
          setMessages((current) => [...current, userMessage]);

          startTransition(async () => {
            const response = await fetch(`/api/papers/${paperId}/chat`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                threadId,
                question: pendingQuestion
              })
            });

            const data = (await response.json()) as {
              message?: Message;
              error?: string;
            };

            if (!response.ok || !data.message) {
              setError(data.error ?? "Failed to send message.");
              return;
            }

            setMessages((current) => [...current, data.message as Message]);
          });
        }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          placeholder="Why does this paper use this encoder? What does Figure 2 imply? How does the shape flow work?"
          className="w-full resize-none rounded-[20px] border border-white/10 bg-[#111111] px-4 py-4 text-sm text-white outline-none transition focus:border-white/30"
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="text-xs text-mist">{isPending ? "Thinking..." : "Grounded to the current paper only."}</div>
          <button
            type="submit"
            disabled={isPending || !threadId}
            className="rounded-2xl bg-[#f0e6d8] px-4 py-3 text-sm font-semibold text-[#111111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </form>
    </aside>
  );
}
