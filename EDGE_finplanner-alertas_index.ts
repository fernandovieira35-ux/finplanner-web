import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {
  status,
  headers: {...corsHeaders,"Content-Type":"application/json"}
});

async function sendEmail(to:string, subject:string, html:string){
  const key=Deno.env.get("RESEND_API_KEY");
  const from=Deno.env.get("ALERT_EMAIL_FROM");
  if(!key||!from) throw new Error("E-mail não configurado: informe RESEND_API_KEY e ALERT_EMAIL_FROM nos Secrets.");
  const r=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({from,to:[to],subject,html})
  });
  const t=await r.text();
  if(!r.ok) throw new Error(`Resend: ${t}`);
  return t;
}

async function sendWhatsApp(to:string, vars:{descricao:string,valor:string,vencimento:string}){
  const token=Deno.env.get("WHATSAPP_TOKEN");
  const phoneId=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const version=Deno.env.get("WHATSAPP_GRAPH_VERSION");
  const template=Deno.env.get("WHATSAPP_TEMPLATE_NAME");
  const lang=Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE")||"pt_BR";

  if(!token||!phoneId||!version||!template){
    throw new Error("WhatsApp não configurado: revise os Secrets e o template aprovado.");
  }

  const r=await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`,{
    method:"POST",
    headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      messaging_product:"whatsapp",
      to,
      type:"template",
      template:{
        name:template,
        language:{code:lang},
        components:[{
          type:"body",
          parameters:[
            {type:"text",text:vars.descricao},
            {type:"text",text:vars.valor},
            {type:"text",text:vars.vencimento}
          ]
        }]
      }
    })
  });
  const t=await r.text();
  if(!r.ok) throw new Error(`WhatsApp: ${t}`);
  return t;
}

const brl=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const dateBR=(v:string)=>{const[y,m,d]=v.split("-");return `${d}/${m}/${y}`};

function dentroDaJanela(pref:any, agora:Date){
  if(pref.inicio_disparos && agora < new Date(pref.inicio_disparos)) return false;
  if(pref.fim_disparos && agora > new Date(pref.fim_disparos)) return false;
  return true;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  try{
    const body=await req.json().catch(()=>({}));

    if(body.mode==="test"){
      const auth=req.headers.get("Authorization")||"";
      const client=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:auth}}});
      const {data:userData,error:userErr}=await client.auth.getUser();
      if(userErr||!userData.user) return json({error:"Não autenticado"},401);

      const uid=userData.user.id;
      const {data:pref,error:prefErr}=await admin.from("preferencias_alerta").select("*").eq("usuario_id",uid).maybeSingle();
      if(prefErr) throw prefErr;
      if(!pref) throw new Error("Preferências de alerta não configuradas.");

      if(body.channel==="email"){
        if(!pref.email_destino) throw new Error("E-mail de destino não informado.");
        await sendEmail(pref.email_destino,"FinPlanner - Teste de alerta",
          "<h2>FinPlanner</h2><p>Seu alerta por e-mail está funcionando.</p>");
        return json({ok:true,channel:"email"});
      }

      if(body.channel==="whatsapp"){
        if(!pref.whatsapp_numero) throw new Error("WhatsApp de destino não informado.");
        const hoje=new Date().toISOString().slice(0,10);
        await sendWhatsApp(pref.whatsapp_numero,{
          descricao:"Teste FinPlanner",
          valor:"R$ 100,00",
          vencimento:dateBR(hoje)
        });
        return json({ok:true,channel:"whatsapp"});
      }

      return json({error:"Canal inválido"},400);
    }

    const secret=Deno.env.get("CRON_SECRET");
    if(!secret||req.headers.get("X-Cron-Secret")!==secret) return json({error:"Não autorizado"},401);

    const agora=new Date();
    const hojeISO=agora.toISOString().slice(0,10);
    const {data:prefs,error:prefsErr}=await admin.from("preferencias_alerta").select("*");
    if(prefsErr) throw prefsErr;

    let enviados=0;

    for(const pref of prefs||[]){
      if(!dentroDaJanela(pref,agora)) continue;

      const dias:number[]=pref.dias_antes||[5,2,0];
      const maxDias=Math.max(...dias);
      const fimBusca=new Date(agora);
      fimBusca.setUTCDate(fimBusca.getUTCDate()+maxDias);
      const fimISO=fimBusca.toISOString().slice(0,10);

      const {data:lancs,error:lancErr}=await admin.from("lancamentos")
        .select("id,descricao,valor_original,data_vencimento,status,tipo")
        .eq("tipo","D").eq("status","PENDENTE")
        .gte("data_vencimento",hojeISO).lte("data_vencimento",fimISO);
      if(lancErr) throw lancErr;

      for(const l of lancs||[]){
        const venc=new Date(l.data_vencimento+"T12:00:00Z");
        const hoje=new Date(hojeISO+"T12:00:00Z");
        const diff=Math.round((venc.getTime()-hoje.getTime())/86400000);
        if(!dias.includes(diff)) continue;

        const subject=`FinPlanner - ${l.descricao} ${diff===0?"vence hoje":`vence em ${diff} dia(s)`}`;
        const html=`<h2>FinPlanner</h2><p><strong>${l.descricao}</strong></p><p>Valor: ${brl(Number(l.valor_original))}<br>Vencimento: ${dateBR(l.data_vencimento)}</p>`;

        if(pref.alerta_email&&pref.email_destino){
          try{await sendEmail(pref.email_destino,subject,html);enviados++}catch(e){console.error(e)}
        }
        if(pref.alerta_whatsapp&&pref.whatsapp_numero){
          try{await sendWhatsApp(pref.whatsapp_numero,{descricao:l.descricao,valor:brl(Number(l.valor_original)),vencimento:dateBR(l.data_vencimento)});enviados++}catch(e){console.error(e)}
        }
      }
    }

    return json({ok:true,enviados});
  }catch(e){
    return json({error:e instanceof Error?e.message:String(e)},500);
  }
});
