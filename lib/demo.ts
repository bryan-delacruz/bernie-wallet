import type { SupabaseClient, User } from "@supabase/supabase-js";
import { seedCashPaymentMethod, seedDefaultCategories } from "@/lib/seed";

/**
 * Cuenta de demostración: un usuario anónimo de Supabase con tres meses de
 * gastos inventados. Todo se escribe con la sesión del propio visitante, así
 * que RLS aplica igual que con una cuenta real y nadie ve los datos de otro.
 * Las cuentas anónimas se borran solas a las 24 horas (migración 0007).
 */

const BCP_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_EMAIL = "demo@bernie-wallet.app";

export function isDemoUser(user: Pick<User, "is_anonymous"> | null | undefined) {
  return Boolean(user?.is_anonymous);
}

type Medio = "tc" | "td" | "yape" | "cuenta";

/** [comercio, subcategoría, medio, monto mínimo, monto máximo, veces por mes] */
const PATRONES: [string, string, Medio, number, number, number][] = [
  ["Rappi", "Delivery", "tc", 28, 65, 5],
  ["PedidosYa", "Delivery", "tc", 25, 55, 2],
  ["Plaza Vea", "Supermercado", "td", 80, 260, 3],
  ["Tottus", "Supermercado", "tc", 60, 190, 2],
  ["Starbucks", "Restaurantes", "tc", 14, 32, 3],
  ["La Lucha Sanguchería", "Restaurantes", "yape", 22, 48, 2],
  ["Uber", "Taxi / Uber", "tc", 12, 38, 6],
  ["Metropolitano", "Transporte público", "yape", 3, 6, 6],
  ["Repsol", "Combustible", "td", 90, 150, 1],
  ["Los Portales Estacionamientos", "Estacionamiento", "yape", 6, 15, 2],
  ["Inkafarma", "Farmacia", "td", 18, 95, 1],
  ["Cineplanet", "Cine", "tc", 24, 60, 1],
  ["Juan P. (Yape)", "Persona a persona", "yape", 20, 120, 2],
];

/**
 * Backlog de la demo: comercios que quedan **sin categorizar en los meses viejos**
 * y categorizados en el mes en curso (SPEC §18).
 *
 * Que el mes en curso esté limpio no es un detalle: un gasto sin categoría rompe
 * su día en la racha (§16.3), así que el backlog va atrás. La racha abre sana y
 * los huecos quedan en el pasado — justo lo que le pasa a quien dejó de ordenar
 * un tiempo y después retomó.
 *
 * Con historial reciente y unánime, estos comercios llegan a /categorize con
 * sugerencia firme y botón de un toque.
 */
const BACKLOG = new Set(["Rappi", "Uber"]);

/** Un comercio con **un solo** antecedente: la memoria no decide con eso (§18.3). */
const UN_SOLO_ANTECEDENTE = "Inkafarma";

/**
 * La persona del caso difícil: el mismo Yape fue plata prestada, una cena y la
 * cuota del depa. Su historial se contradice, así que la memoria se calla y el
 * grupo se marca "varía". Es el caso que justifica las reglas por comercio (§18.8).
 */
const AMBIGUO = "Juan P. (Yape)";
const AMBIGUO_SUBS = ["Persona a persona", "Restaurantes", "Supermercado"];

/** Compras sueltas y viejas, sin ningún antecedente: no hay nada que sugerir. */
const SIN_HISTORIAL: [string, Medio, number, number][] = [
  ["Veterinaria Pet Center", "td", 145.0, 52],
  ["Sodimac", "tc", 89.9, 71],
];

/** Servicios del mes: día fijo y monto parecido cada mes. */
const SERVICIOS: [string, string, Medio, number, number][] = [
  ["Luz del Sur", "Luz", "cuenta", 12, 118],
  ["Sedapal", "Agua", "cuenta", 14, 46],
  ["Movistar Hogar", "Internet", "cuenta", 5, 109],
  ["Calidda", "Gas", "cuenta", 18, 38],
];

