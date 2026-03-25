"use client";

import { FileUp, Link2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PaperImportForm() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const submitUrl = () => {
    if (!sourceUrl.trim()) {
      setError("Enter a paper URL or upload a PDF.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/papers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sourceUrl })
      });

      const data = (await response.json()) as { paperId?: string; error?: string };
      if (!response.ok || !data.paperId) {
        setError(data.error ?? "Failed to import paper.");
        return;
      }

      setSourceUrl("");
      router.push(`/dashboard/papers/${data.paperId}`);
      router.refresh();
    });
  };

  const submitFile = (file: File) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/papers", {
        method: "POST",
        body: formData
      });

      const data = (await response.json()) as { paperId?: string; error?: string };
      if (!response.ok || !data.paperId) {
        setError(data.error ?? "Failed to import PDF.");
        return;
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      router.push(`/dashboard/papers/${data.paperId}`);
      router.refresh();
    });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");

        if (selectedFile) {
          submitFile(selectedFile);
          return;
        }

        submitUrl();
      }}
    >
      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[28px] border border-white/10 bg-[#121212] p-4">
          <label className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-mist" htmlFor="sourceUrl">
            <Link2 className="h-4 w-4" />
            Paper URL
          </label>
          <textarea
            id="sourceUrl"
            value={sourceUrl}
            onChange={(event) => {
              setSourceUrl(event.target.value);
              if (selectedFile) {
                setSelectedFile(null);
              }
            }}
            placeholder="https://arxiv.org/abs/2401.00001 or a direct PDF/article URL"
            rows={4}
            className="w-full resize-none rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white outline-none transition focus:border-white/30"
          />
        </div>

        <div
          className={`rounded-[28px] border p-4 transition ${
            isDragging ? "border-[#d2b08b]/50 bg-[#1a1612]" : "border-white/10 bg-[#121212]"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            setError("");

            const file = event.dataTransfer.files[0];
            if (!file) {
              return;
            }

            if (!file.name.toLowerCase().endsWith(".pdf")) {
              setError("Please drop a PDF file.");
              return;
            }

            setSelectedFile(file);
            setSourceUrl("");
          }}
        >
          <div className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-mist">
            <FileUp className="h-4 w-4" />
            Upload PDF
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-[148px] w-full flex-col items-center justify-center rounded-[20px] border border-dashed border-white/12 bg-white/[0.03] px-6 text-center transition hover:bg-white/[0.05]"
          >
            <div className="text-base font-medium text-white">
              {selectedFile ? selectedFile.name : isDragging ? "Drop PDF here" : "Drag and drop a local PDF"}
            </div>
            <div className="mt-2 text-sm leading-6 text-mist">
              {selectedFile ? "This file will be imported directly from your machine." : "Or click to choose a file."}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setError("");

              if (!file) {
                return;
              }

              if (!file.name.toLowerCase().endsWith(".pdf")) {
                setError("Please choose a PDF file.");
                return;
              }

              setSelectedFile(file);
              setSourceUrl("");
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <p className="text-sm leading-6 text-mist">
          Import creates a paper record, downloads or uploads the source, extracts raw text and references, and opens the
          reader before any summary is generated.
        </p>
        <button
          type="submit"
          disabled={isPending || (!sourceUrl.trim() && !selectedFile)}
          className="rounded-2xl bg-[#f0e6d8] px-5 py-3 text-sm font-semibold text-[#111111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Importing..." : selectedFile ? "Upload PDF" : "Open paper"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </form>
  );
}
