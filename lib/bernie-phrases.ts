/**
 * Lo que dice Bernie, el amigo perruno que te ayuda a cuidar tus finanzas.
 *
 * Reglas de voz (ver `.interface-design/system.md`):
 * - Tierno, íntimo, reconfortante. Bernie **no pide nada**: no apura, no corrige,
 *   no propone metas. Está. Eso lo separa de tierno a pegajoso.
 * - Tuteo, con léxico limeño suave ("ya pues", "tranqui", "al toque") cada tres o
 *   cuatro frases. Nunca jerga de calle: envejece y suena a disfraz.
 * - **Nunca montos.** Una notificación se lee en la pantalla bloqueada, donde la
 *   ve cualquiera que agarre el teléfono.
 * - Sin signos de exclamación: la calidez está en lo que dice, no en los signos.
 * - "Guau" **solo** para celebrar, y con punto. Dicho bajito pega más.
 * - Nunca menciona una racha rota ni un reto perdido.
 */

/** Momento del usuario al que responde la frase. */
export type PhraseMood =
  /** Saludo de todos los días, sin nada particular que decir. */
  | "daily"
  /** Es lunes: arranca la semana. */
  | "monday"
  /** Es viernes. */
  | "friday"
  /** Fin de semana. */
  | "weekend"
  /** Viene con racha. Admite {days}. */
  | "streak"
  /** Alcanzó un hito: el único lugar donde va "guau". */
  | "milestone"
  /** Ayer no gastó nada. */
  | "quiet"
  /** Tiene gastos sin categoría. Informa claro, sin ternura decorativa. */
  | "pending";

export type Phrase = { id: string; mood: PhraseMood; text: string };

/**
 * El repertorio. Los ids son estables porque se guarda el último enviado para no
 * repetir dos días seguidos.
 */
export const PHRASES: Phrase[] = [
  { id: "daily-1", mood: "daily", text: "Buenos días. Aquí estoy, como siempre." },
  { id: "daily-2", mood: "daily", text: "Hoy no revises nada, yo me encargo." },
  { id: "daily-3", mood: "daily", text: "Tus cuentas durmieron tranquilas." },
  { id: "daily-4", mood: "daily", text: "Tranqui. Aquí nada se pierde." },
  { id: "daily-5", mood: "daily", text: "Un cafecito y seguimos, ya pues." },
  { id: "daily-6", mood: "daily", text: "Todo en orden por acá. Que tengas buen día." },
  { id: "daily-7", mood: "daily", text: "Sigo despierto, anotando. Tú tranquilo." },
  { id: "daily-8", mood: "daily", text: "No me moví de aquí. Todo anotado." },

  { id: "monday-1", mood: "monday", text: "Es lunes. Empezamos de nuevo, sin apuro." },
  { id: "monday-2", mood: "monday", text: "Lunes. Un cafecito y le damos." },
  { id: "monday-3", mood: "monday", text: "Semana nueva. Yo ya estoy listo." },

  { id: "friday-1", mood: "friday", text: "Viernes. Sal tranquilo, que yo anoto." },
  { id: "friday-2", mood: "friday", text: "Es viernes. Disfruta, después vemos." },
  { id: "friday-3", mood: "friday", text: "Viernes. Lo que gastes hoy lo tengo mañana." },

  { id: "weekend-1", mood: "weekend", text: "Fin de semana. Descansa, yo me quedo." },
  { id: "weekend-2", mood: "weekend", text: "Hoy no hay nada que hacer. Solo descansar." },
  { id: "weekend-3", mood: "weekend", text: "Me quedo cuidando. Ve tranquilo." },

  { id: "streak-1", mood: "streak", text: "{days} días al día. Lo estás haciendo bien." },
  { id: "streak-2", mood: "streak", text: "Llevas {days} días sin que se escape nada." },
  { id: "streak-3", mood: "streak", text: "{days} días seguidos. Y yo acá, mirándote." },
  { id: "streak-4", mood: "streak", text: "Van {days} días. Eso no es suerte." },

  { id: "milestone-1", mood: "milestone", text: "{days} días al día. Guau." },
  { id: "milestone-2", mood: "milestone", text: "Mes cerrado, todo categorizado. Guau, en serio." },
  { id: "milestone-3", mood: "milestone", text: "Lo lograste. Guau." },

  { id: "quiet-1", mood: "quiet", text: "Ayer no gastaste nada. Eso también es cuidarse." },
  { id: "quiet-2", mood: "quiet", text: "Día tranquilo el de ayer. Me gustó." },
  { id: "quiet-3", mood: "quiet", text: "Ayer no hubo nada que anotar. Qué paz." },

  { id: "pending-1", mood: "pending", text: "Hay gastos esperando categoría. Cuando puedas." },
  { id: "pending-2", mood: "pending", text: "Te dejé unos gastos sin categoría. Al toque los vemos." },
  { id: "pending-3", mood: "pending", text: "Si hoy no te da la cabeza para ordenar, lo vemos mañana." },
];

/** Estado del usuario con el que se elige qué decir. */
export type PhraseContext = {
  /** Día de la semana en Lima, 0 = domingo. */
  weekday: number;
  streakDays: number;
  /** Alcanzó un hito hoy. */
  milestone: boolean;
  /** Ayer no hubo gastos. */
  quietYesterday: boolean;
  pendingExpenses: number;
};

/**
 * Qué momento corresponde, de más específico a más genérico. El orden es la
 * decisión editorial: celebrar gana sobre informar, y lo informativo
 * ("tienes pendientes") solo aparece si no hay nada lindo que decir.
 */
export function moodFor(context: PhraseContext): PhraseMood {
  if (context.milestone) return "milestone";
  if (context.streakDays >= 3) return "streak";
  if (context.quietYesterday) return "quiet";
  if (context.weekday === 0 || context.weekday === 6) return "weekend";
  if (context.weekday === 1) return "monday";
  if (context.weekday === 5) return "friday";
  if (context.pendingExpenses > 0) return "pending";
  return "daily";
}

/**
 * Elige una frase del momento que toca, evitando la última enviada. `seed` hace
 * la elección reproducible: el llamador pasa algo estable del día, así el mismo
 * usuario no recibe dos frases distintas si el envío se reintenta.
 */
export function pickPhrase(
  context: PhraseContext,
  { seed = 0, lastId }: { seed?: number; lastId?: string } = {},
): Phrase {
  const mood = moodFor(context);
  const pool = PHRASES.filter((p) => p.mood === mood);
  // Con una sola frase en el grupo, repetir es mejor que callarse.
  const options = pool.length > 1 ? pool.filter((p) => p.id !== lastId) : pool;
  const phrase = options[Math.abs(seed) % options.length];
  return { ...phrase, text: phrase.text.replace("{days}", String(context.streakDays)) };
}
