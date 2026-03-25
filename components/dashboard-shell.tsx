"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";

export function DashboardShell({
  user,
  children
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null };
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <main className="min-h-screen px-2 py-2 md:px-3 md:py-3">
      <div className="flex min-h-[calc(100vh-1rem)] gap-3 rounded-[32px] border border-white/10 bg-[#151515]/95 p-3 shadow-halo md:min-h-[calc(100vh-1.5rem)]">
        <div
          className="hidden shrink-0 lg:block"
          style={{
            width: collapsed ? 72 : sidebarWidth
          }}
        >
          <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} user={user} />
        </div>

        <div
          className="hidden w-2 shrink-0 cursor-col-resize rounded-full bg-white/[0.04] transition hover:bg-white/[0.12] lg:block"
          onMouseDown={(event) => {
            if (collapsed) {
              return;
            }

            event.preventDefault();

            const startX = event.clientX;
            const startWidth = sidebarWidth;

            const handleMove = (moveEvent: MouseEvent) => {
              const nextWidth = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), 184), 300);
              setSidebarWidth(nextWidth);
            };

            const handleUp = () => {
              window.removeEventListener("mousemove", handleMove);
              window.removeEventListener("mouseup", handleUp);
            };

            window.addEventListener("mousemove", handleMove);
            window.addEventListener("mouseup", handleUp);
          }}
        />

        <div className="min-w-0 flex-1 rounded-[28px] border border-white/8 bg-[#111111]">{children}</div>
      </div>
    </main>
  );
}
