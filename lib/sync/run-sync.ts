import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getGmailAccessToken,
  searchMessages,
  getMessage,
  GmailAuthError,
} from "@/lib/gmail/gmail-service";
import { extractExpense, type NotificationType } from "@/lib/parser/parser-service";
import { scheduleWebhookDelivery } from "@/lib/integrations/webhook-delivery";
import {
  MERCHANT_MEMORY_LIMIT,
  normMerchant,
  tallyMerchantMemory,
} from "@/lib/categorize/merchant";

// Ventana de la PRIMERA sincronización (cuando no hay cursor previo). Configurable
// vía SYNC_INITIAL_DAYS para hacer backfill de correos antiguos. Default 30 días.
const INITIAL_DAYS = Number(process.env.SYNC_INITIAL_DAYS) || 30;
const INITIAL_WINDOW_MS = INITIAL_DAYS * 24 * 60 * 60 * 1000;

// Máximo de correos a LEER de Gmail por sync (el parseo es local y gratis; lo que
// se acota aquí es el volumen de lecturas a la API). Default 100.
// La 1ª sincronización cubre la ventana inicial (hasta este tope); si hubiera
// más, el siguiente sync continúa desde el cursor (del más viejo al más nuevo,
// sin dejar huecos). Ajustable con SYNC_MAX_RESULTS.
const MAX_MESSAGES = Number(process.env.SYNC_MAX_RESULTS) || 100;

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
  plin: "account", // el Plin de Interbank se descuenta directo de la cuenta
};

const TIPO_LABEL: Record<string, string> = {
  credit_card: "TC",
  debit_card: "TD",
  yape: "Yape",
  account: "Cuenta",
};

/** Correos a inspeccionar por corrida en modo descubrimiento. Cada uno cuesta una
 *  lectura a Gmail. */
const DISCOVERY_LIMIT = 10;

const SOURCE_TYPES = new Set<PaymentType>(["credit_card", "debit_card", "yape", "account"]);

/** Quién disparó la corrida. Sirve para distinguir en los diagnósticos si falla
 *  el cron (problema de todos) o el botón (problema de uno). */
export type SyncSource = "manual" | "cron";

export type SyncResult = {
  nuevos: number;
  procesados: number;
  restantes?: number;
  descartados?: number;
  /** El cortacircuitos paró la corrida: se asume caída del servicio. */
  detenido?: boolean;
  message?: string;
};

/**
 * El pipeline de sincronización, para un usuario. Vive aparte del route handler
 * porque lo corren dos llamadores: el botón "Sincronizar" —con el cliente del
 * propio usuario, donde RLS aplica— y el cron, que recorre a todos con la secret
 * key. Por eso cada consulta filtra por `userId` de forma explícita y no se apoya
 * en RLS: con la secret key no hay RLS que la respalde.
 *
 * Lanza `GmailAuthError` si se perdió el acceso a Gmail; quien llama decide qué
 * hacer con eso.
 */
