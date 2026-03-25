"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Home, LogOut, Map, Search, Sparkles, User2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard", label: "Papers", icon: Search },
  { href: "/dashboard/map", label: "Map", icon: Map },
  { href: "/dashboard", label: "Summaries", icon: Sparkles }
];

export function AppSidebar({
  user,
  collapsed = false,
  onToggle
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null };
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-full flex-col rounded-[28px] border border-white/8 bg-[#1a1a1a] p-3">
      <div className={cn("rounded-[22px] bg-white/[0.04] p-4", collapsed && "px-2 py-4")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f4d4bc] text-[#111111]">
            <User2 className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{user?.name ?? "Researcher"}</p>
              <p className="truncate text-sm text-mist">{user?.email ?? "Signed in"}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex justify-center lg:justify-end">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="mt-4 space-y-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

          return (
            <Link
              key={`${href}-${label}`}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                collapsed && "justify-center px-2",
                active ? "bg-white/8 text-white" : "text-mist hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {!collapsed ? label : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        {!collapsed ? (
          <div className="rounded-[20px] border border-white/8 bg-[#151515] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-mist">Workspace note</p>
            <p className="mt-2 text-sm leading-6 text-mist">
              The summary prompt lives in <span className="text-white">prompts/paper-agent.md</span> so you can tune the agent without touching the UI.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition hover:bg-white/[0.08]",
            collapsed && "px-2"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed ? "Sign out" : null}
        </button>
      </div>
    </aside>
  );
}
