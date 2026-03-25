"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Home, LogOut, Map, Search, Settings, User2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/papers", label: "Papers", icon: Search },
  { href: "/dashboard/map", label: "Map", icon: Map }
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <aside className="flex min-h-full flex-col rounded-[28px] border border-white/8 bg-[#1a1a1a] p-3">
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className={cn("w-full rounded-[22px] bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.07]", collapsed && "px-2 py-4")}
        >
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
        </button>

        {menuOpen ? (
          <div
            className={cn(
              "absolute z-20 mt-2 w-[240px] rounded-[20px] border border-white/10 bg-[#141414] p-2 shadow-halo",
              collapsed ? "left-full top-0 ml-3" : "left-0 right-0"
            )}
          >
            <Link
              href="/dashboard/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white transition hover:bg-white/[0.06]"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white transition hover:bg-white/[0.06]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        ) : null}
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
    </aside>
  );
}
