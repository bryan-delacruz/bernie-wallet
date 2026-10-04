/**
 * Registra (o actualiza) una app conectada en integration_clients (SPEC §15.9).
 * Genera el secreto de webhook, lo guarda cifrado y lo imprime UNA vez para
 * configurarlo en la app cliente. Nunca se escribe a mano en SQL.
 *
 *   node --conditions=react-server --env-file=.env.local scripts/register-integration-client.ts \
 *     <client_id> "<nombre>" <webhook_url> [--rotate]
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY e INTEGRATION_SECRET_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "../lib/crypto.ts";
import { generateWebhookSecret } from "../lib/integrations/webhook-signature.ts";

const [clientId, name, webhookUrl] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const rotate = process.argv.includes("--rotate");

if (!clientId || !name || !webhookUrl) {
  console.error('Uso: register-integration-client.ts <client_id> "<nombre>" <webhook_url> [--rotate]');
  process.exit(1);
}
const url = new URL(webhookUrl);
if (url.protocol !== "https:" && url.hostname !== "localhost") {
  console.error("El webhook debe ser https (o http://localhost en desarrollo).");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

const { data: existing, error: readError } = await supabase
  .from("integration_clients")
  .select("client_id")
  .eq("client_id", clientId)
  .maybeSingle();
if (readError) throw readError;

const secret = !existing || rotate ? generateWebhookSecret() : null;
const row = {
  client_id: clientId,
  name,
  webhook_url: webhookUrl,
  active: true,
  ...(secret ? { webhook_secret: encrypt(secret, "INTEGRATION_SECRET_KEY") } : {}),
};
const { error } = await supabase.from("integration_clients").upsert(row, { onConflict: "client_id" });
if (error) throw error;

console.log(`✓ ${name} (${clientId}) ${existing ? "actualizado" : "registrado"} → ${webhookUrl}`);
if (secret) {
  console.log("\nSecreto de webhook (cópialo ahora; no se vuelve a mostrar):\n");
  console.log(`  ${secret}\n`);
  console.log("Configúralo en la app cliente (Casorio: BERNIE_WEBHOOK_SECRET).");
} else {
  console.log("Secreto sin cambios (usa --rotate para generar uno nuevo).");
}
