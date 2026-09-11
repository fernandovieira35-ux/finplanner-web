import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(url, serviceRole);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authErr } = await client.auth.getUser();
  if (authErr || !authData.user) throw new Error("Não autenticado");

  const { data: perfil, error: perfilErr } = await admin
    .from("perfis")
    .select("id,administrador,ativo")
    .eq("id", authData.user.id)
    .single();

  if (perfilErr || !perfil?.ativo) throw new Error("Usuário inativo");
  if (!perfil.administrador) throw new Error("Acesso restrito a administradores");

  return authData.user;
}

async function grupoDoProprietario(userId: string) {
  const { data, error } = await admin
    .from("grupos_financeiros")
    .select("id")
    .eq("proprietario_id", userId)
    .order("criado_em")
    .limit(1)
    .single();

  if (error) throw error;
  return data.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const logged = await requireAdmin(req);
    const body = await req.json();
    const action = body.action;
    const grupoId = await grupoDoProprietario(logged.id);

    if (action === "create") {
      const { data, error } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { nome: body.nome },
      });
      if (error) throw error;

      await admin.from("perfis").update({
        nome: body.nome,
        email: body.email,
        administrador: !!body.administrador,
        ativo: body.ativo !== false,
        atualizado_em: new Date().toISOString(),
      }).eq("id", data.user.id);

      if (body.compartilhar_financeiro === true) {
        const { error: membroErr } = await admin.from("grupo_membros").upsert({
          grupo_id: grupoId,
          usuario_id: data.user.id,
          papel: body.administrador ? "ADMIN" : "MEMBRO",
          pode_visualizar: body.pode_visualizar !== false,
          pode_editar: body.pode_editar === true,
          pode_excluir: body.pode_excluir === true,
        }, { onConflict: "grupo_id,usuario_id" });
        if (membroErr) throw membroErr;
      }

      return json({ ok: true, id: data.user.id });
    }

    if (action === "list") {
      const { data: perfis, error } = await admin
        .from("perfis")
        .select("id,nome,email,administrador,ativo,criado_em")
        .order("nome");
      if (error) throw error;

      const { data: membros, error: membrosErr } = await admin
        .from("grupo_membros")
        .select("usuario_id,pode_visualizar,pode_editar,pode_excluir")
        .eq("grupo_id", grupoId);
      if (membrosErr) throw membrosErr;

      const mapa = new Map((membros || []).map((m: any) => [m.usuario_id, m]));
      const users = (perfis || []).map((p: any) => {
        const m: any = mapa.get(p.id);
        return {
          ...p,
          compartilhado: !!m,
          pode_visualizar: !!m?.pode_visualizar,
          pode_editar: !!m?.pode_editar,
          pode_excluir: !!m?.pode_excluir,
        };
      });

      return json({ users });
    }

    if (action === "update") {
      if (body.id === logged.id && body.ativo === false) {
        throw new Error("Você não pode desativar o próprio usuário.");
      }

      const { error: perfilErr } = await admin.from("perfis").update({
        nome: body.nome,
        administrador: !!body.administrador,
        ativo: body.ativo !== false,
        atualizado_em: new Date().toISOString(),
      }).eq("id", body.id);
      if (perfilErr) throw perfilErr;

      if (body.compartilhar_financeiro === true) {
        const { error: membroErr } = await admin.from("grupo_membros").upsert({
          grupo_id: grupoId,
          usuario_id: body.id,
          papel: body.administrador ? "ADMIN" : "MEMBRO",
          pode_visualizar: body.pode_visualizar === true,
          pode_editar: body.pode_editar === true,
          pode_excluir: body.pode_excluir === true,
        }, { onConflict: "grupo_id,usuario_id" });
        if (membroErr) throw membroErr;
      } else {
        const { error: delErr } = await admin
          .from("grupo_membros")
          .delete()
          .eq("grupo_id", grupoId)
          .eq("usuario_id", body.id);
        if (delErr) throw delErr;
      }

      return json({ ok: true });
    }

    if (action === "set_active") {
      if (body.id === logged.id && body.ativo === false) {
        throw new Error("Você não pode desativar o próprio usuário.");
      }

      const { error } = await admin.from("perfis").update({
        ativo: !!body.ativo,
        atualizado_em: new Date().toISOString(),
      }).eq("id", body.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      if (body.id === logged.id) throw new Error("Você não pode excluir o próprio usuário.");
      const { error } = await admin.auth.admin.deleteUser(body.id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