export async function runSync(
  supabase: SupabaseClient,
  userId: string,
  source: SyncSource = "manual",
): Promise<SyncResult> {
    // Bancos conectados del usuario → { system_bank_id: user_bank_id }
    const { data: userBanks } = await supabase
      .from("user_banks")
      .select("id, system_bank_id")
      .eq("user_id", userId);

    if (!userBanks || userBanks.length === 0) {
      return ({
        nuevos: 0,
        procesados: 0,
        message: "Conecta un banco en Configuración para sincronizar.",
      });
    }

    const userBankByBank = new Map(userBanks.map((b) => [b.system_bank_id, b.id]));
    const bankIds = userBanks.map((b) => b.system_bank_id);

    // Remitentes a vigilar según los bancos conectados.
    // El descubrimiento se enciende por banco desde el panel (SPEC §17.6), no por
    // variable de entorno: así se gasta cuota solo donde hay algo que mapear.
    const { data: discoveringBanks } = await supabase
      .from("system_banks")
      .select("id")
      .in("id", bankIds)
      .eq("discovering", true);
    const discovery = (discoveringBanks ?? []).length > 0;

    const { data: sendersData } = await supabase
      .from("system_senders")
      .select("sender, subject_pattern, notification_type, system_bank_id")
      .in("system_bank_id", bankIds);
    const senders = (sendersData ?? []) as Sender[];
    if (senders.length === 0) {
      return ({ nuevos: 0, procesados: 0 });
    }

    // Cursor: última sincronización o el inicio de la ventana inicial.
    const { data: lastSync } = await supabase
      .from("sync_logs")
      .select("last_sync_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // 1ª vez (sin sync previo) → ventana inicial. Luego → desde el último corte.
    const cursorMs = lastSync?.last_sync_at
      ? new Date(lastSync.last_sync_at).getTime()
      : Date.now() - INITIAL_WINDOW_MS;
    const afterSeconds = Math.floor(cursorMs / 1000);

    // Query de Gmail por remitentes únicos + fecha de corte.
    const uniqueSenders = [...new Set(senders.map((s) => s.sender))];
    const uniquePatterns = [...new Set(senders.map((s) => s.subject_pattern))];
    const subjectClause = uniquePatterns.map((p) => `"${p}"`).join(" OR ");
    // Filtramos por remitente + asunto + fecha en Gmail, para que el cupo se use
    // solo en correos transaccionales (no newsletters del mismo remitente).
    const query = `from:(${uniqueSenders.join(" OR ")}) subject:(${subjectClause}) after:${afterSeconds}`;

    const accessToken = await getGmailAccessToken(supabase, userId);
    // Listamos TODOS los IDs nuevos (listar es gratis); el tope se aplica al leerlos.
    const allIds = await searchMessages(accessToken, query);

    // Diagnóstico: si la búsqueda estricta no trae nada, comprobar si SÍ hay
    // correos de esos remitentes (sin filtro de asunto). Distingue "no matchea el
    // asunto" de "no hay correos". Solo corre cuando allIds=0 (barato).
    // Los logs llevan conteos, nunca contenido: un asunto del banco incluye monto y
    // comercio, y los logs viven en un tercero con otra retención y otros accesos.
    // Lo que el usuario necesite ver de sus propios correos vive en
    // `sync_discoveries`, protegido por RLS.
    console.log(`[sync] user=${userId} estrictos=${allIds.length}`);

    if (discovery) {
      await discoverUnknownSubjects(supabase, userId, accessToken, {
        senders: uniqueSenders,
        afterSeconds,
        matched: allIds,
      });
    }

    // Anti-duplicados (expenses) + dead-letter (sync_failures). En lotes para no
    // exceder el largo de la URL del filtro `in` cuando hay muchos correos.
    const known = await collectExistingIds(supabase, "expenses", userId, allIds);
    const deadLettered = await collectExistingIds(supabase, "sync_failures", userId, allIds);

    // Autocategorización: memoria por comercio, aprendida de tus categorizaciones
    // previas (una sola query, sin IA). merchant normalizado → subcategoría más usada.
    const merchantMemory = await buildMerchantMemory(supabase, userId);

    // Pendientes del MÁS VIEJO al MÁS NUEVO (Gmail los entrega al revés). El
    // cursor avanza en orden, así que parar en un fallo no deja huecos.
    const pendingAll = allIds
      .filter((id) => !known.has(id) && !deadLettered.has(id))
      .reverse();
    const totalNew = pendingAll.length;
    // Solo leemos MAX_MESSAGES por corrida (acota las lecturas a Gmail); el resto
    // queda para el siguiente sync, que continúa desde donde quedó.
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
          user_id: userId,
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
          user_id: userId,
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
      } catch (error) {
        // Perder el acceso a Gmail no es un fallo del correo: reintentarlo o
        // descartarlo esconde el problema. Propagamos para responder gmail_auth
        // y que el usuario pueda reconectar la cuenta.
        if (error instanceof GmailAuthError) throw error;
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

      // El parser es puro y determinístico (sin red): no se reintenta. Si no pudo
      // extraer, es un formato no soportado (definitivo). Dejamos traza en
      // sync_failures para no reprocesarlo y poder revisarlo después.
      const parsed = extractExpense(message.text, match.notification_type);
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
            resolvePaymentMethod(supabase, userId, userBankId, tipo, parsed.payment_method_identifier),
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
        user_id: userId,
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
      user_id: userId,
      last_sync_at: new Date(latestMs).toISOString(),
      emails_processed: resolved,
      emails_new: nuevos,
      source,
      discarded: descartados,
      halted: detenido,
    });

    // restantes = recuperables aún sin importar (fuera del tope o por reintentar).
    // Los descartados no cuentan: ya nos rendimos con ellos.
    const restantes = totalNew - resolved - descartados;
    // Gastos nuevos en categorías compartidas → avisar a las apps conectadas.
    if (nuevos > 0) scheduleWebhookDelivery();
    return ({
      nuevos,
      procesados: resolved,
      restantes,
      descartados,
      detenido,
    });
}

