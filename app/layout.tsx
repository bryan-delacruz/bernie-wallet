import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display serif premium para logotipo y títulos.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Bernie lee los correos de tu banco (BCP), reconoce cada consumo y lo organiza por ti. Solo lectura de tu Gmail, cifrado y siempre al día.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Bernie Wallet — Tus gastos se anotan solos",
    template: "%s · Bernie Wallet",
  },
  description: DESCRIPTION,
  applicationName: "Bernie Wallet",
  keywords: [
    "control de gastos",
    "finanzas personales",
    "BCP",
    "Gmail",
    "presupuesto",
    "Perú",
    "gastos automáticos",
  ],
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: "/",
    siteName: "Bernie Wallet",
    title: "Bernie Wallet — Tus gastos se anotan solos",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Bernie Wallet — Tus gastos se anotan solos",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f0c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
