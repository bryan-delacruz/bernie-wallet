"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Tags,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BernieLogoColor } from "@/components/brand/bernie-logo";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activity", label: "Actividad", icon: Receipt },
  { href: "/categories", label: "Categorías", icon: Tags },
  { href: "/settings", label: "Configuración", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      {/* Sidebar — escritorio */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-card px-4 py-6 md:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-2">
          <BernieLogoColor className="size-7" />
          <span className="font-heading text-lg font-medium tracking-tight">
            Bernie Wallet
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(pathname, href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-5" />
          Cerrar sesión
        </button>
      </aside>

      {/* Barra inferior — móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
              isActive(pathname, href)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
