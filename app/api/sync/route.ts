import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getGmailAccessToken, searchMessages, getMessage } from "@/lib/gmail/gmail-service";
import {
  classifyDiscovery,
  extractExpense,
  type NotificationType,
} from "@/lib/parser/parser-service";

// Usa node:crypto (token), Anthropic SDK y Buffer → forzamos runtime Node.
export const runtime = "nodejs";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Máximo de correos a PARSEAR con Claude por sync (lo caro). Default 100.
// La 1ª sincronización cubre los últimos 30 días (hasta este tope); si hubiera
// más, el siguiente sync continúa desde el cursor (del más viejo al más nuevo,
// sin dejar huecos). Ajustable con SYNC_MAX_RESULTS.
const MAX_MESSAGES = Number(process.env.SYNC_MAX_RESULTS) || 100;

// Modo descubrimiento (pruebas): audita TODOS los correos del banco (sin filtro
// de asunto) y registra en sync_discoveries los que parecen gasto y los filtros
// perderían. Se activa con SYNC_DISCOVERY=true. No afecta la capa real.
const DISCOVERY = process.env.SYNC_DISCOVERY === "true";
const DISCOVERY_MAX = 25; // correos a auditar por corrida (acota el costo de Claude)

// Reintentos automáticos por correo dentro del MISMO sync (con backoff). Si tras
// estos sigue fallando, lo descartamos y seguimos: un solo clic resuelve todo.
const MAX_RETRIES = 3;

// Cortacircuitos: si N correos seguidos agotan sus reintentos sin que ninguno
// tenga éxito, asumimos caída del servicio y paramos (no descartamos en masa).
const CIRCUIT_LIMIT = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reintenta `fn` con backoff exponencial; solo reintenta si LANZA (no si retorna). */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(400 * 2 ** (attempt - 1)); // 400ms, 800ms
    }
  }
  throw lastError;
}

type Sender = {
  sender: string;
  subject_pattern: string;
  notification_type: NotificationType;
  system_bank_id: string;
};

type PaymentType = "credit_card" | "debit_card" | "yape" | "account";

const TIPO_BY_TYPE: Record<NotificationType, PaymentType | null> = {
  credit_card_purchase: "credit_card",
  debit_card_purchase: "debit_card",
  service_payment: "account", // sale de una cuenta de origen, no de una tarjeta
  yape: "yape",
  transfer: null, // una transferencia no tiene tarjeta → sin medio de pago
};

const TIPO_LABEL: Record<string, string> = {
  credit_card: "TC",
  debit_card: "TD",
  yape: "Yape",
  account: "Cuenta",
};

