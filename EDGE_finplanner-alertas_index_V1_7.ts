import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
  console.error("Variáveis padrão do Supabase não encontradas.");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function currentUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Usuário não autenticado.");
  return data.user;
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("ALERT_EMAIL_FROM");

  if (!key || !from) {
    throw new Error(
      "E-mail ainda não configurado. Cadastre RESEND_API_KEY e ALERT_EMAIL_FROM em Edge Functions > Secrets."
    );
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`Resend retornou ${r.status}: ${text}`);
  return text;
}

async function sendWhatsApp(
  to: string,
  values: { descricao: string; valor: string; vencimento: string },
) {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const version = Deno.env.get("WHATSAPP_GRAPH_VERSION");
  const template = Deno.env.get("WHATSAPP_TEMPLATE_NAME");
  const language = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "pt_BR";

  if (!token || !phoneId || !version || !template) {
    throw new Error(
      "WhatsApp ainda não configurado. Configure token, Phone Number ID, versão e template nos Secrets."
    );
  }

  const r = await fetch(
    `https://graph.facebook.com/${version}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: language },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: values.descricao },
              { type: "text", text: values.valor },
              { type: "text", text: values.vencimento },
            ],
          }],
        },
      }),
    },
  );

  const text = await r.text();
  if (!r.ok) throw new Error(`WhatsApp retornou ${r.status}: ${text}`);
  return text;
}

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function dateBR(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function withinWindow(pref: any, now: Date) {
  if (pref.inicio_disparos && now < new Date(pref.inicio_disparos)) return false;
  if (pref.fim_disparos && now > new Date(pref.fim_disparos)) return false;
  return true;
}

Deno.serve(async (req) => {
  // Obrigatório para chamadas feitas pelo navegador.
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Método não permitido." }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Teste de disponibilidade. Exige login válido.
    if (body.mode === "health") {
      const user = await currentUser(req);
      return response({
        ok: true,
        service: "finplanner-alertas",
        version: "1.7",
        user_id: user.id,
      });
    }

    // Teste manual dos canais
    if (body.mode === "test") {
      const user = await currentUser(req);

      const { data: pref, error: prefError } = await admin
        .from("preferencias_alerta")
        .select("*")
        .eq("usuario_id", user.id)
        .maybeSingle();

      if (prefError) throw prefError;
      if (!pref) {
        throw new Error(
          "Preferências não encontradas. Clique em Salvar alertas antes do teste."
        );
      }

      if (body.channel === "email") {
        if (!pref.email_destino) throw new Error("E-mail de destino não informado.");

        await sendEmail(
          pref.email_destino,
          "FinPlanner - Teste de alerta",
          "<h2>FinPlanner</h2><p>Seu canal de alerta por e-mail foi configurado corretamente.</p>",
        );

        return response({ ok: true, channel: "email" });
      }

      if (body.channel === "whatsapp") {
        if (!pref.whatsapp_numero) throw new Error("WhatsApp de destino não informado.");

        const today = new Date().toISOString().slice(0, 10);

        await sendWhatsApp(pref.whatsapp_numero, {
          descricao: "Teste de alerta FinPlanner",
          valor: "R$ 100,00",
          vencimento: dateBR(today),
        });

        return response({ ok: true, channel: "whatsapp" });
      }

      return response({ error: "Canal de teste inválido." }, 400);
    }

    // Disparo automático pelo Cron
    if (body.mode === "scheduled") {
      const cronSecret = Deno.env.get("CRON_SECRET");

      if (!cronSecret || req.headers.get("X-Cron-Secret") !== cronSecret) {
        return response({ error: "Cron não autorizado." }, 401);
      }

      const now = new Date();
      const todayISO = now.toISOString().slice(0, 10);

      const { data: prefs, error: prefsError } = await admin
        .from("preferencias_alerta")
        .select("*");

      if (prefsError) throw prefsError;

      let sent = 0;

      for (const pref of prefs || []) {
        if (!withinWindow(pref, now)) continue;

        const days: number[] = pref.dias_antes || [5, 2, 0];
        const maxDays = Math.max(...days);

        const end = new Date(now);
        end.setUTCDate(end.getUTCDate() + maxDays);
        const endISO = end.toISOString().slice(0, 10);

        // IMPORTANTE: filtra pelo usuário da preferência.
        const { data: launches, error: launchError } = await admin
          .from("lancamentos")
          .select("id,usuario_id,descricao,valor_original,data_vencimento,status,tipo")
          .eq("usuario_id", pref.usuario_id)
          .eq("tipo", "D")
          .eq("status", "PENDENTE")
          .gte("data_vencimento", todayISO)
          .lte("data_vencimento", endISO);

        if (launchError) throw launchError;

        for (const item of launches || []) {
          const due = new Date(item.data_vencimento + "T12:00:00Z");
          const today = new Date(todayISO + "T12:00:00Z");
          const diff = Math.round((due.getTime() - today.getTime()) / 86400000);

          if (!days.includes(diff)) continue;

          const subject =
            `FinPlanner - ${item.descricao} ${
              diff === 0 ? "vence hoje" : `vence em ${diff} dia(s)`
            }`;

          const html =
            `<h2>FinPlanner</h2><p><strong>${item.descricao}</strong></p>` +
            `<p>Valor: ${brl(Number(item.valor_original))}<br>` +
            `Vencimento: ${dateBR(item.data_vencimento)}</p>`;

          if (pref.alerta_interno) {
            await admin.from("notificacoes").insert({
              usuario_id: pref.usuario_id,
              lancamento_id: item.id,
              tipo: "VENCIMENTO",
              titulo: subject,
              mensagem:
                `Valor ${brl(Number(item.valor_original))} - vencimento ${dateBR(item.data_vencimento)}`,
            });
          }

          if (pref.alerta_email && pref.email_destino) {
            try {
              await sendEmail(pref.email_destino, subject, html);
              sent++;
            } catch (e) {
              console.error("Falha e-mail:", e);
            }
          }

          if (pref.alerta_whatsapp && pref.whatsapp_numero) {
            try {
              await sendWhatsApp(pref.whatsapp_numero, {
                descricao: item.descricao,
                valor: brl(Number(item.valor_original)),
                vencimento: dateBR(item.data_vencimento),
              });
              sent++;
            } catch (e) {
              console.error("Falha WhatsApp:", e);
            }
          }
        }
      }

      return response({ ok: true, sent });
    }

    return response(
      { error: "Modo inválido. Use health, test ou scheduled." },
      400,
    );
  } catch (error) {
    console.error(error);
    return response({
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
