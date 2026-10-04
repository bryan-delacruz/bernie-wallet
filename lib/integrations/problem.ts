/** Errores de la API v1 como Problem Details (RFC 9457). */
export type ProblemCode =
  | "invalid_request"
  | "unauthorized"
  | "not_connected"
  | "cursor_reset"
  | "rate_limited"
  | "unavailable"
  | "internal";

const STATUS: Record<ProblemCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  not_connected: 403,
  cursor_reset: 409,
  rate_limited: 429,
  unavailable: 503,
  internal: 500,
};

const TITLE: Record<ProblemCode, string> = {
  invalid_request: "Invalid request",
  unauthorized: "Missing or invalid access token",
  not_connected: "This app is not connected to the user's account",
  cursor_reset: "Cursor is no longer valid; restart the sync without a cursor",
  rate_limited: "Too many requests",
  unavailable: "Temporarily unavailable; retry later",
  internal: "Internal error",
};

export function problem(
  code: ProblemCode,
  detail?: string,
  headers?: Record<string, string>,
): Response {
  const status = STATUS[code];
  const body = {
    type: `urn:bernie:problem:${code}`,
    title: TITLE[code],
    status,
    code,
    ...(detail ? { detail } : {}),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/problem+json",
      "Cache-Control": "no-store",
      // Un 401 debe decir cómo autenticarse (RFC 6750).
      ...(status === 401 ? { "WWW-Authenticate": 'Bearer realm="bernie"' } : {}),
      ...headers,
    },
  });
}
