// Parser programático de correos de notificación bancaria del Perú (BCP/Yape).
// Las notificaciones son plantillas generadas por máquina: estructura fija, así
// que extraemos los campos con regex sobre el texto normalizado. Sin IA: es
// gratis, instantáneo y determinístico. Si un correo no matchea (p. ej. BCP
// cambia la plantilla), el parser devuelve null y el sync lo manda a
// `sync_failures` para revisarlo, sin perder nada silenciosamente.

export type NotificationType =
  | "credit_card_purchase"
  | "debit_card_purchase"
  | "service_payment"
  | "yape"
  | "transfer";

export type ParsedExpense = {
  amount: number;
  currency: string; // "PEN" | "USD"
  merchant: string;
  payment_method_identifier: string;
  payment_source_type: string; // credit_card | debit_card | account | yape | ""
  operation_number: string;
  document_number: string;
};

// Símbolo de moneda + monto. El grupo del monto empieza y termina en dígito, para
// no arrastrar puntuación que siga al número (p. ej. "S/ 23.50." → "23.50").
const MONEY = String.raw`(S\/|US\$|\$)\s*(\d+(?:[.,]\d+)*)`;

/**
 * Normaliza el cuerpo del correo: quita el zero-width space y los \r, une los
 * saltos de línea en espacios y colapsa espacios repetidos. Conserva los '*'
 * porque forman parte de valores (comercios como "PYU*The Coffee") y de los
 * marcadores de énfasis que usa el banco.
 */
function normalize(text: string): string {
  return text
    .replace(/\u200b/g, "")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Convierte el monto a número. Perú usa coma de miles y punto decimal
 * ("1,234.56"), pero no asumimos el formato: si aparecen ambos separadores, el
 * ÚLTIMO es el decimal. Con solo comas, son decimales si las siguen exactamente
 * dos dígitos ("1,50"); si no, son de miles ("1,234"). Evita inflar el monto 100x.
 */
function parseAmount(raw: string): number {
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    return lastComma > lastDot
      ? Number(raw.replace(/\./g, "").replace(",", "."))
      : Number(raw.replace(/,/g, ""));
  }
  if (lastComma > -1) {
    return /,\d{2}$/.test(raw)
      ? Number(raw.replace(",", "."))
      : Number(raw.replace(/,/g, ""));
  }
  return Number(raw);
}

