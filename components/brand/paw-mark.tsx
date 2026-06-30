import { cn } from "@/lib/utils";

/** Huella del Boyero de Berna — sello de marca. Hereda el color vía currentColor. */
export function PawMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <circle cx="6" cy="9" r="2.1" />
      <circle cx="11" cy="6.5" r="2.1" />
      <circle cx="16" cy="7.5" r="2.1" />
      <circle cx="20" cy="11" r="1.8" />
      <path d="M12 12c3.2 0 6 2.2 6 4.8 0 1.9-1.7 2.7-3.4 2.2-1-.3-1.7-.7-2.6-.7s-1.6.4-2.6.7C7.7 19.5 6 18.7 6 16.8 6 14.2 8.8 12 12 12z" />
    </svg>
  );
}
