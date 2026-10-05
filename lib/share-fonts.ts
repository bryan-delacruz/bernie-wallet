import "server-only";

/**
 * Tipografías de marca para `ImageResponse`: Fraunces en el número y el wordmark,
 * Geist en el cuerpo. Entran por `next/font/google`, así que no hay archivo en
 * disco y hay que bajarlas una vez por instancia. `satori` no lee woff2, y Google
 * devuelve TTF cuando no se anuncia soporte. Si una descarga falla, la tarjeta se
 * dibuja igual con lo que haya.
 */

export type ShareFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: "normal";
};

const FAMILIES: { name: string; query: string; weight: 400 | 600 }[] = [
  { name: "Fraunces", query: "Fraunces:opsz,wght@9..144,600", weight: 600 },
  { name: "Geist", query: "Geist:wght@400", weight: 400 },
];

let fontsPromise: Promise<ShareFont[]> | null = null;

export function loadShareFonts(): Promise<ShareFont[]> {
  if (fontsPromise) return fontsPromise;
  fontsPromise = Promise.all(FAMILIES.map(fetchFamily)).then((fonts) =>
    fonts.filter((font): font is ShareFont => font !== null),
  );
  return fontsPromise;
}

async function fetchFamily({
  name,
  query,
  weight,
}: (typeof FAMILIES)[number]): Promise<ShareFont | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${query}`).then((r) =>
      r.text(),
    );
    const url = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
    if (!url) return null;
    const data = await fetch(url).then((r) => r.arrayBuffer());
    return { name, data, weight, style: "normal" };
  } catch {
    return null;
  }
}
