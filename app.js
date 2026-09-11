
const CFG=window.FINPLANNER_CONFIG;
const tok=()=>localStorage.getItem('fp_token')||'';
const uid=()=>localStorage.getItem('fp_uid')||'';
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const msg=(id,t,c='')=>{let e=document.getElementById(id);e.textContent=t;e.className='message '+c};
const hide=id=>document.getElementById(id).classList.add('hidden');

async function api(path,opt={}){
 const h=Object.assign({'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},opt.headers||{});
 if(tok())h.Authorization='Bearer '+tok();
 const r=await fetch(CFG.SUPABASE_URL+path,{...opt,headers:h});
 const tx=await r.text();let d=null;try{d=tx?JSON.parse(tx):null}catch{d=tx}
 if(!r.ok)throw new Error(d?.message||d?.msg||d?.error_description||d?.error||'Erro Supabase');
 return d;
}

async function entrar(){
 hide('loginMessage');let em=email.value.trim(),pw=senha.value;if(!em||!pw){msg('loginMessage','Informe e-mail e senha.','error');return}
 btnEntrar.disabled=true;
 try{
  const d=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:em,password:pw})});
  localStorage.setItem('fp_token',d.access_token);localStorage.setItem('fp_uid',d.user.id);
  await abrirApp();
 }catch(e){msg('loginMessage',e.message,'error')}finally{btnEntrar.disabled=false}
}



function abrirCadastroUsuario(){
  if(localStorage.getItem('fp_admin')!=='1'){
    alert('Apenas administradores podem criar usuários.');
    return;
  }
  cadUserTitulo.textContent='Novo usuário';
  cadNome.value='';
  cadEmail.value='';
  cadSenha.value='';
  cadSenha2.value='';
  cadAdministrador.checked=false;
  cadAtivo.checked=true;
  cadCompartilharFinanceiro.checked=true;
  cadPodeVisualizar.checked=true;
  cadPodeEditar.checked=true;
  cadPodeExcluir.checked=false;
  hide('cadUserMsg');
  modalCadastroUsuario.classList.remove('hidden');
}

async function criarUsuario(){
  hide('cadUserMsg');

  if(localStorage.getItem('fp_admin')!=='1'){
    msg('cadUserMsg','Apenas administradores podem criar usuários.','error');
    return;
  }

  const nome=cadNome.value.trim();
  const em=cadEmail.value.trim();
  const pw=cadSenha.value;
  const pw2=cadSenha2.value;

  if(!nome||!em||!pw||!pw2){
    msg('cadUserMsg','Preencha nome, e-mail e senha.','error');return;
  }
  if(pw.length<8){
    msg('cadUserMsg','A senha deve possuir pelo menos 8 caracteres.','error');return;
  }
  if(pw!==pw2){
    msg('cadUserMsg','As senhas não conferem.','error');return;
  }

  try{
    const r=await fetch(CFG.SUPABASE_URL+'/functions/v1/finplanner-admin-users',{
      method:'POST',
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+tok(),
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        action:'create',
        nome,
        email:em,
        password:pw,
        administrador:cadAdministrador.checked,
        ativo:cadAtivo.checked,
        compartilhar_financeiro:cadCompartilharFinanceiro.checked,
        pode_visualizar:cadPodeVisualizar.checked,
        pode_editar:cadPodeEditar.checked,
        pode_excluir:cadPodeExcluir.checked
      })
    });

    const t=await r.text();
    let d={};
    try{d=JSON.parse(t)}catch{d={message:t}}
    if(!r.ok)throw new Error(d?.error||d?.message||'Erro ao criar usuário');

    msg('cadUserMsg','Usuário criado com sucesso.','success');
    await loadUsuarios();
    setTimeout(()=>modalCadastroUsuario.classList.add('hidden'),700);
  }catch(e){
    msg('cadUserMsg','Não foi possível criar o usuário: '+e.message,'error');
  }
}



function abrirResetFinanceiro(){
  if(localStorage.getItem('fp_admin')!=='1'){
    alert('Apenas administradores podem executar esta operação.');
    return;
  }
  resetConfirmacao.value='';
  hide('resetFinanceiroMsg');
  modalResetFinanceiro.classList.remove('hidden');
}

async function confirmarResetFinanceiro(){
  hide('resetFinanceiroMsg');

  if(localStorage.getItem('fp_admin')!=='1'){
    msg('resetFinanceiroMsg','Acesso restrito a administradores.','error');
    return;
  }

  if(resetConfirmacao.value.trim()!=='EXCLUIR FINANCEIRO'){
    msg('resetFinanceiroMsg','Digite exatamente EXCLUIR FINANCEIRO para confirmar.','error');
    return;
  }

  if(!confirm('Confirma a exclusão definitiva de todos os dados financeiros do grupo? Usuários e logins serão preservados.')){
    return;
  }

  try{
    const r=await fetch(CFG.SUPABASE_URL+'/functions/v1/finplanner-admin-users',{
      method:'POST',
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+tok(),
        'Content-Type':'application/json'
      },
      body:JSON.stringify({action:'reset_financial'})
    });

    const t=await r.text();
    let d={};
    try{d=JSON.parse(t)}catch{d={message:t}}
    if(!r.ok)throw new Error(d?.error||d?.message||'Erro ao excluir dados financeiros');

    msg('resetFinanceiroMsg','Informações financeiras excluídas. Usuários e acessos foram preservados.','success');

    setTimeout(async()=>{
      modalResetFinanceiro.classList.add('hidden');
      competencia.value=new Date().toISOString().slice(0,7);
      if(document.getElementById('competenciaPagas')) competenciaPagas.value=competencia.value;
      await atualizarTudo();
    },900);
  }catch(e){
    msg('resetFinanceiroMsg','Não foi possível excluir os dados: '+e.message,'error');
  }
}


async function loadUsuarios(){
  if(localStorage.getItem('fp_admin')!=='1'){
    usuariosMsg.textContent='Acesso restrito a administradores.';
    usuariosMsg.className='message error';
    listaUsuarios.innerHTML='';
    return;
  }

  try{
    const r=await fetch(CFG.SUPABASE_URL+'/functions/v1/finplanner-admin-users',{
      method:'POST',
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+tok(),
        'Content-Type':'application/json'
      },
      body:JSON.stringify({action:'list'})
    });

    const t=await r.text();
    let d={};
    try{d=JSON.parse(t)}catch{d={message:t}}
    if(!r.ok)throw new Error(d?.error||d?.message||'Erro ao listar usuários');

    const users=d.users||[];
    listaUsuarios.innerHTML=users.length?`
      <table class="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>E-mail</th>
            <th>Administrador</th>
            <th>Ativo</th>
            <th>Permissões</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u=>`
            <tr>
              <td>${esc(u.nome||'')}</td>
              <td>${esc(u.email||'')}</td>
              <td>${u.administrador?'Sim':'Não'}</td>
              <td>${u.ativo?'Sim':'Não'}</td>
              <td>
                ${u.compartilhado
                  ? `${u.pode_visualizar?'Visualizar':''}${u.pode_editar?' / Editar':''}${u.pode_excluir?' / Excluir':''}`
                  : 'Sem compartilhamento'}
              </td>
              <td>
                <div class="actions">
                  <button class="mini edit" onclick='abrirEditarUsuario(${JSON.stringify(u)})'>Editar</button>
                  <button class="mini edit" onclick='alterarStatusUsuario("${u.id}",${!u.ativo})'>${u.ativo?'Desativar':'Ativar'}</button>
                  <button class="mini delete" onclick='excluirUsuario("${u.id}","${String(u.nome||u.email).replace(/"/g,'&quot;')}")'>Excluir</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
      :'<p class="muted">Nenhum usuário encontrado.</p>';
  }catch(e){
    usuariosMsg.textContent='Erro ao carregar usuários: '+e.message;
    usuariosMsg.className='message error';
  }
}