/** Pseudoaleatorio con semilla: la demo se ve igual en cada visita. */
function generador(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export async function seedDemo(supabase: SupabaseClient, userId: string) {
  const now = new Date().toISOString();
  const { error: userErr } = await supabase
    .from("users")
    .upsert({ id: userId, email: DEMO_EMAIL, onboarded_at: now }, { onConflict: "id" });
  if (userErr) throw new Error(`users: ${userErr.message}`);

  await seedDefaultCategories(supabase, userId);
  await seedCashPaymentMethod(supabase, userId);

  const { data: subs, error: subErr } = await supabase
    .from("subcategories")
    .select("id, name")
    .eq("user_id", userId);
  if (subErr) throw new Error(`subcategories: ${subErr.message}`);
  // Categorías sin subcategorías (Salud, Entretenimiento) quedan sin asignar,
  // igual que en una cuenta real: se ven como "Sin subcategoría".
  const subId = new Map((subs ?? []).map((s) => [s.name, s.id]));

  const { data: banco, error: bankErr } = await supabase
    .from("user_banks")
    .insert({ user_id: userId, system_bank_id: BCP_ID })
    .select("id")
    .single();
  if (bankErr) throw new Error(`user_banks: ${bankErr.message}`);

  const { data: medios, error: pmErr } = await supabase
    .from("payment_methods")
    .insert([
      { user_id: userId, user_bank_id: banco.id, type: "credit_card", identifier: "****2813", alias: "Visa Signature" },
      { user_id: userId, user_bank_id: banco.id, type: "debit_card", identifier: "****5530" },
      { user_id: userId, user_bank_id: banco.id, type: "yape", identifier: "***417" },
      { user_id: userId, user_bank_id: banco.id, type: "account", identifier: "****0921", alias: "Cuenta sueldo" },
    ])
    .select("id, type");
  if (pmErr) throw new Error(`payment_methods: ${pmErr.message}`);
  const medio: Record<Medio, string> = {
    tc: medios.find((m) => m.type === "credit_card")!.id,
    td: medios.find((m) => m.type === "debit_card")!.id,
    yape: medios.find((m) => m.type === "yape")!.id,
    cuenta: medios.find((m) => m.type === "account")!.id,
  };

  const azar = generador(20260928);
  const hoy = Date.now();
  const DIA = 86_400_000;
  const gastos: Record<string, unknown>[] = [];
  // `sub` en null deja el gasto sin categoría: así se siembra el backlog.
  const agregar = (
    comercio: string,
    sub: string | null,
    m: Medio,
    monto: number,
    fecha: Date,
    moneda = "PEN",
  ) => {
    // Hora del día entre 8:00 y 22:00 de Lima (UTC-5).
    fecha.setUTCHours(13 + Math.floor(azar() * 14), Math.floor(azar() * 60), 0, 0);
    if (fecha.getTime() > hoy) return;
    gastos.push({
      user_id: userId,
      merchant: comercio,
      amount: monto.toFixed(2),
      currency: moneda,
      occurred_at: fecha.toISOString(),
      subcategory_id: sub ? (subId.get(sub) ?? null) : null,
      payment_method_id: medio[m],
      source: "sync",
    });
  };

  // Tres meses hacia atrás desde hoy. El mes 0 es el en curso.
  let ambiguoN = 0;
  for (let mes = 0; mes < 3; mes++) {
    const viejo = mes > 0;
    for (const [comercio, sub, m, min, max, veces] of PATRONES) {
      for (let i = 0; i < veces; i++) {
        const dias = mes * 30 + Math.floor(azar() * 30);
        let categoria: string | null = sub;
        if (viejo && (BACKLOG.has(comercio) || comercio === UN_SOLO_ANTECEDENTE)) {
          categoria = null;
        } else if (viejo && comercio === AMBIGUO) {
          categoria = null;
        } else if (!viejo && comercio === AMBIGUO) {
          // En el mes en curso sí quedan categorizados, pero cada uno distinto:
          // de ahí sale el historial que se contradice.
          categoria = AMBIGUO_SUBS[ambiguoN++ % AMBIGUO_SUBS.length];
        }
        agregar(comercio, categoria, m, min + azar() * (max - min), new Date(hoy - dias * DIA));
      }
    }
    for (const [comercio, sub, m, dia, monto] of SERVICIOS) {
      const f = new Date(hoy);
      f.setUTCMonth(f.getUTCMonth() - mes, dia);
      agregar(comercio, sub, m, monto * (0.92 + azar() * 0.16), f);
    }
  }
  for (const [comercio, m, monto, dias] of SIN_HISTORIAL) {
    agregar(comercio, null, m, monto, new Date(hoy - dias * DIA));
  }

  // Una suscripción en dólares y un gasto anotado a mano.
  agregar("Spotify", "Streaming", "tc", 5.99, new Date(hoy - 4 * DIA), "USD");
  gastos.push({
    user_id: userId,
    merchant: "Mercado de Surquillo",
    amount: "46.50",
    currency: "PEN",
    occurred_at: new Date(hoy - 2 * DIA).toISOString(),
    subcategory_id: subId.get("Supermercado") ?? null,
    payment_method_id: null,
    source: "manual",
  });

  const { error: expErr } = await supabase.from("expenses").insert(gastos);
  if (expErr) throw new Error(`expenses: ${expErr.message}`);
}
