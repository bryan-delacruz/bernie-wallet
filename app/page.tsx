import { SiteHeader } from "@/components/home/site-header";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { Trust } from "@/components/home/trust";
import { FinalCta } from "@/components/home/final-cta";
import { SiteFooter } from "@/components/home/site-footer";

// Landing "La Vitrina" · atmósfera única marfil (Lacoste/Apple). Estática, Server
// Component, cero JS de cliente. Cada sección vive en components/home/.

export default function HomePage() {
  return (
    <div className="bg-[#f6f4ef] text-[#17160f]">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Trust />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