/**
 * Memoria por comercio: aprende de los gastos ya categorizados del usuario.
 * El conteo vive en `lib/categorize/merchant.ts` (puro, compartido con
 * `/categorize`); acá queda solo la query.
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

  return tallyMerchantMemory(data ?? []);
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

/**
 * Deja constancia de una corrida que falló. Sin esto, un usuario al que le falla el
 * sync es invisible: él ve gastos que no aparecen y nadie se entera.
 *
 * El cursor **no avanza**: se repite el `last_sync_at` anterior, para que la
 * siguiente corrida vuelva a mirar los mismos correos. Y se guarda un código corto,
 * nunca el mensaje de error, que puede traer datos del correo.
 */
export async function recordSyncError(
  supabase: SupabaseClient,
  userId: string,
  source: SyncSource,
  errorCode: "gmail_auth" | "unexpected",
): Promise<void> {
  const { data: last } = await supabase
    .from("sync_logs")
    .select("last_sync_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("sync_logs").insert({
    user_id: userId,
    last_sync_at: last?.last_sync_at ?? new Date(Date.now() - INITIAL_WINDOW_MS).toISOString(),
    emails_processed: 0,
    emails_new: 0,
    source,
    error_code: errorCode,
  });
}

/**
 * Anota los correos de un remitente conocido cuyo **asunto** no reconocemos.
 *
 * Es la herramienta para mapear un banco nuevo: en vez de pedirle al usuario que
 * reenvíe ejemplos, la app descubre sola qué plantillas le llegan. Lo guardado
 * —remitente y asunto— es dato personal, así que vive en `sync_discoveries` bajo
 * RLS y nunca en los logs (§14.4).
 *
 * No toca el cursor ni la cola de gastos: es solo observación.
 */
async function discoverUnknownSubjects(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  { senders, afterSeconds, matched }: { senders: string[]; afterSeconds: number; matched: string[] },
): Promise<void> {
  try {
    const wideIds = await searchMessages(
      accessToken,
      `from:(${senders.join(" OR ")}) after:${afterSeconds}`,
    );
    const matchedSet = new Set(matched);
    const candidates = wideIds.filter((id) => !matchedSet.has(id));
    if (candidates.length === 0) return;

    // Los ya anotados no se vuelven a leer: la gracia es descubrir plantillas
    // nuevas, no gastar cuota releyendo las mismas.
    const seen = await collectExistingIds(supabase, "sync_discoveries", userId, candidates);
    const fresh = candidates.filter((id) => !seen.has(id)).slice(0, DISCOVERY_LIMIT);
    if (fresh.length === 0) return;

    const rows = [];
    for (const id of fresh) {
      const message = await getMessage(accessToken, id).catch(() => null);
      if (!message) continue;
      rows.push({
        user_id: userId,
        message_id: id,
        sender: message.from,
        subject: message.subject,
        verdict: "expense_candidate",
        reason: "asunto no registrado en system_senders",
        updated_at: new Date().toISOString(),
      });
    }
    if (rows.length > 0) {
      await supabase.from("sync_discoveries").upsert(rows, { onConflict: "user_id,message_id" });
    }
    console.log(`[sync][discovery] user=${userId} nuevos=${rows.length}`);
  } catch {
    // Descubrir es un extra: si falla, la sincronización sigue su curso.
  }
}
