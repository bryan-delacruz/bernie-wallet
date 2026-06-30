"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const GMAIL_SCOPES =
  "email profile https://www.googleapis.com/auth/gmail.readonly";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: GMAIL_SCOPES,
        // access_type=offline + prompt=consent fuerzan que Google entregue el
        // refresh_token (necesario para sincronizar Gmail en sesiones futuras).
        queryParams: { access_type: "offline", prompt: "consent" },
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={signIn}
      disabled={loading}
      size="lg"
      className="h-11 px-6 text-base"
    >
      {loading ? "Conectando…" : "Iniciar sesión con Google"}
    </Button>
  );
}