function abrirEditarUsuario(u){
  editUserId.value=u.id;
  editUserIdentificacao.textContent=u.email||'';
  editUserNome.value=u.nome||'';
  editUserAtivo.checked=!!u.ativo;
  editUserAdministrador.checked=!!u.administrador;
  editUserCompartilhar.checked=!!u.compartilhado;
  editUserPodeVisualizar.checked=!!u.pode_visualizar;
  editUserPodeEditar.checked=!!u.pode_editar;
  editUserPodeExcluir.checked=!!u.pode_excluir;
  hide('editUserMsg');
  modalEditarUsuario.classList.remove('hidden');
}

async function salvarEdicaoUsuario(){
  hide('editUserMsg');

  try{
    const r=await fetch(CFG.SUPABASE_URL+'/functions/v1/finplanner-admin-users',{
      method:'POST',
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+tok(),
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        action:'update',
        id:editUserId.value,
        nome:editUserNome.value.trim(),
        ativo:editUserAtivo.checked,
        administrador:editUserAdministrador.checked,
        compartilhar_financeiro:editUserCompartilhar.checked,
        pode_visualizar:editUserPodeVisualizar.checked,
        pode_editar:editUserPodeEditar.checked,
        pode_excluir:editUserPodeExcluir.checked
      })
    });

    const t=await r.text();
    let d={};
    try{d=JSON.parse(t)}catch{d={message:t}}
    if(!r.ok)throw new Error(d?.error||d?.message||'Erro ao atualizar usuário');

    msg('editUserMsg','Permissões atualizadas com sucesso.','success');
    await loadUsuarios();
    setTimeout(()=>modalEditarUsuario.classList.add('hidden'),600);
  }catch(e){
    msg('editUserMsg','Não foi possível atualizar: '+e.message,'error');
  }
}

async function alterarStatusUsuario(id,ativo){
  try{
    const r=await fetch(CFG.SUPABASE_URL+'/functions/v1/finplanner-admin-users',{
      method:'POST',
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+tok(),
        'Content-Type':'application/json'
      },
      body:JSON.stringify({action:'set_active',id,ativo})
    });
    const t=await r.text();let d={};try{d=JSON.parse(t)}catch{d={message:t}}
    if(!r.ok)throw new Error(d?.error||d?.message||'Erro');
    await loadUsuarios();
  }catch(e){alert('Erro ao alterar usuário: '+e.message)}
}

async function excluirUsuario(id,nome){
  if(id===uid()){
    alert('O usuário logado não pode excluir a própria conta por esta tela.');
    return;
  }
  if(!confirm(`Deseja excluir o usuário "${nome}"?\n\nEsta ação remove o acesso ao FinPlanner.`))return;

  try{
    const r=await fetch(CFG.SUPABASE_URL+'/functions/v1/finplanner-admin-users',{
      method:'POST',
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+tok(),
        'Content-Type':'application/json'
      },
      body:JSON.stringify({action:'delete',id})
    });
    const t=await r.text();let d={};try{d=JSON.parse(t)}catch{d={message:t}}
    if(!r.ok)throw new Error(d?.error||d?.message||'Erro');
    await loadUsuarios();
  }catch(e){alert('Erro ao excluir usuário: '+e.message)}
}

function abrirRecuperacaoSenha(){
  recoverEmail.value=email.value.trim()||'';
  hide('recoverMsg');
  modalRecuperarSenha.classList.remove('hidden');
}

async function enviarRecuperacaoSenha(){
  hide('recoverMsg');
  const em=recoverEmail.value.trim();
  if(!em){msg('recoverMsg','Informe o e-mail.','error');return;}
  try{
    await api('/auth/v1/recover',{
      method:'POST',
      body:JSON.stringify({email:em,redirect_to:location.origin+location.pathname})
    });
    msg('recoverMsg','Solicitação enviada. Verifique seu e-mail.','success');
  }catch(e){msg('recoverMsg','Erro ao solicitar recuperação: '+e.message,'error')}
}

function verificarFluxoRecuperacao(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  if(hash.get('type')==='recovery' && hash.get('access_token')){
    localStorage.setItem('fp_recovery_token',hash.get('access_token'));
    modalNovaSenha.classList.remove('hidden');
  }
}

async function salvarNovaSenha(){
  hide('newPasswordMsg');
  const p=novaSenha.value,p2=novaSenha2.value;
  if(p.length<8){msg('newPasswordMsg','A senha deve possuir pelo menos 8 caracteres.','error');return;}
  if(p!==p2){msg('newPasswordMsg','As senhas não conferem.','error');return;}

  const recovery=localStorage.getItem('fp_recovery_token');
  if(!recovery){msg('newPasswordMsg','Token de recuperação não encontrado.','error');return;}

  try{
    const r=await fetch(CFG.SUPABASE_URL+'/auth/v1/user',{
      method:'PUT',
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+recovery,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({password:p})
    });
    const t=await r.text();let d={};try{d=JSON.parse(t)}catch{}
    if(!r.ok)throw new Error(d?.message||d?.error||'Erro ao atualizar senha');
    localStorage.removeItem('fp_recovery_token');
    history.replaceState(null,'',location.pathname);
    msg('newPasswordMsg','Senha alterada com sucesso. Você já pode entrar.','success');
    setTimeout(()=>modalNovaSenha.classList.add('hidden'),900);
  }catch(e){msg('newPasswordMsg',e.message,'error')}
}

async function carregarGrupoAtual(){
  try{
    const d=await api('/rest/v1/grupo_membros?select=grupo_id,pode_editar,pode_excluir&usuario_id=eq.'+uid()+'&limit=1');
    if(d?.length){
      localStorage.setItem('fp_grupo_id',d[0].grupo_id);
      localStorage.setItem('fp_grupo_editar',d[0].pode_editar?'1':'0');
      localStorage.setItem('fp_grupo_excluir',d[0].pode_excluir?'1':'0');
    }
  }catch(e){console.warn('Grupo financeiro não carregado:',e)}
}
const gid=()=>localStorage.getItem('fp_grupo_id')||'';

