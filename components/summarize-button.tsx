"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SummarizeButton({ paperId, status }: { paperId: string; status: string }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending || status === "PROCESSING"}
        onClick={() =>
          startTransition(async () => {
            setError("");
            const response = await fetch(`/api/papers/${paperId}/summarize`, {
              method: "POST"
            });
            const data = (await response.json()) as { error?: string };
            if (!response.ok) {
              setError(data.error ?? "Failed to summarize paper.");
              return;
            }
            router.refresh();
          })
        }
        className="rounded-2xl bg-[#f0e6d8] px-5 py-3 text-sm font-semibold text-[#111111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending || status === "PROCESSING" ? "Summarizing..." : "Summarize"}
      </button>
      {error ? <p className="text-right text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
