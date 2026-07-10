"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toaster de Sonner sincronizado con el tema. top-center para no chocar con la
 *  barra de navegación inferior del dashboard en móvil. */
export function Toaster(props: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      richColors
      className="toaster group"
      toastOptions={{ classNames: { toast: "font-sans" } }}
      {...props}
    />
  );
}