/** Últimos 4 dígitos de un segmento con máscara (ignora '*', espacios y BIN). */
function last4(segment: string): string {
  const digits = segment.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

/** Moneda a partir del símbolo capturado: S/ → PEN; US$ o $ → USD. */
function toCurrency(symbol: string): string {
  return symbol.includes("S/") ? "PEN" : "USD";
}

/** Consumo con tarjeta de crédito/débito (misma plantilla, distinto rótulo). */
function parseCardPurchase(
  text: string,
  tipo: "credit_card" | "debit_card",
): ParsedExpense | null {
  const label = tipo === "credit_card" ? "Crédito" : "Débito";

  const amountMatch =
    text.match(new RegExp(`Monto Total del consumo\\s+${MONEY}`, "i")) ??
    text.match(new RegExp(`consumo de\\s+${MONEY}`, "i"));
  if (!amountMatch) return null;
  const amount = parseAmount(amountMatch[2]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const merchant =
    text.match(/Empresa\s+([\s\S]+?)\s+Número de operación/i)?.[1]?.trim() ?? "";
  // Sin comercio el gasto queda degradado: es deriva de plantilla, no un gasto
  // válido. Devolvemos null para que el sync lo mande a sync_failures.
  if (!merchant) return null;
  const cardSeg =
    text.match(
      new RegExp(`Número de Tarjeta de ${label}\\s+([\\*\\s\\d]+?)\\s+Empresa`, "i"),
    )?.[1] ?? "";
  const identifier = last4(cardSeg);
  const operation = text.match(/Número de operación\s+(\d+)/i)?.[1] ?? "";

  return {
    amount,
    currency: toCurrency(amountMatch[1]),
    merchant,
    payment_method_identifier: identifier ? `****${identifier}` : "",
    payment_source_type: tipo,
    operation_number: operation,
    document_number: "",
  };
}

/** Pago de servicio (Banca Móvil): el medio de origen lo indica el propio correo. */
function parseServicePayment(text: string): ParsedExpense | null {
  const amountMatch = text.match(new RegExp(`Monto total:\\s*\\*?\\s*${MONEY}`, "i"));
  if (!amountMatch) return null;
  const amount = parseAmount(amountMatch[2]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const merchant = text.match(/Empresa:\s*\*([^*]+?)\*/i)?.[1]?.trim() ?? "";
  if (!merchant) return null;
  const operation = text.match(/Número de operación:\s*\*?\s*(\d+)/i)?.[1] ?? "";
  const document = text.match(/Doc\.\s*pago:\s*\*([^*]+?)\*/i)?.[1]?.trim() ?? "";

  // "Cuenta de origen: *<medio> **** 1234 <nombre>*" hasta "Vigencia:".
  const originSeg =
    text.match(/Cuenta de origen:\s*\*?([\s\S]*?)\s*Vigencia:/i)?.[1] ?? "";
  let source = "account";
  if (/tarjeta de cr[eé]dito/i.test(originSeg)) source = "credit_card";
  else if (/tarjeta de d[eé]bito/i.test(originSeg)) source = "debit_card";
  const identifier = last4(originSeg);

  return {
    amount,
    currency: toCurrency(amountMatch[1]),
    merchant,
    payment_method_identifier: identifier ? `****${identifier}` : "",
    payment_source_type: source,
    operation_number: operation,
    document_number: document,
  };
}

/** Yapeo enviado. Ojo: el medio es "Tu número de celular", NO el del beneficiario. */
function parseYape(text: string): ParsedExpense | null {
  const amountMatch = text.match(new RegExp(`Monto de yapeo[\\s*]*${MONEY}`, "i"));
  if (!amountMatch) return null;
  const amount = parseAmount(amountMatch[2]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const merchant =
    text
      .match(/Nombre del Beneficiario\s+([\s\S]+?)\s+N[ºo°]\s*de operaci[óo]n/i)?.[1]
      ?.replace(/\*+$/, "")
      .trim() ?? "";
  if (!merchant) return null;
  // El celular sí puede faltar legítimamente (SPEC §10.1): queda vacío, no anula.
  const phone = text.match(/Tu número de celular\s+(\S+)/i)?.[1] ?? "";
  const operation = text.match(/N[ºo°]\s*de operaci[óo]n\s+(\d+)/i)?.[1] ?? "";

  const phoneDigits = phone.replace(/\D/g, "");
  const identifier = phoneDigits ? `***${phoneDigits.slice(-3)}` : "";

  return {
    amount,
    currency: toCurrency(amountMatch[1]),
    merchant,
    payment_method_identifier: identifier,
    payment_source_type: "yape",
    operation_number: operation,
    document_number: "",
  };
}

/** Transferencia a terceros BCP: sale de una cuenta (sin tarjeta). */
function parseTransfer(text: string): ParsedExpense | null {
  const amountMatch =
    text.match(new RegExp(`Monto transferido\\s*\\*?\\s*${MONEY}`, "i")) ??
    text.match(new RegExp(`transferencia de\\s*\\*?\\s*${MONEY}`, "i"));
  if (!amountMatch) return null;
  const amount = parseAmount(amountMatch[2]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const merchant = text.match(/Enviado a\s*\*([^*]+?)\*/i)?.[1]?.trim() ?? "";
  if (!merchant) return null;
  const operation = text.match(/Número de operación\s*\*?\s*(\d+)/i)?.[1] ?? "";
  // "Desde *<cuenta>* **** 1234" → los últimos 4 de la cuenta de origen.
  const originSeg = text.match(/Desde\s*\*[^*]+\*\s*([\*\s\d]+)/i)?.[1] ?? "";
  const identifier = last4(originSeg);

  return {
    amount,
    currency: toCurrency(amountMatch[1]),
    merchant,
    payment_method_identifier: identifier ? `****${identifier}` : "",
    payment_source_type: "account",
    operation_number: operation,
    document_number: "",
  };
}

/**
 * Extrae los datos del gasto desde el texto del correo según su tipo. Es puro y
 * determinístico (sin red, sin IA). Devuelve null si el correo no matchea la
 * plantilla esperada → el sync lo trata como no parseable.
 */
export function extractExpense(
  text: string,
  notificationType: NotificationType,
): ParsedExpense | null {
  const t = normalize(text);
  switch (notificationType) {
    case "credit_card_purchase":
      return parseCardPurchase(t, "credit_card");
    case "debit_card_purchase":
      return parseCardPurchase(t, "debit_card");
    case "service_payment":
      return parseServicePayment(t);
    case "yape":
      return parseYape(t);
    case "transfer":
      return parseTransfer(t);
    default:
      return null;
  }
}
