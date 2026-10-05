import { ImageResponse } from "next/og";
import { getCurrentUser } from "@/lib/supabase/server";
import { StreakShareCard } from "@/lib/share-card";
import { loadStreakContext } from "@/lib/streak-data";
import { loadShareFonts } from "@/lib/share-fonts";

export const runtime = "nodejs";

/** Formatos de salida: historia vertical y imagen de enlace. */
const SIZES = {
  story: { width: 1080, height: 1920 },
  link: { width: 1200, height: 630 },
} as const;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const format = new URL(request.url).searchParams.get("format");
  const { width, height } = format === "link" ? SIZES.link : SIZES.story;
  const [{ streak, totalExpenses, weekStart }, fonts] = await Promise.all([
    loadStreakContext(user.id),
    loadShareFonts(),
  ]);

  return new ImageResponse(
    (
      <StreakShareCard
        current={streak.current}
        days={streak.days}
        totalExpenses={totalExpenses}
        weekStart={weekStart}
        width={width}
        height={height}
      />
    ),
    {
      width,
      height,
      fonts: fonts.length > 0 ? fonts : undefined,
    },
  );
}