async function abrirApp(){
 loginView.classList.add('hidden');appView.classList.remove('hidden');
 let p=await api('/rest/v1/perfis?select=nome,email,administrador,ativo&limit=1'); if(p?.length){
    usuarioNome.textContent=p[0].nome||p[0].email;
    if(p[0].administrador===true){
      navUsuarios.classList.remove('hidden');
      if(document.getElementById('adminFinanceTools')) adminFinanceTools.classList.remove('hidden');
      localStorage.setItem('fp_admin','1');
    }else{
      navUsuarios.classList.add('hidden');
      if(document.getElementById('adminFinanceTools')) adminFinanceTools.classList.add('hidden');
      localStorage.setItem('fp_admin','0');
    }
  }
 let now=new Date();
 competencia.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 if(document.getElementById('competenciaPagas')) competenciaPagas.value=competencia.value;
 await carregarGrupoAtual();
 await atualizarTudo();
}
function sair(){localStorage.clear();location.reload()}
function toggleMenu(){sidebar.classList.toggle('open')}
function showView(v,b){document.querySelectorAll('.app-section').forEach(x=>x.classList.add('hidden'));document.getElementById('view-'+v).classList.remove('hidden');document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));b?.classList.add('active');sidebar.classList.remove('open');if(v==='recorrentes')loadRecorrentes();if(v==='receitas')loadReceitas();if(v==='lancamentos')loadLancamentos();if(v==='cartoes')loadCartoes();if(v==='contas')loadContas();if(v==='alertas')loadPreferenciasAlerta();if(v==='usuarios')loadUsuarios();if(v==='pagas')loadContasPagas();}
function compDate(){return competencia.value+'-01'}
function monthRange(){let [y,m]=competencia.value.split('-').map(Number);let n=new Date(y,m,1);return [competencia.value+'-01',`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`]}
async function trocarCompetencia(){
 if(document.getElementById('competenciaPagas')) competenciaPagas.value=competencia.value;
 await atualizarTudo();
}
async function atualizarTudo(){await Promise.all([loadDashboard(),loadLancamentos(),loadRecorrentes(),loadReceitas(),loadCartoes(),loadContas(),loadCompras(),verificarCicloMensal()])}

async function gerarCompetencia(){
 return iniciarNovoCiclo();
}

