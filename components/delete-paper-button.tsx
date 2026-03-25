"use client";

import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function DeletePaperButton({
  paperId,
  variant = "ghost",
  redirectTo = "/dashboard"
}: {
  paperId: string;
  variant?: "ghost" | "inline";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const className =
    variant === "inline"
      ? "inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-200 transition hover:bg-red-400/16 disabled:cursor-not-allowed disabled:opacity-60"
      : "inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-mist transition hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60";

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        setIsDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen, isPending]);

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError("");
            setIsDialogOpen(true);
          }}
          className={className}
          title="Delete paper"
        >
          <Trash2 className="h-4 w-4" />
          {isPending ? "Deleting..." : "Delete"}
        </button>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>

      {isDialogOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!isPending) {
              setIsDialogOpen(false);
            }
          }}
        >
          <div
            className="mx-auto flex min-h-full max-w-xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-full rounded-[28px] border border-white/10 bg-[#121212] p-6 shadow-[0_24px_120px_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-mist">Delete paper</p>
                  <h3 className="mt-3 text-3xl font-semibold text-white">Remove this paper from your workspace?</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isPending}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-5 text-sm leading-7 text-[#e6ddd1]">
                This will permanently delete the paper, generated summaries, extracted figures, chat history, embeddings,
                and local cached files for this paper.
              </p>

              <div className="mt-6 rounded-[22px] border border-red-400/12 bg-red-400/8 p-4 text-sm leading-6 text-red-100">
                This action cannot be undone.
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isPending}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setError("");

                    startTransition(async () => {
                      const response = await fetch(`/api/papers/${paperId}`, {
                        method: "DELETE"
                      });

                      if (!response.ok) {
                        const data = (await response.json().catch(() => ({}))) as { error?: string };
                        setError(data.error ?? "Failed to delete paper.");
                        return;
                      }

                      setIsDialogOpen(false);
                      router.push(redirectTo);
                      router.refresh();
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/12 px-4 py-3 text-sm font-medium text-red-100 transition hover:bg-red-400/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {isPending ? "Deleting..." : "Delete paper"}
                </button>
              </div>

              {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
