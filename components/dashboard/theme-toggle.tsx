"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // El tema solo se conoce en el cliente; evita desajuste de hidratación.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
            current === value
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