function addMonthsToCompetencia(comp, qtd){
 const [y,m]=comp.split('-').map(Number);
 const d=new Date(y,m-1+qtd,1);
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

async function verificarCicloMensal(){
 if(!competencia.value || !document.getElementById('statusCiclo'))return;
 try{
   const ini=compDate();
   const dados=await api(`/rest/v1/lancamentos?select=id&competencia=eq.${ini}&limit=1`);
   if(dados?.length){
     statusCiclo.textContent='Ciclo iniciado. As movimentações desta competência permanecem independentes dos outros meses.';
   }else{
     statusCiclo.textContent='Este mês ainda não possui lançamentos. Inicie o ciclo para carregar salários e contas recorrentes.';
   }
   const prox=addMonthsToCompetencia(competencia.value,1);
   const [py,pm]=prox.split('-');
   btnProximoCiclo.textContent=`Iniciar ${new Date(Number(py),Number(pm)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}`;
 }catch(e){
   statusCiclo.textContent='Não foi possível verificar o ciclo: '+e.message;
 }
}

async function iniciarNovoCiclo(compAlvo=null){
 const alvo=compAlvo || competencia.value;
 if(!alvo)return;

 try{
   const [y,m]=alvo.split('-').map(Number);
   const rotulo=new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
   const confirmar=confirm(`Iniciar o ciclo de ${rotulo}?\n\nSerão carregadas as rendas e contas recorrentes ativas. Lançamentos já existentes não serão duplicados.`);
   if(!confirmar)return;

   await api('/rest/v1/rpc/fn_iniciar_ciclo_mensal',{
     method:'POST',
     body:JSON.stringify({p_competencia:`${alvo}-01`})
   });

   competencia.value=alvo;
   if(document.getElementById('competenciaPagas')) competenciaPagas.value=alvo;
   msg('dashboardMessage',`Ciclo de ${rotulo} iniciado/atualizado com sucesso.`,'success');
   await atualizarTudo();
 }catch(e){
   msg('dashboardMessage','Erro ao iniciar ciclo mensal: '+e.message,'error');
 }
}

async function iniciarProximoCiclo(){
 const prox=addMonthsToCompetencia(competencia.value,1);
 await iniciarNovoCiclo(prox);
}

async function loadDashboard(){
 let [ini,fim]=monthRange();
 periodoTitulo.textContent=new Date(ini+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());

 const l=await api(`/rest/v1/lancamentos?select=*&competencia=eq.${ini}&status=neq.CANCELADO&order=data_vencimento.asc`);

 let entPrev=0,rec=0,despPrev=0,pago=0;

 l.forEach(x=>{
   if(x.tipo==='R'){
     entPrev += Number(x.valor_original||0);
     if(x.status==='PAGO') rec += Number(x.valor_original||0);
   }else{
     despPrev += Number(x.valor_original||0);
     if(x.status==='PAGO') pago += Number(x.valor_original||0);
   }
 });

 const totalAPagar = despPrev - pago;
 const saldoAtualCalc = rec - pago;
 const saldoProjetadoCalc = entPrev - despPrev;

 entradasPrevistas.textContent=money(entPrev);
 recebidoMes.textContent=money(rec);
 contasPrevistas.textContent=money(despPrev);
 jaPago.textContent=money(pago);
 aPagar.textContent=money(totalAPagar);
 saldoAtual.textContent=money(saldoAtualCalc);
 saldoProjetado.textContent=money(saldoProjetadoCalc);

 const cardSaldoProjetado = saldoProjetado.closest('.metric');
 cardSaldoProjetado.classList.toggle('negative', saldoProjetadoCalc < 0);

 if(saldoProjetadoCalc < 0){
   cardDeficit.classList.remove('hidden');
   deficitPrevisto.textContent = money(Math.abs(saldoProjetadoCalc));
 }else{
   cardDeficit.classList.add('hidden');
   deficitPrevisto.textContent = money(0);
 }

 const despesasMes=l.filter(x=>x.tipo==='D');
 listaMes.innerHTML=despesasMes.length
   ? despesasMes.map(x=>rowLanc(x)).join('')
   : '<p class="muted">Nenhuma conta gerada.</p>';

 const hoje=new Date();
 const alertas=despesasMes
   .filter(x=>x.status==='PENDENTE')
   .map(x=>({...x,dias:Math.ceil((new Date(x.data_vencimento+'T12:00:00')-hoje)/86400000)}))
   .filter(x=>x.dias<=5);

 listaAlertas.innerHTML=alertas.length
   ? alertas.map(x=>`<div class="row"><div><strong>${esc(x.descricao)}</strong><small>${x.dias<0?'Vencida há '+Math.abs(x.dias)+' dia(s)':x.dias===0?'Vence hoje':'Vence em '+x.dias+' dia(s)'}</small></div><strong>${money(x.valor_original)}</strong></div>`).join('')
   : '<p class="muted">Sem alertas para os próximos 5 dias.</p>';

 const rendasMes=l.filter(x=>x.tipo==='R');
 listaRendasMes.innerHTML=rendasMes.length
   ? rendasMes.map(x=>`<div class="row"><div><strong>${esc(x.descricao)}</strong><small>${x.status==='PAGO'?'Recebido':'Previsto'} • ${dataBR(x.data_vencimento)}</small></div><strong>${money(x.valor_original)}</strong></div>`).join('') +
     `<div class="row"><div><strong>Total das rendas</strong><small>Soma de todas as entradas previstas do mês</small></div><strong>${money(entPrev)}</strong></div>`
   : '<p class="muted">Nenhuma renda gerada para esta competência.</p>';
}

function rowLanc(x){
 let badge=x.status==='PAGO'?'<span class="badge paid">Pago</span>':(x.valor_confirmado?'<span class="badge pending">Pendente</span>':'<span class="badge unconfirmed">Atualizar valor</span>');
 return `<div class="row"><div><strong>${esc(x.descricao)}</strong><small>${dataBR(x.data_vencimento)} • ${badge}</small></div><div><strong>${money(x.valor_original)}</strong><div class="actions">
 <button class="mini edit" onclick='editarLanc(${JSON.stringify(x)})'>Editar</button>
 ${x.status==='PENDENTE'
   ? `<button class="mini pay" onclick='pagarLanc(${JSON.stringify(x)})'>Pago</button>`
   : x.status==='PAGO'
     ? `<button class="mini reopen" onclick='reabrirLancamento(${JSON.stringify(x)})'>Reabrir</button>`
     : ''}
 <button class="mini delete" onclick='excluirLancamento("${x.id}","${String(x.descricao).replace(/"/g,'&quot;')}")'>Excluir</button>
 ${x.linha_digitavel?`<button class="mini copy" onclick="copiar('${encodeURIComponent(x.linha_digitavel)}')">Copiar linha</button>`:''}
 </div></div></div>`;
}


async function loadContasPagas(){
 if(!tok() || !document.getElementById('listaContasPagas'))return;

 const comp=(competenciaPagas?.value || competencia.value);
 if(!comp)return;

 const ini=comp+'-01';

 try{
   // Primeiro localiza as despesas pagas da competência.
   const lancs=await api(
     `/rest/v1/lancamentos?select=id,descricao,data_vencimento,valor_original,competencia,status,tipo&competencia=eq.${ini}&tipo=eq.D&status=eq.PAGO&order=data_vencimento.asc`
   );

   if(!lancs?.length){
     totalContasPagas.textContent=money(0);
     qtdContasPagas.textContent='0';
     listaContasPagas.innerHTML='<p class="muted">Nenhuma conta paga nesta competência.</p>';
     return;
   }

   const ids=lancs.map(x=>x.id);
   const inIds='('+ids.join(',')+')';

   const [pags, contas] = await Promise.all([
     api(`/rest/v1/pagamentos?select=id,lancamento_id,conta_pagamento_id,valor_pago,data_pagamento,juros,multa,desconto&lancamento_id=in.${inIds}&order=data_pagamento.desc`),
     api('/rest/v1/contas?select=id,descricao,banco')
   ]);

   const pagamentoPorLanc=new Map();
   (pags||[]).forEach(p=>{
     if(!pagamentoPorLanc.has(p.lancamento_id)) pagamentoPorLanc.set(p.lancamento_id,p);
   });

   const contaPorId=new Map((contas||[]).map(c=>[c.id,c]));

   const linhas=lancs.map(l=>{
     const p=pagamentoPorLanc.get(l.id);
     const c=p?.conta_pagamento_id ? contaPorId.get(p.conta_pagamento_id) : null;
     const banco=c ? (c.banco ? `${c.descricao} - ${c.banco}` : c.descricao) : 'Não informado';
     const valor=p?.valor_pago ?? l.valor_original;
     return {
       ...l,
       data_pagamento:p?.data_pagamento || null,
       valor_pago:Number(valor||0),
       banco
     };
   });

   const total=linhas.reduce((s,x)=>s+x.valor_pago,0);
   totalContasPagas.textContent=money(total);
   qtdContasPagas.textContent=String(linhas.length);

   listaContasPagas.innerHTML=`
     <table class="table">
       <thead>
         <tr>
           <th>Descrição</th>
           <th>Vencimento</th>
           <th>Pago em</th>
           <th>Valor pago</th>
           <th>Conta/Banco</th>
         </tr>
       </thead>
       <tbody>
         ${linhas.map(x=>`
           <tr>
             <td>${esc(x.descricao)}</td>
             <td>${dataBR(x.data_vencimento)}</td>
             <td>${x.data_pagamento?dataBR(x.data_pagamento):'-'}</td>
             <td>${money(x.valor_pago)}</td>
             <td>${esc(x.banco)}</td>
           </tr>
         `).join('')}
       </tbody>
     </table>`;
 }catch(e){
   listaContasPagas.innerHTML=`<div class="message error">Erro ao carregar contas pagas: ${esc(e.message||String(e))}</div>`;
 }
}

async function loadLancamentos(){
 if(!competencia.value)return;let ini=compDate();let l=await api(`/rest/v1/lancamentos?select=*&competencia=eq.${ini}&order=data_vencimento.asc`);
 listaLancamentos.innerHTML=l.length?`<table class="table"><thead><tr><th>Descrição</th><th>Tipo</th><th>Venc.</th><th>Valor</th><th>Status</th><th>Linha/Código</th><th>Ações</th></tr></thead><tbody>${l.map(x=>`<tr><td>${esc(x.descricao)}</td><td>${x.tipo==='R'?'Receita':'Despesa'}</td><td>${dataBR(x.data_vencimento)}</td><td>${money(x.valor_original)}</td><td>${x.status}</td><td>${x.linha_digitavel?'Linha informada':x.codigo_barras?'Código informado':'-'}</td><td>
${`<button class="mini edit" onclick='editarLanc(${JSON.stringify(x)})'>Editar</button>`}
${x.status==='PENDENTE'
  ? `<button class="mini pay" onclick='pagarLanc(${JSON.stringify(x)})'>Pago</button>`
  : x.status==='PAGO'
    ? `<button class="mini reopen" onclick='reabrirLancamento(${JSON.stringify(x)})'>Reabrir</button>`
    : ''}
${`<button class="mini delete" onclick='excluirLancamento("${x.id}","${String(x.descricao).replace(/"/g,'&quot;')}")'>Excluir</button>`}
</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Sem lançamentos nesta competência.</p>';
}


function abrirReceita(){
 recId.value='';
 recModalTitulo.textContent='Nova renda recorrente';
 recDescricao.value='';
 recValor.value='';
 recDia.value='';
 recInicio.value=new Date().toISOString().slice(0,10);
 hide('receitaMsg');
 modalReceita.classList.remove('hidden');
}

function editarReceita(x){
 recId.value=x.id;
 recModalTitulo.textContent='Editar renda recorrente';
 recDescricao.value=x.descricao||'';
 recValor.value=x.valor??'';
 recDia.value=x.dia_recebimento||'';
 recInicio.value=x.data_inicio||new Date().toISOString().slice(0,10);
 hide('receitaMsg');
 modalReceita.classList.remove('hidden');
}

async function salvarReceita(adicionarOutra=false){
 try{
  const payload={
   descricao:recDescricao.value.trim(),
   valor:+recValor.value,
   dia_recebimento:+recDia.value,
   data_inicio:recInicio.value,
   atualizado_em:new Date().toISOString()
  };
  if(!payload.descricao || !payload.valor || payload.valor<=0 || !payload.dia_recebimento || !payload.data_inicio){
   msg('receitaMsg','Preencha descrição, valor, dia de recebimento e data inicial.','error');
   return;
  }
  if(recId.value){
   await api(`/rest/v1/receitas_recorrentes?id=eq.${recId.value}`,{
    method:'PATCH',
    body:JSON.stringify(payload)
   });
  }else{
   payload.usuario_id=uid();
   payload.grupo_id=gid();
   payload.ativo=true;
   const criada=await api('/rest/v1/receitas_recorrentes?select=id',{method:'POST',body:JSON.stringify(payload),headers:{'Prefer':'return=representation'}});
    if(criada?.[0]?.id) await sincronizarRendaRecorrenteFutura(criada[0].id);
  }

  await Promise.all([loadReceitas(),loadDashboard()]);

  if(adicionarOutra && !recId.value){
   recDescricao.value='';
   recValor.value='';
   recDia.value='';
   recInicio.value=new Date().toISOString().slice(0,10);
   msg('receitaMsg','Renda salva. Cadastre a próxima entrada.','success');
   recDescricao.focus();
  }else{
   modalReceita.classList.add('hidden');
  }
 }catch(e){msg('receitaMsg',e.message,'error')}
}

async function excluirReceita(id,descricao){
  return excluirRendaRecorrenteComFuturos(id,descricao);
}


async function sincronizarRendaRecorrenteFutura(receitaId){
  if(!receitaId)return;
  try{
    await api('/rest/v1/rpc/fn_sincronizar_renda_recorrente_futura',{
      method:'POST',
      body:JSON.stringify({p_receita_id:receitaId})
    });
  }catch(e){
    console.warn('Não foi possível sincronizar a renda recorrente nos meses futuros:',e);
  }
}

async function excluirRendaRecorrenteComFuturos(id,descricao){
  if(!confirm(`Excluir a renda recorrente "${descricao}"?\n\nOs lançamentos futuros pendentes gerados por esta renda também serão removidos. O histórico passado será mantido.`))return;

  try{
    await api('/rest/v1/rpc/fn_excluir_renda_recorrente_futura',{
      method:'POST',
      body:JSON.stringify({p_receita_id:id})
    });
    await api(`/rest/v1/receitas_recorrentes?id=eq.${id}`,{method:'DELETE'});
    await atualizarTudo();
  }catch(e){
    alert('Erro ao excluir renda recorrente: '+e.message);
  }
}


async function loadReceitas(){
 if(!tok())return;
 let d=await api('/rest/v1/receitas_recorrentes?select=*&order=descricao.asc');
 listaReceitas.innerHTML=d.length
 ? d.map(x=>`<div class="row">
   <div><strong>${esc(x.descricao)}</strong><small>Todo dia ${x.dia_recebimento}</small></div>
   <div><strong>${money(x.valor)}</strong>
     <div class="actions">
       <button class="mini edit" onclick='editarReceita(${JSON.stringify(x)})'>Editar</button>
       <button class="mini delete" onclick='excluirReceita("${x.id}","${String(x.descricao).replace(/"/g,'&quot;')}")'>Excluir</button>
     </div>
   </div>
 </div>`).join('') +
 `<div class="row"><div><strong>Total mensal cadastrado</strong><small>Soma de todas as rendas recorrentes ativas</small></div><strong>${money(d.reduce((s,x)=>s+Number(x.valor||0),0))}</strong></div>`
 : '<p class="muted">Nenhuma renda recorrente cadastrada.</p>';
}


function abrirContaRecorrente(){
  crId.value='';
  crModalTitulo.textContent='Nova conta mensal';
  crDescricao.value='';
  crTipo.value='VARIAVEL';
  crValor.value='';
  crDia.value='';
  crInicio.value=new Date().toISOString().slice(0,10);
  crLinha.value='';
  crCodigo.value='';
  hide('recorrenteMsg');
  modalRecorrente.classList.remove('hidden');
}

function editarContaRecorrente(x){
  crId.value=x.id;
  crModalTitulo.textContent='Editar conta mensal';
  crDescricao.value=x.descricao||'';
  crTipo.value=x.tipo_valor||'VARIAVEL';
  crValor.value=x.valor_padrao??'';
  crDia.value=x.dia_vencimento||'';
  crInicio.value=x.data_inicio||new Date().toISOString().slice(0,10);
  crLinha.value=x.linha_digitavel_padrao||'';
  crCodigo.value=x.codigo_barras_padrao||'';
  hide('recorrenteMsg');
  modalRecorrente.classList.remove('hidden');
}

async function salvarContaRecorrente(){
 try{
  const payload={
    descricao:crDescricao.value.trim(),
    tipo_valor:crTipo.value,
    valor_padrao:crValor.value?+crValor.value:null,
    dia_vencimento:+crDia.value,
    data_inicio:crInicio.value,
    codigo_barras_padrao:crCodigo.value||null,
    linha_digitavel_padrao:crLinha.value||null,
    atualizado_em:new Date().toISOString()
  };

  if(!payload.descricao || !payload.dia_vencimento || !payload.data_inicio){
    msg('recorrenteMsg','Preencha descrição, dia de vencimento e data inicial.','error');
    return;
  }

  if(crId.value){
    await api(`/rest/v1/contas_recorrentes?id=eq.${crId.value}`,{
      method:'PATCH',
      body:JSON.stringify(payload)
    });
  }else{
    payload.usuario_id=uid();
    payload.grupo_id=gid();
    payload.ativo=true;
    await api('/rest/v1/contas_recorrentes',{
      method:'POST',
      body:JSON.stringify(payload)
    });
  }

  modalRecorrente.classList.add('hidden');
  await loadRecorrentes();
 }catch(e){
  msg('recorrenteMsg',e.message,'error');
 }
}

async function excluirContaRecorrente(id,descricao){
  if(!confirm(`Deseja excluir a conta mensal "${descricao}"?\n\nOs lançamentos mensais já gerados serão mantidos no histórico.`)) return;
  try{
    await api(`/rest/v1/contas_recorrentes?id=eq.${id}`,{method:'DELETE'});
    await loadRecorrentes();
  }catch(e){
    alert('Não foi possível excluir: '+e.message);
  }
}

async function loadRecorrentes(){
 if(!tok())return;
 let d=await api('/rest/v1/contas_recorrentes?select=*&order=descricao.asc');
 listaRecorrentes.innerHTML=d.length?d.map(x=>`
   <div class="row">
     <div>
       <strong>${esc(x.descricao)}</strong>
       <small>${x.tipo_valor} • vence dia ${x.dia_vencimento}</small>
     </div>
     <div>
       <strong>${x.valor_padrao==null?'Valor variável':money(x.valor_padrao)}</strong>
       <div class="actions">
         <button class="mini edit" onclick='editarContaRecorrente(${JSON.stringify(x)})'>Editar</button>
         <button class="mini" style="color:#b91c1c;border-color:#fecaca" onclick='excluirContaRecorrente("${x.id}","${String(x.descricao).replace(/"/g,'&quot;')}")'>Excluir</button>
       </div>
     </div>
   </div>`).join(''):'<p class="muted">Nenhuma conta mensal cadastrada.</p>';
}


function editarLanc(x){modalEditarLanc.classList.remove('hidden');editId.value=x.id;editTitulo.textContent=x.descricao;editValor.value=x.valor_original;editVenc.value=x.data_vencimento;editLinha.value=x.linha_digitavel||'';editCodigo.value=x.codigo_barras||''}
async function salvarEdicaoLanc(){try{await api(`/rest/v1/lancamentos?id=eq.${editId.value}`,{method:'PATCH',body:JSON.stringify({valor_original:+editValor.value,data_vencimento:editVenc.value,linha_digitavel:editLinha.value||null,codigo_barras:editCodigo.value||null,valor_confirmado:true,atualizado_em:new Date().toISOString()})});modalEditarLanc.classList.add('hidden');await atualizarTudo()}catch(e){msg('editMsg',e.message,'error')}}

async function pagarLanc(x){
  modalPagamento.classList.remove('hidden');
  pagId.value=x.id;
  pagTitulo.textContent=x.descricao;
  pagValor.value=x.valor_original;
  pagData.value=new Date().toISOString().slice(0,10);
  pagContaPagamento.innerHTML='<option value="">Selecione...</option>';

  try{
    const contas=await api('/rest/v1/contas?select=id,descricao,banco&ativo=eq.true&order=descricao.asc');
    (contas||[]).forEach(c=>{
      const opt=document.createElement('option');
      opt.value=c.id;
      opt.textContent=c.banco ? `${c.descricao} - ${c.banco}` : c.descricao;
      pagContaPagamento.appendChild(opt);
    });
  }catch(e){
    msg('pagMsg','Não foi possível carregar as contas/bancos: '+e.message,'error');
  }
}
async function salvarPagamento(){
  hide('pagMsg');
  try{
    const id=pagId.value;
    if(!pagContaPagamento.value){
      msg('pagMsg','Selecione a conta/banco utilizado no pagamento.','error');
      return;
    }

    await api('/rest/v1/pagamentos',{
      method:'POST',
      body:JSON.stringify({
        usuario_id:uid(),
        grupo_id:gid(),
        lancamento_id:id,
        conta_pagamento_id:pagContaPagamento.value,
        valor_pago:+pagValor.value,
        juros:0,
        multa:0,
        desconto:0,
        data_pagamento:pagData.value
      })
    });

    await api(`/rest/v1/lancamentos?id=eq.${id}`,{
      method:'PATCH',
      body:JSON.stringify({status:'PAGO',atualizado_em:new Date().toISOString()})
    });

    modalPagamento.classList.add('hidden');
    await atualizarTudo();
    if(document.getElementById('competenciaPagas')) await loadContasPagas();
  }catch(e){
    msg('pagMsg','Erro ao registrar pagamento: '+e.message,'error');
  }
}


function abrirConta(){
  contaId.value='';
  contaModalTitulo.textContent='Nova conta financeira';
  contaDescricao.value='';
  contaBanco.value='';
  contaSaldo.value='0';
  hide('contaMsg');
  modalConta.classList.remove('hidden');
}

function editarContaFinanceira(x){
  contaId.value=x.id;
  contaModalTitulo.textContent='Editar conta financeira';
  contaDescricao.value=x.descricao||'';
  contaBanco.value=x.banco||'';
  contaSaldo.value=x.saldo_inicial??0;
  hide('contaMsg');
  modalConta.classList.remove('hidden');
}

async function salvarConta(){
 try{
  const payload={
    descricao:contaDescricao.value.trim(),
    banco:contaBanco.value||null,
    saldo_inicial:+contaSaldo.value||0,
    atualizado_em:new Date().toISOString()
  };

  if(!payload.descricao){
    msg('contaMsg','Informe a descrição da conta.','error');
    return;
  }

  if(contaId.value){
    await api(`/rest/v1/contas?id=eq.${contaId.value}`,{
      method:'PATCH',
      body:JSON.stringify(payload)
    });
  }else{
    payload.usuario_id=uid();
    payload.grupo_id=gid();
    payload.ativo=true;
    await api('/rest/v1/contas',{
      method:'POST',
      body:JSON.stringify(payload)
    });
  }

  modalConta.classList.add('hidden');
  await loadContas();
 }catch(e){
  msg('contaMsg',e.message,'error');
 }
}

async function excluirContaFinanceira(id,descricao){
  if(!confirm(`Deseja excluir a conta financeira "${descricao}"?\n\nLançamentos antigos vinculados a ela não serão apagados.`)) return;
  try{
    await api(`/rest/v1/contas?id=eq.${id}`,{method:'DELETE'});
    await loadContas();
  }catch(e){
    alert('Não foi possível excluir: '+e.message);
  }
}

async function loadContas(){
 if(!tok())return;
 let d=await api('/rest/v1/contas?select=*&order=descricao.asc');
 listaContas.innerHTML=d.length?d.map(x=>`
   <div class="row">
     <div>
       <strong>${esc(x.descricao)}</strong>
       <small>${esc(x.banco||'')}</small>
     </div>
     <div>
       <strong>${money(x.saldo_inicial)}</strong>
       <div class="actions">
         <button class="mini edit" onclick='editarContaFinanceira(${JSON.stringify(x)})'>Editar</button>
         <button class="mini" style="color:#b91c1c;border-color:#fecaca" onclick='excluirContaFinanceira("${x.id}","${String(x.descricao).replace(/"/g,'&quot;')}")'>Excluir</button>
       </div>
     </div>
   </div>`).join(''):'<p class="muted">Nenhuma conta cadastrada.</p>';
}



function abrirCartao(){
 cartaoId.value='';
 cartaoModalTitulo.textContent='Novo cartão';
 cartaoDescricao.value='';
 cartaoLimite.value='';
 cartaoFech.value='';
 cartaoVenc.value='';
 hide('cartaoMsg');
 modalCartao.classList.remove('hidden');
}

function editarCartao(x){
 cartaoId.value=x.id;
 cartaoModalTitulo.textContent='Editar cartão';
 cartaoDescricao.value=x.descricao||'';
 cartaoLimite.value=x.limite??'';
 cartaoFech.value=x.dia_fechamento||'';
 cartaoVenc.value=x.dia_vencimento||'';
 hide('cartaoMsg');
 modalCartao.classList.remove('hidden');
}

async function salvarCartao(){
 try{
  const payload={
   descricao:cartaoDescricao.value.trim(),
   limite:cartaoLimite.value?+cartaoLimite.value:null,
   dia_fechamento:+cartaoFech.value,
   dia_vencimento:+cartaoVenc.value,
   atualizado_em:new Date().toISOString()
  };
  if(!payload.descricao || !payload.dia_fechamento || !payload.dia_vencimento){
   msg('cartaoMsg','Preencha descrição, dia de fechamento e dia de vencimento.','error');
   return;
  }
  if(cartaoId.value){
   await api(`/rest/v1/cartoes?id=eq.${cartaoId.value}`,{method:'PATCH',body:JSON.stringify(payload)});
  }else{
   payload.usuario_id=uid();
   payload.grupo_id=gid();
   payload.ativo=true;
   await api('/rest/v1/cartoes',{method:'POST',body:JSON.stringify(payload)});
  }
  modalCartao.classList.add('hidden');
  await loadCartoes();
 }catch(e){msg('cartaoMsg',e.message,'error')}
}

async function excluirCartao(id,descricao){
 if(!confirm(`Deseja excluir o cartão "${descricao}"?\n\nCompras já cadastradas podem impedir a exclusão por segurança.`))return;
 try{
  await api(`/rest/v1/cartoes?id=eq.${id}`,{method:'DELETE'});
  await Promise.all([loadCartoes(),loadCompras()]);
 }catch(e){alert('Não foi possível excluir o cartão. Exclua antes as compras vinculadas ou mantenha o cartão inativo.\n\nDetalhe: '+e.message)}
}

async function loadCartoes(){
 if(!tok())return;
 let d=await api('/rest/v1/cartoes?select=*&order=descricao.asc');
 listaCartoes.innerHTML=d.length?d.map(x=>`<div class="row">
   <div><strong>${esc(x.descricao)}</strong><small>Fecha dia ${x.dia_fechamento} • vence dia ${x.dia_vencimento}</small></div>
   <div><strong>${x.limite?money(x.limite):'Sem limite informado'}</strong>
     <div class="actions">
       <button class="mini edit" onclick='editarCartao(${JSON.stringify(x)})'>Editar</button>
       <button class="mini delete" onclick='excluirCartao("${x.id}","${String(x.descricao).replace(/"/g,'&quot;')}")'>Excluir</button>
     </div>
   </div>
 </div>`).join(''):'<p class="muted">Nenhum cartão cadastrado.</p>';
 await loadCompras();
}


async function abrirCompra(){
 compraId.value='';
 compraModalTitulo.textContent='Nova compra no cartão';
 modalCompra.classList.remove('hidden');
 compraDescricao.value='';
 compraValor.value='';
 compraParcelas.value='1';
 compraData.value=new Date().toISOString().slice(0,10);
 compraCompetencia.value=competencia.value;
 hide('compraMsg');
 let d=await api('/rest/v1/cartoes?select=id,descricao&ativo=eq.true&order=descricao.asc');
 compraCartao.innerHTML=d.map(x=>`<option value="${x.id}">${esc(x.descricao)}</option>`).join('');
}

async function editarCompra(x){
 compraId.value=x.id;
 compraModalTitulo.textContent='Editar compra no cartão';
 modalCompra.classList.remove('hidden');
 hide('compraMsg');
 let d=await api('/rest/v1/cartoes?select=id,descricao&ativo=eq.true&order=descricao.asc');
 compraCartao.innerHTML=d.map(c=>`<option value="${c.id}" ${c.id===x.cartao_id?'selected':''}>${esc(c.descricao)}</option>`).join('');
 compraDescricao.value=x.descricao||'';
 compraValor.value=x.valor_total??'';
 compraParcelas.value=x.quantidade_parcelas||1;
 compraData.value=x.data_compra||new Date().toISOString().slice(0,10);
 compraCompetencia.value=(x.primeira_competencia||compDate()).slice(0,7);
}

async function salvarCompra(){
 try{
  const parcelas=+compraParcelas.value;
  const total=+compraValor.value;
  const comp=compraCompetencia.value+'-01';

  if(!compraCartao.value || !compraDescricao.value.trim() || !total || total<=0 || !parcelas || parcelas<1){
   msg('compraMsg','Preencha cartão, descrição, valor e quantidade de parcelas.','error');
   return;
  }

  if(compraId.value){
   await api(`/rest/v1/compras_cartao?id=eq.${compraId.value}`,{
    method:'PATCH',
    body:JSON.stringify({
      cartao_id:compraCartao.value,
      descricao:compraDescricao.value.trim(),
      valor_total:total,
      quantidade_parcelas:parcelas,
      data_compra:compraData.value,
      primeira_competencia:comp
    })
   });

   await api(`/rest/v1/parcelas_cartao?compra_id=eq.${compraId.value}`,{method:'DELETE'});

   let arr=[];let [y,m]=compraCompetencia.value.split('-').map(Number);
   let baseVal=Math.round((total/parcelas)*100)/100;
   for(let i=1;i<=parcelas;i++){
    let dt=new Date(y,m-1+(i-1),1);
    arr.push({
      usuario_id:uid(),compra_id:compraId.value,cartao_id:compraCartao.value,numero_parcela:i,
      competencia:`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-01`,
      valor:(i===parcelas?Math.round((total-baseVal*(parcelas-1))*100)/100:baseVal)
    });
   }
   await api('/rest/v1/parcelas_cartao',{method:'POST',body:JSON.stringify(arr)});
  }else{
   let c=await api('/rest/v1/compras_cartao',{
    method:'POST',
    headers:{Prefer:'return=representation'},
    body:JSON.stringify({
      usuario_id:uid(),grupo_id:gid(),cartao_id:compraCartao.value,descricao:compraDescricao.value.trim(),
      valor_total:total,quantidade_parcelas:parcelas,data_compra:compraData.value,primeira_competencia:comp
    })
   });

   let compraNovaId=c[0].id;let arr=[];let [y,m]=compraCompetencia.value.split('-').map(Number);
   let baseVal=Math.round((total/parcelas)*100)/100;
   for(let i=1;i<=parcelas;i++){
    let dt=new Date(y,m-1+(i-1),1);
    arr.push({
      usuario_id:uid(),compra_id:compraNovaId,cartao_id:compraCartao.value,numero_parcela:i,
      competencia:`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-01`,
      valor:(i===parcelas?Math.round((total-baseVal*(parcelas-1))*100)/100:baseVal)
    });
   }
   await api('/rest/v1/parcelas_cartao',{method:'POST',body:JSON.stringify(arr)});
  }

  modalCompra.classList.add('hidden');
  await Promise.all([loadCompras(),loadCartoes()]);
 }catch(e){msg('compraMsg',e.message,'error')}
}

async function excluirCompra(id,descricao){
 if(!confirm(`Deseja excluir a compra "${descricao}" e todas as parcelas geradas?`))return;
 try{
  await api(`/rest/v1/compras_cartao?id=eq.${id}`,{method:'DELETE'});
  await loadCompras();
 }catch(e){alert('Não foi possível excluir a compra: '+e.message)}
}

async function loadCompras(){
 if(!tok() || !document.getElementById('listaComprasCartao'))return;
 let d=await api('/rest/v1/compras_cartao?select=*&order=data_compra.desc');
 listaComprasCartao.innerHTML=d.length?d.map(x=>`<div class="row">
   <div><strong>${esc(x.descricao)}</strong><small>${dataBR(x.data_compra)} • ${x.quantidade_parcelas} parcela(s)</small></div>
   <div><strong>${money(x.valor_total)}</strong>
     <div class="actions">
       <button class="mini edit" onclick='editarCompra(${JSON.stringify(x)})'>Editar</button>
       <button class="mini delete" onclick='excluirCompra("${x.id}","${String(x.descricao).replace(/"/g,'&quot;')}")'>Excluir</button>
     </div>
   </div>
 </div>`).join(''):'<p class="muted">Nenhuma compra cadastrada.</p>';
}



async function reabrirLancamento(x){
 if(!confirm(`Deseja reabrir o lançamento "${x.descricao}"?\n\nO status voltará para PENDENTE.`)) return;

 try{
   // Remove o pagamento vinculado para que o saldo seja recalculado corretamente
   await api(`/rest/v1/pagamentos?lancamento_id=eq.${x.id}`,{method:'DELETE'});

   await api(`/rest/v1/lancamentos?id=eq.${x.id}`,{
     method:'PATCH',
     body:JSON.stringify({
       status:'PENDENTE',
       atualizado_em:new Date().toISOString()
     })
   });

   await atualizarTudo();
 }catch(e){
   alert('Não foi possível reabrir o lançamento: '+e.message);
 }
}

async function excluirLancamento(id,descricao){
 if(!confirm(`Deseja excluir o lançamento "${descricao}"?\n\nEssa ação remove o lançamento desta competência.`)) return;

 try{
   await api(`/rest/v1/lancamentos?id=eq.${id}`,{method:'DELETE'});
   await atualizarTudo();
 }catch(e){
   alert('Não foi possível excluir o lançamento: '+e.message);
 }
}


async function loadPreferenciasAlerta(){
  hide('alertMsg');
  try{
    const d=await api('/rest/v1/preferencias_alerta?select=*&limit=1');
    const p=d?.[0];
    if(!p){
      alertInterno.checked=true;
      alertEmail.checked=false;
      alertWhatsapp.checked=false;
      alertEmailDestino.value='';
      alertWhatsappNumero.value='';
      alertDias.value='5,2,0';
      const agora=new Date();
      alertInicio.value=toLocalDateTimeValue(agora);
      alertFim.value='';
      return;
    }
    alertInterno.checked=!!p.alerta_interno;
    alertEmail.checked=!!p.alerta_email;
    alertWhatsapp.checked=!!p.alerta_whatsapp;
    alertEmailDestino.value=p.email_destino||'';
    alertWhatsappNumero.value=p.whatsapp_numero||'';
    alertDias.value=(p.dias_antes||[5,2,0]).join(',');
    alertInicio.value=p.inicio_disparos?toLocalDateTimeValue(new Date(p.inicio_disparos)):'';
    alertFim.value=p.fim_disparos?toLocalDateTimeValue(new Date(p.fim_disparos)):'';
  }catch(e){msg('alertMsg','Erro ao carregar alertas: '+e.message,'error')}
}

async function salvarPreferenciasAlerta(){
  hide('alertMsg');
  const dias=alertDias.value.split(',').map(x=>Number(x.trim())).filter(x=>Number.isInteger(x)&&x>=0);
  const payload={
    usuario_id:uid(),
    alerta_interno:alertInterno.checked,
    alerta_email:alertEmail.checked,
    email_destino:alertEmailDestino.value.trim()||null,
    alerta_whatsapp:alertWhatsapp.checked,
    whatsapp_numero:alertWhatsappNumero.value.replace(/\D/g,'')||null,
    dias_antes:dias.length?dias:[5,2,0],
    inicio_disparos:alertInicio.value?new Date(alertInicio.value).toISOString():null,
    fim_disparos:alertFim.value?new Date(alertFim.value).toISOString():null,
    atualizado_em:new Date().toISOString()
  };

  if(payload.alerta_email&&!payload.email_destino){
    msg('alertMsg','Informe o e-mail de destino.','error');return;
  }
  if(payload.alerta_whatsapp&&!payload.whatsapp_numero){
    msg('alertMsg','Informe o número do WhatsApp com DDI.','error');return;
  }
  if(payload.inicio_disparos && payload.fim_disparos &&
     new Date(payload.fim_disparos) <= new Date(payload.inicio_disparos)){
    msg('alertMsg','A data/hora final deve ser posterior ao início dos disparos.','error');return;
  }

  try{
    const existe=await api('/rest/v1/preferencias_alerta?select=usuario_id&limit=1');
    if(existe?.length){
      await api(`/rest/v1/preferencias_alerta?usuario_id=eq.${uid()}`,{method:'PATCH',body:JSON.stringify(payload)});
    }else{
      await api('/rest/v1/preferencias_alerta',{method:'POST',body:JSON.stringify(payload)});
    }
    msg('alertMsg','Preferências de alerta salvas.','success');
  }catch(e){msg('alertMsg','Erro ao salvar alertas: '+e.message,'error')}
}

async function testarAlerta(canal){
  hide('alertTestMsg');

  try{
    await salvarPreferenciasAlerta();

    const endpoint=CFG.SUPABASE_URL+'/functions/v1/finplanner-alertas';

    const r=await fetch(endpoint,{
      method:'POST',
      mode:'cors',
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+tok(),
        'Content-Type':'application/json'
      },
      body:JSON.stringify({mode:'test',channel:canal})
    });

    const t=await r.text();
    let d={};
    try{d=t?JSON.parse(t):{}}catch{d={message:t}}

    if(!r.ok){
      throw new Error(d?.error||d?.message||`HTTP ${r.status}`);
    }

    msg(
      'alertTestMsg',
      (canal==='email'?'E-mail':'WhatsApp')+
      ' de teste processado pela Edge Function com sucesso.',
      'success'
    );
  }catch(e){
    const detalhe=e?.message||String(e);
    msg(
      'alertTestMsg',
      'Teste não concluído: '+detalhe+
      '. Confirme se a função finplanner-alertas está DEPLOYED no Supabase. Se a mensagem continuar como Failed to fetch, verifique CORS/OPTIONS da função.',
      'error'
    );
  }
}

