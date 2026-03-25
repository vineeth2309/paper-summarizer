"use client";

import Link from "next/link";

type Point = {
  id: string;
  title: string;
  abstract: string;
  status: string;
  projection: { x: number; y: number } | null;
};

function normalize(value: number, min: number, max: number) {
  if (max === min) {
    return 50;
  }

  return ((value - min) / (max - min)) * 100;
}

export function EmbeddingMap({ points }: { points: Point[] }) {
  const activePoints = points.filter((point) => point.projection);
  const xs = activePoints.map((point) => point.projection?.x ?? 0);
  const ys = activePoints.map((point) => point.projection?.y ?? 0);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 1;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 1;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_340px]">
      <div className="relative min-h-[640px] overflow-hidden rounded-[24px] border border-white/8 bg-[#171717] p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:88px_88px]" />
        {activePoints.map((point) => {
          const left = normalize(point.projection?.x ?? 0, minX, maxX);
          const top = normalize(point.projection?.y ?? 0, minY, maxY);
          return (
            <Link
              key={point.id}
              href={`/dashboard/papers/${point.id}`}
              className="absolute block -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <div className="group relative">
                <div className="h-4 w-4 rounded-full border border-white/50 bg-[#f4d4bc] shadow-[0_0_0_8px_rgba(244,212,188,0.08)] transition group-hover:scale-125" />
                <div className="pointer-events-none absolute left-4 top-4 hidden w-64 rounded-2xl border border-white/10 bg-[#111111]/95 p-3 text-sm text-white shadow-halo group-hover:block">
                  <p className="font-medium">{point.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.15em] text-mist">{point.status}</p>
                  <p className="mt-2 max-h-24 overflow-hidden text-sm leading-6 text-mist">{point.abstract || "No abstract available."}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded-[24px] border border-white/8 bg-[#171717] p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-mist">Legend</p>
        <div className="mt-4 space-y-4 text-sm leading-6 text-mist">
          <p>The initial projection is intentionally simple and deterministic so this MVP has a stable map without a separate analytics pipeline.</p>
          <p>Later iterations can replace the projection logic with PCA, UMAP, or a service-side manifold reducer while preserving the same stored x/y interface.</p>
          <p>Click any point to reopen the paper reader and summary workspace.</p>
        </div>
      </div>
    </div>
  );
}