const SOURCE_TYPES = new Set<PaymentType>(["credit_card", "debit_card", "yape", "account"]);

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    // Bancos conectados del usuario → { system_bank_id: user_bank_id }
    const { data: userBanks } = await supabase
      .from("user_banks")
      .select("id, system_bank_id")
      .eq("user_id", user.id);

    if (!userBanks || userBanks.length === 0) {
      return NextResponse.json({
        nuevos: 0,
        procesados: 0,
        message: "Conecta un banco en Configuración para sincronizar.",
      });
    }

    const userBankByBank = new Map(userBanks.map((b) => [b.system_bank_id, b.id]));
    const bankIds = userBanks.map((b) => b.system_bank_id);

    // Remitentes a vigilar según los bancos conectados.
    const { data: sendersData } = await supabase
      .from("system_senders")
      .select("sender, subject_pattern, notification_type, system_bank_id")
      .in("system_bank_id", bankIds);
    const senders = (sendersData ?? []) as Sender[];
    if (senders.length === 0) {
      return NextResponse.json({ nuevos: 0, procesados: 0 });
    }

    // Cursor: última sincronización o hace 30 días.
    const { data: lastSync } = await supabase
      .from("sync_logs")
      .select("last_sync_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // 1ª vez (sin sync previo) → últimos 30 días. Luego → desde el último corte.
    const cursorMs = lastSync?.last_sync_at
      ? new Date(lastSync.last_sync_at).getTime()
      : Date.now() - THIRTY_DAYS_MS;
    const afterSeconds = Math.floor(cursorMs / 1000);

    // Query de Gmail por remitentes únicos + fecha de corte.
    const uniqueSenders = [...new Set(senders.map((s) => s.sender))];
    const uniquePatterns = [...new Set(senders.map((s) => s.subject_pattern))];
    const subjectClause = uniquePatterns.map((p) => `"${p}"`).join(" OR ");
    // Filtramos por remitente + asunto + fecha en Gmail, para que el cupo se use
    // solo en correos transaccionales (no newsletters del mismo remitente).
    const query = `from:(${uniqueSenders.join(" OR ")}) subject:(${subjectClause}) after:${afterSeconds}`;

    const accessToken = await getGmailAccessToken(supabase, user.id);
    // Listamos TODOS los IDs nuevos (gratis); el tope caro se aplica al parsear.
    const allIds = await searchMessages(accessToken, query);

    // Anti-duplicados (expenses) + dead-letter (sync_failures). En lotes para no
    // exceder el largo de la URL del filtro `in` cuando hay muchos correos.
    const known = await collectExistingIds(supabase, "expenses", user.id, allIds);
    const deadLettered = await collectExistingIds(supabase, "sync_failures", user.id, allIds);

    // Autocategorización: memoria por comercio, aprendida de tus categorizaciones
    // previas (una sola query, sin IA). merchant normalizado → subcategoría más usada.
    const merchantMemory = await buildMerchantMemory(supabase, user.id);

    // Pendientes del MÁS VIEJO al MÁS NUEVO (Gmail los entrega al revés). El
    // cursor avanza en orden, así que parar en un fallo no deja huecos.
    const pendingAll = allIds
      .filter((id) => !known.has(id) && !deadLettered.has(id))
      .reverse();
    const totalNew = pendingAll.length;
    // Solo parseamos MAX_MESSAGES por corrida (lo caro es Claude); el resto queda
    // para el siguiente sync, que continúa desde donde quedó.
    const batch = pendingAll.slice(0, MAX_MESSAGES);

    let nuevos = 0;
    let resolved = 0; // correos que el cursor dejó atrás (guardados o definitivos)
    let descartados = 0; // correos dados por perdidos (agotaron reintentos)
    let latestMs = cursorMs;
    let detenido = false; // cortacircuitos: se paró por caída del servicio

    // Correos que agotaron reintentos. Quedan en espera: solo se "confirman" como
    // descartados si después un correo tiene éxito (señal de que el fallo era de
    // ESE correo y no del servicio). Si el cortacircuitos salta antes, NO se
    // confirman y se reintentan enteros el próximo sync.
    let consecutiveFails = 0;
    const giveUpBuffer: string[] = [];

    const commitGiveUps = async () => {
      if (giveUpBuffer.length === 0) return;
      await supabase.from("sync_failures").upsert(
        giveUpBuffer.map((message_id) => ({
          user_id: user.id,
          message_id,
          attempts: MAX_RETRIES,
          last_error: "max_retries",
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,message_id" },
      );
      descartados += giveUpBuffer.length;
      giveUpBuffer.length = 0;
    };

    // Registra un correo en sync_failures (traza + se filtra en futuros syncs).
    const recordFailure = async (id: string, reason: string) => {
      await supabase.from("sync_failures").upsert(
        {
          user_id: user.id,
          message_id: id,
          attempts: MAX_RETRIES,
          last_error: reason,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,message_id" },
      );
    };

    for (const id of batch) {
      let message;
      try {
        message = await withRetry(() => getMessage(accessToken, id));
      } catch {
        giveUpBuffer.push(id);
        if (++consecutiveFails >= CIRCUIT_LIMIT) {
          detenido = true; // caída del servicio: paramos sin confirmar descartes
          break;
        }
        continue;
      }

      // Detectar tipo por remitente + asunto.
      const match = senders.find(
        (s) =>
          message.from.includes(s.sender) &&
          message.subject.toLowerCase().includes(s.subject_pattern.toLowerCase()),
      );
      // No es un gasto: descarte definitivo. NO resetea el cortacircuitos ni
      // confirma descartes: un no-match no llamó al parser, así que no prueba que
      // el servicio esté sano.
      if (!match) {
        resolved += 1;
        latestMs = Math.max(latestMs, message.dateMs);
        continue;
      }

      let parsed;
      try {
        parsed = await withRetry(() => extractExpense(message.text, match.notification_type));
      } catch {
        giveUpBuffer.push(id);
        if (++consecutiveFails >= CIRCUIT_LIMIT) {
          detenido = true;
          break;
        }
        continue;
      }
      // El parser respondió (sano) pero no pudo extraer: definitivo. Dejamos traza
      // en sync_failures para no reprocesarlo y poder revisarlo después.
      if (!parsed) {
        await commitGiveUps();
        consecutiveFails = 0;
        await recordFailure(id, "unparseable");
        resolved += 1;
        latestMs = Math.max(latestMs, message.dateMs);
        continue;
      }

      const userBankId = userBankByBank.get(match.system_bank_id) ?? null;
      // Pago de servicio: el medio de origen varía (TC/TD/cuenta) y lo indica el
      // propio correo, así que confiamos en lo que detectó el parser.
      const src = parsed.payment_source_type as PaymentType;
      const tipo: PaymentType | null =
        match.notification_type === "service_payment"
          ? SOURCE_TYPES.has(src)
            ? src
            : "account"
          : TIPO_BY_TYPE[match.notification_type];

      // Resolver/crear el medio puede fallar transitoriamente; si pasa, tratamos
      // el correo como reintento (no guardamos el gasto sin medio).
      let paymentMethodId: string | null = null;
      if (tipo) {
        try {
          paymentMethodId = await withRetry(() =>
            resolvePaymentMethod(supabase, user.id, userBankId, tipo, parsed.payment_method_identifier),
          );
        } catch {
          giveUpBuffer.push(id);
          if (++consecutiveFails >= CIRCUIT_LIMIT) {
            detenido = true;
            break;
          }
          continue;
        }
      }

      const { error: insertError } = await supabase.from("expenses").insert({
        user_id: user.id,
        payment_method_id: paymentMethodId,
        subcategory_id: merchantMemory.get(normMerchant(parsed.merchant || "")) ?? null,
        amount: parsed.amount,
        currency: parsed.currency || "PEN",
        merchant: parsed.merchant || "—",
        occurred_at: new Date(message.dateMs).toISOString(),
        operation_number: parsed.operation_number || null,
        document_number: parsed.document_number || null,
        message_id: id,
        source: "sync",
      });
      // 23505 = duplicado (ya estaba): se trata como éxito (definitivo).
      if (insertError && insertError.code !== "23505") {
        giveUpBuffer.push(id);
        if (++consecutiveFails >= CIRCUIT_LIMIT) {
          detenido = true;
          break;
        }
        continue;
      }
      if (!insertError) nuevos += 1;
      await commitGiveUps();
      consecutiveFails = 0;
      resolved += 1;
      latestMs = Math.max(latestMs, message.dateMs);
    }

    // Si no saltó el cortacircuitos, los pendientes en buffer eran fallos aislados
    // (correos al final de la tanda): los confirmamos como descartados.
    if (!detenido) await commitGiveUps();

    await supabase.from("sync_logs").insert({
      user_id: user.id,
      last_sync_at: new Date(latestMs).toISOString(),
      emails_processed: resolved,
      emails_new: nuevos,
    });

    // ── Modo descubrimiento (pruebas): auditar el universo amplio del banco ──
    // Escanea TODOS los correos de los remitentes del banco (sin filtro de asunto)
    // y registra los que los filtros estrictos no capturan, para no perder gastos.
    let descubiertos = 0;
    if (DISCOVERY) {
      const wideQuery = `from:(${uniqueSenders.join(" OR ")}) after:${afterSeconds}`;
      const wideIds = await searchMessages(accessToken, wideQuery);
      const imported = await collectExistingIds(supabase, "expenses", user.id, wideIds);
      const analyzed = await collectExistingIds(supabase, "sync_discoveries", user.id, wideIds);
      const toAudit = wideIds
        .filter((id) => !imported.has(id) && !analyzed.has(id))
        .slice(0, DISCOVERY_MAX);

      for (const id of toAudit) {
        let message;
        try {
          message = await getMessage(accessToken, id);
        } catch {
          continue; // transitorio: se reintenta en otra corrida
        }

        // ¿Ya lo cubre un filtro estricto? entonces no es un gasto "perdido".
        const covered = senders.some(
          (s) =>
            message.from.includes(s.sender) &&
            message.subject.toLowerCase().includes(s.subject_pattern.toLowerCase()),
        );

        let verdict = "covered";
        let suggestedType: string | null = null;
        let suggestedSubject: string | null = null;
        let reason: string | null = "Coincide con un filtro existente.";

        if (!covered) {
          const v = await classifyDiscovery(message.text, message.subject, message.from);
          if (!v) continue; // fallo del parser: no registrar, reintentar luego
          verdict = v.is_expense ? "expense_candidate" : "not_expense";
          suggestedType = v.suggested_type || null;
          suggestedSubject = v.suggested_subject || null;
          reason = v.reason || null;
          if (v.is_expense) descubiertos += 1;
        }

        await supabase.from("sync_discoveries").upsert(
          {
            user_id: user.id,
            message_id: id,
            sender: message.from,
            subject: message.subject,
            verdict,
            suggested_type: suggestedType,
            suggested_subject: suggestedSubject,
            reason,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,message_id" },
        );
      }
    }

    // restantes = recuperables aún sin importar (fuera del tope o por reintentar).
    // Los descartados no cuentan: ya nos rendimos con ellos.
    const restantes = totalNew - resolved - descartados;
    return NextResponse.json({
      nuevos,
      procesados: resolved,
      restantes,
      descartados,
      detenido,
      descubiertos,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al sincronizar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Tope de la memoria por comercio: solo los N gastos categorizados más recientes
// (evita escanear un historial enorme; prioriza tus categorizaciones recientes).
const MERCHANT_MEMORY_LIMIT = 2000;

/** Normaliza el comercio para agrupar variantes del mismo (mayúsculas, espacios). */
function normMerchant(m: string): string {
  return m.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Memoria por comercio: aprende de tus gastos ya categorizados. Devuelve
 * `merchant normalizado → subcategoría más frecuente`. Una sola query, sin IA.
 */
async function buildMerchantMemory(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("expenses")
    .select("merchant, subcategory_id")
    .eq("user_id", userId)
    .not("subcategory_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(MERCHANT_MEMORY_LIMIT);

  const counts = new Map<string, Map<string, number>>();
  for (const row of data ?? []) {
    if (!row.subcategory_id || !row.merchant) continue;
    const key = normMerchant(row.merchant);
    const inner = counts.get(key) ?? new Map<string, number>();
    inner.set(row.subcategory_id, (inner.get(row.subcategory_id) ?? 0) + 1);
    counts.set(key, inner);
  }

  const memory = new Map<string, string>();
  for (const [key, inner] of counts) {
    let best = "";
    let bestN = 0;
    for (const [sub, n] of inner) {
      if (n > bestN) {
        bestN = n;
        best = sub;
      }
    }
    if (best) memory.set(key, best);
  }
  return memory;
}

/** Subconjunto de `ids` que ya existe en `table` para el usuario, consultado en lotes. */
async function collectExistingIds(
  supabase: SupabaseClient,
  table: "expenses" | "sync_failures" | "sync_discoveries",
  userId: string,
  ids: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await supabase
      .from(table)
      .select("message_id")
      .eq("user_id", userId)
      .in("message_id", ids.slice(i, i + CHUNK));
    for (const row of data ?? []) found.add(row.message_id as string);
  }
  return found;
}

/** Busca el medio de pago por identificador o lo crea bajo el banco del usuario. */
async function resolvePaymentMethod(
  supabase: SupabaseClient,
  userId: string,
  userBankId: string | null,
  tipo: PaymentType,
  identificador: string,
): Promise<string | null> {
  if (!identificador || !userBankId) return null;

  const { data: existing, error: selectError } = await supabase
    .from("payment_methods")
    .select("id")
    .eq("user_id", userId)
    .eq("user_bank_id", userBankId)
    .eq("identifier", identificador)
    .maybeSingle();
  if (selectError) throw new Error("payment_methods select failed");
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from("payment_methods")
    .insert({
      user_id: userId,
      user_bank_id: userBankId,
      type: tipo,
      identifier: identificador,
      alias: `${TIPO_LABEL[tipo]} ${identificador}`,
    })
    .select("id")
    .single();
  if (insertError) throw new Error("payment_methods insert failed");
  return created?.id ?? null;
}
