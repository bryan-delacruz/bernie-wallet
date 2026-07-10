import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
const MODEL = "claude-haiku-4-5";

export type NotificationType =
  | "credit_card_purchase"
  | "debit_card_purchase"
  | "service_payment"
  | "yape"
  | "transfer";

export type ParsedExpense = {
  amount: number;
  currency: string;
  merchant: string;
  payment_method_identifier: string;
  payment_source_type: string;
  operation_number: string;
  document_number: string;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    amount: { type: "number", description: "Monto del gasto, solo el número." },
    currency: { type: "string", enum: ["PEN", "USD"], description: "Código de moneda." },
    merchant: { type: "string", description: "Comercio o beneficiario." },
    payment_method_identifier: {
      type: "string",
      description: "Identificador del medio (ej. ****2813, celular enmascarado). Vacío si no aplica.",
    },
    payment_source_type: {
      type: "string",
      description:
        "Tipo del medio de origen: 'credit_card' (Tarjeta de crédito), 'debit_card' (Tarjeta de débito), 'account' (cuenta de ahorros/corriente), 'yape', o '' si no se indica.",
    },
    operation_number: { type: "string", description: "Número de operación. Vacío si no hay." },
    document_number: { type: "string", description: "Número de documento. Vacío si no hay." },
  },
  required: [
    "amount",
    "currency",
    "merchant",
    "payment_method_identifier",
    "payment_source_type",
    "operation_number",
    "document_number",
  ],
} as const;

const TYPE_HINTS: Record<NotificationType, string> = {
  credit_card_purchase:
    "Consumo con tarjeta de crédito. merchant = la 'Empresa'; payment_method_identifier = últimos 4 dígitos como '****XXXX'; payment_source_type = 'credit_card'.",
  debit_card_purchase:
    "Consumo con tarjeta de débito. merchant = la 'Empresa'; payment_method_identifier = últimos 4 dígitos como '****XXXX'; payment_source_type = 'debit_card'.",
  service_payment:
    "Pago de servicio. merchant = la empresa del servicio; document_number = Doc. pago. " +
    "La 'Cuenta de origen' indica el medio usado: clasifícalo en payment_source_type " +
    "('credit_card' si dice Tarjeta de crédito, 'debit_card' si Tarjeta de débito, " +
    "'account' si es una cuenta) y pon sus últimos 4 dígitos en payment_method_identifier como '****XXXX'.",
  yape:
    "Yapeo que realizaste. merchant = nombre del beneficiario. " +
    "payment_method_identifier = ÚNICAMENTE el celular que aparece como 'Tu número de celular' " +
    "(tu propio celular, enmascarado). NUNCA el celular del beneficiario/destinatario. " +
    "Si no aparece 'Tu número de celular', déjalo vacío. payment_source_type = 'yape'.",
  transfer:
    "Transferencia a terceros. merchant = nombre del beneficiario; payment_method_identifier = cuenta de origen (****XXXX) si aparece; payment_source_type = 'account' si es cuenta.",
};

const GUIDE =
  "Eres un extractor de datos de correos de notificación bancaria del Perú (BCP/Yape). " +
  "Devuelve solo los campos pedidos. Usa cadena vacía si un dato no aparece. " +
  "currency debe ser 'PEN' (S/) o 'USD' ($).";

/** Extrae los datos del gasto desde el texto del correo. Devuelve null si falla. */
export async function extractExpense(
  text: string,
  notificationType: NotificationType,
): Promise<ParsedExpense | null> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: `${GUIDE}\n\nTipo de notificación: ${notificationType}\n${TYPE_HINTS[notificationType]}\n\nCorreo:\n"""\n${text}\n"""`,
      },
    ],
  });

  if (response.stop_reason === "refusal") return null;

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    const parsed = JSON.parse(textBlock.text) as ParsedExpense;
    if (!Number.isFinite(parsed.amount) || parsed.amount <= 0) return null;
    // Normalizamos a un código ISO válido: si no es USD, asumimos PEN. Evita que
    // un valor raro (ej. "Soles") rompa Intl.NumberFormat al formatear.
    parsed.currency = parsed.currency?.toUpperCase() === "USD" ? "USD" : "PEN";
    return parsed;
  } catch {
    return null;
  }
}

// ── Modo descubrimiento: audita correos que los filtros estrictos NO capturan ──

export type DiscoveryVerdict = {
  is_expense: boolean;
  confidence: string;
  suggested_type: string;
  suggested_subject: string;
  reason: string;
};

const DISCOVERY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    is_expense: {
      type: "boolean",
      description:
        "true si el correo representa un GASTO/transacción personal donde el dinero SALE (consumo, pago de servicio, transferencia o yapeo enviado).",
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    suggested_type: {
      type: "string",
      description:
        "Si is_expense: 'credit_card_purchase' | 'debit_card_purchase' | 'service_payment' | 'yape' | 'transfer' | 'other'. '' si no es gasto.",
    },
    suggested_subject: {
      type: "string",
      description: "Frase clave del asunto que identificaría este correo, o '' si no es gasto.",
    },
    reason: { type: "string", description: "Motivo breve del veredicto." },
  },
  required: ["is_expense", "confidence", "suggested_type", "suggested_subject", "reason"],
} as const;

const DISCOVERY_GUIDE =
  "Auditas correos bancarios del Perú (BCP/Yape) para detectar GASTOS que un filtro por " +
  "asunto podría estar perdiendo. Es gasto si el dinero SALE del usuario: consumo con tarjeta, " +
  "pago de servicio, transferencia o yapeo ENVIADO. NO son gasto: promociones, estados de cuenta, " +
  "avisos de seguridad/login, abonos o transferencias RECIBIDAS, OTP. Si es gasto, sugiere el tipo " +
  "y una frase clave del asunto que lo identifique.";

/** Juzga un correo del banco no capturado por los filtros. Devuelve null si falla. */
export async function classifyDiscovery(
  text: string,
  subject: string,
  sender: string,
): Promise<DiscoveryVerdict | null> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    output_config: { format: { type: "json_schema", schema: DISCOVERY_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `${DISCOVERY_GUIDE}\n\nRemitente: ${sender}\nAsunto: ${subject}\n\nCorreo:\n"""\n${text}\n"""`,
      },
    ],
  });

  if (response.stop_reason === "refusal") return null;
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    return JSON.parse(textBlock.text) as DiscoveryVerdict;
  } catch {
    return null;
  }
}