async function verificarServicoAlertas(){
  hide('alertTestMsg');
  try{
    const endpoint=CFG.SUPABASE_URL+'/functions/v1/finplanner-alertas';
    const r=await fetch(endpoint,{
      method:'POST',
      mode:'cors',
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+tok(),
        'Content-Type':'application/json'
      },
      body:JSON.stringify({mode:'health'})
    });

    const t=await r.text();
    let d={};
    try{d=t?JSON.parse(t):{}}catch{d={message:t}}

    if(!r.ok) throw new Error(d?.error||d?.message||`HTTP ${r.status}`);

    msg('alertTestMsg','Serviço de alertas online. Edge Function respondeu corretamente.','success');
  }catch(e){
    msg(
      'alertTestMsg',
      'Serviço de alertas indisponível: '+(e?.message||String(e))+
      '. Abra Supabase > Edge Functions > finplanner-alertas e confirme o Deploy.',
      'error'
    );
  }
}

async function copiar(enc){await navigator.clipboard.writeText(decodeURIComponent(enc));alert('Linha digitável copiada.')}

function toLocalDateTimeValue(d){
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function dataBR(v){if(!v)return'';let[a,m,d]=v.split('-');return `${d}/${m}/${a}`}
window.addEventListener('load',()=>{verificarFluxoRecuperacao();if(tok()&&uid())abrirApp().catch(()=>sair())});
