
const CFG=window.FINPLANNER_CONFIG;
const tok=()=>localStorage.getItem('fp_token')||'';
const uid=()=>localStorage.getItem('fp_uid')||'';
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const msg=(id,t,c='')=>{let e=document.getElementById(id);e.textContent=t;e.className='message '+c};
const hide=id=>document.getElementById(id).classList.add('hidden');

async function api(path,opt={},retry=true){
 const h=Object.assign({'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},opt.headers||{});
 if(tok())h.Authorization='Bearer '+tok();

 let r=await fetch(CFG.SUPABASE_URL+path,{...opt,headers:h});

 if(r.status===401 && retry && refreshTok()){
   const renovou=await renovarSessao();
   if(renovou) return api(path,opt,false);
 }

 const tx=await r.text();
 let d=null;
 try{d=tx?JSON.parse(tx):null}catch{d=tx}
 if(!r.ok)throw new Error(d?.message||d?.msg||d?.error_description||d?.error||'Erro Supabase');
 return d;
}


const refreshTok=()=>localStorage.getItem('fp_refresh_token')||'';

function salvarSessaoAuth(d){
  if(!d?.access_token)return;
  localStorage.setItem('fp_token',d.access_token);
  if(d.refresh_token) localStorage.setItem('fp_refresh_token',d.refresh_token);
  if(d.user?.id) localStorage.setItem('fp_uid',d.user.id);
  if(d.expires_at) localStorage.setItem('fp_expires_at',String(d.expires_at));
}

function limparSessaoAuth(){
  ['fp_token','fp_refresh_token','fp_uid','fp_expires_at','fp_admin','fp_grupo_id','fp_grupo_editar','fp_grupo_excluir']
    .forEach(k=>localStorage.removeItem(k));
}

async function renovarSessao(){
  const rt=refreshTok();
  if(!rt) return false;
  try{
    const r=await fetch(CFG.SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({refresh_token:rt})
    });
    if(!r.ok)return false;
    const d=await r.json();
    salvarSessaoAuth(d);
    return true;
  }catch{
    return false;
  }
}

async function garantirSessao(){
  if(!tok() || !uid()) return false;

  // Valida o token atual.
  try{
    const r=await fetch(CFG.SUPABASE_URL+'/auth/v1/user',{
      headers:{
        'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+tok()
      }
    });
    if(r.ok)return true;
  }catch{}

  // Token expirado: tenta renovação.
  return await renovarSessao();
}


async function entrar(){
 hide('loginMessage');
 const login=(document.getElementById('loginUsuario')?.value||'').trim().toLowerCase();
 const pw=senha.value;
 if(!login||!pw){
   msg('loginMessage','Informe login e senha.','error');
   return;
 }
 btnEntrar.disabled=true;
 try{
   const em=await api('/rest/v1/rpc/fn_resolver_login',{
     method:'POST',
     body:JSON.stringify({p_login:login})
   });
   if(!em) throw new Error('Login ou senha inválidos.');

   const d=await api('/auth/v1/token?grant_type=password',{
     method:'POST',
     body:JSON.stringify({email:em,password:pw})
   });

   salvarSessaoAuth(d);
   await abrirApp();
 }catch(e){
   msg('loginMessage',e.message||'Login ou senha inválidos.','error');
 }finally{
   btnEntrar.disabled=false;
 }
}



function abrirCadastroUsuario(){
  if(localStorage.getItem('fp_admin')!=='1'){
    alert('Apenas administradores podem criar usuários.');
    return;
  }
  cadUserTitulo.textContent='Novo usuário';
  cadNome.value='';
  cadLogin.value='';
  cadEmail.value='';
  cadSenha.value='';
  cadSenha2.value='';
  cadAdministrador.checked=false;
  cadAtivo.checked=true;
  cadCompartilharFinanceiro.checked=false;
  cadPodeVisualizar.checked=true;
  cadPodeEditar.checked=true;
  cadPodeExcluir.checked=false;
  cadExigirTrocaSenha.checked=true;
  cadVisualizarOutrosFinanceiros.checked=false;
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
  const login=cadLogin.value.trim().toLowerCase();
  const em=cadEmail.value.trim();
  const pw=cadSenha.value;
  const pw2=cadSenha2.value;

  if(!nome||!login||!em||!pw||!pw2){
    msg('cadUserMsg','Preencha nome, login, e-mail e senha.','error');return;
  }
  if(pw.length<8){
    msg('cadUserMsg','A senha deve possuir pelo menos 8 caracteres.','error');return;
  }
  if(pw!==pw2){
    msg('cadUserMsg','As senhas não conferem.','error');return;
  }

  if(cadCompartilharFinanceiro.checked){
    const permissoes=[
      cadPodeVisualizar.checked?'visualizar':null,
      cadPodeEditar.checked?'editar':null,
      cadPodeExcluir.checked?'excluir':null
    ].filter(Boolean).join(', ');
    if(!confirm(`Você está autorizando ${nome} a acessar o SEU financeiro.\n\nPermissões: ${permissoes||'nenhuma'}\n\nDeseja continuar?`)) return;
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
        login,
        email:em,
        password:pw,
        administrador:cadAdministrador.checked,
        ativo:cadAtivo.checked,
        compartilhar_financeiro:cadCompartilharFinanceiro.checked,
        pode_visualizar:cadPodeVisualizar.checked,
        pode_editar:cadPodeEditar.checked,
        pode_excluir:cadPodeExcluir.checked,
        exigir_troca_senha:cadExigirTrocaSenha.checked,
        pode_visualizar_outros_financeiros:cadVisualizarOutrosFinanceiros.checked
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



async function loadSegurancaFinanceiro(){
  if(!tok())return;
  try{
    const [acessos,auditoria]=await Promise.all([
      api('/rest/v1/rpc/fn_meus_acessos_financeiros',{method:'POST',body:JSON.stringify({})}),
      api('/rest/v1/rpc/fn_minha_auditoria_acessos',{method:'POST',body:JSON.stringify({})})
    ]);

    const lista=Array.isArray(acessos)?acessos:[];
    const badge=document.getElementById('segurancaStatusBadge');
    const titulo=document.getElementById('segurancaStatusTitulo');
    const texto=document.getElementById('segurancaStatusTexto');

    if(lista.length===0){
      badge.className='security-badge security-private';
      badge.textContent='Privado';
      titulo.textContent='Somente você possui acesso';
      texto.textContent='Não há compartilhamentos ativos no seu financeiro.';
    }else{
      badge.className='security-badge security-shared';
      badge.textContent=`Compartilhado com ${lista.length}`;
      titulo.textContent='Seu financeiro possui compartilhamentos ativos';
      texto.textContent='Revise abaixo quem possui acesso e quais ações cada pessoa pode realizar.';
    }

    listaAcessosFinanceiros.innerHTML=lista.length?`
      <table class="table">
        <thead>
          <tr>
            <th>Pessoa</th>
            <th>Login</th>
            <th>Visualizar</th>
            <th>Editar</th>
            <th>Excluir</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(x=>`
            <tr>
              <td>${esc(x.nome||x.email||'Usuário')}</td>
              <td>${esc(x.login||'-')}</td>
              <td>${x.pode_visualizar?'Sim':'Não'}</td>
              <td>${x.pode_editar?'Sim':'Não'}</td>
              <td>${x.pode_excluir?'Sim':'Não'}</td>
              <td>
                <button class="mini delete" onclick='revogarAcessoFinanceiro("${x.usuario_id}","${String(x.nome||x.email||'usuário').replace(/"/g,'&quot;')}")'>
                  Revogar acesso
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
      :'<div class="security-empty"><strong>Seu financeiro está privado.</strong><span>Nenhuma outra pessoa possui acesso neste momento.</span></div>';

    const logs=Array.isArray(auditoria)?auditoria:[];
    listaAuditoriaFinanceiro.innerHTML=logs.length?`
      <table class="table">
        <thead><tr><th>Data</th><th>Ação</th><th>Usuário</th><th>Detalhes</th></tr></thead>
        <tbody>
          ${logs.map(x=>`
            <tr>
              <td>${new Date(x.criado_em).toLocaleString('pt-BR')}</td>
              <td>${esc(x.acao)}</td>
              <td>${esc(x.alvo_nome||x.alvo_email||'-')}</td>
              <td>${esc(x.detalhes_texto||'')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
      :'<p class="muted">Ainda não há alterações de compartilhamento registradas.</p>';

    hide('segurancaMsg');
  }catch(e){
    msg('segurancaMsg','Não foi possível carregar a segurança do financeiro: '+e.message,'error');
  }
}

async function revogarAcessoFinanceiro(usuarioId,nome){
  if(!confirm(`Revogar imediatamente o acesso de ${nome} ao seu financeiro?\n\nApós a revogação, essa pessoa não poderá consultar nem alterar novas informações do seu financeiro.`))return;

  try{
    await api('/rest/v1/rpc/fn_revogar_meu_acesso_financeiro',{
      method:'POST',
      body:JSON.stringify({p_usuario_id:usuarioId})
    });
    await loadSegurancaFinanceiro();
    if(localStorage.getItem('fp_admin')==='1') await loadUsuarios();
  }catch(e){
    msg('segurancaMsg','Não foi possível revogar o acesso: '+e.message,'error');
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
            <th>Login</th>
            <th>E-mail</th>
            <th>Administrador</th>
            <th>Ativo</th>
            <th>Permissões</th>
            <th>Parâmetros</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u=>`
            <tr>
              <td>${esc(u.nome||'')}</td>
              <td>${esc(u.login||'')}</td>
              <td>${esc(u.email||'')}</td>
              <td>${u.administrador?'Sim':'Não'}</td>
              <td>${u.ativo?'Sim':'Não'}</td>
              <td>
                ${u.compartilhado
                  ? `${u.pode_visualizar?'Visualizar':''}${u.pode_editar?' / Editar':''}${u.pode_excluir?' / Excluir':''}`
                  : 'Sem compartilhamento'}
              </td>
              <td>
                ${u.exigir_troca_senha?'Troca de senha pendente':'Senha definida'}
                ${u.pode_visualizar_outros_financeiros?' / Outros financeiros':''}
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
  editUserLogin.value=u.login||'';
  editUserAtivo.checked=!!u.ativo;
  editUserAdministrador.checked=!!u.administrador;
  editUserCompartilhar.checked=!!u.compartilhado;
  editUserPodeVisualizar.checked=!!u.pode_visualizar;
  editUserPodeEditar.checked=!!u.pode_editar;
  editUserPodeExcluir.checked=!!u.pode_excluir;
  editUserExigirTrocaSenha.checked=!!u.exigir_troca_senha;
  editUserVisualizarOutrosFinanceiros.checked=!!u.pode_visualizar_outros_financeiros;
  editUserNovaSenha.value='';
  editUserNovaSenha2.value='';
  hide('editUserMsg');
  modalEditarUsuario.classList.remove('hidden');
}

async function salvarEdicaoUsuario(){
  hide('editUserMsg');

  const novaSenha=editUserNovaSenha.value;
  const novaSenha2=editUserNovaSenha2.value;

  if(novaSenha || novaSenha2){
    if(novaSenha.length<8){
      msg('editUserMsg','A nova senha provisória deve possuir pelo menos 8 caracteres.','error');
      return;
    }
    if(novaSenha!==novaSenha2){
      msg('editUserMsg','As senhas provisórias não conferem.','error');
      return;
    }
  }

  if(editUserCompartilhar.checked){
    const permissoes=[
      editUserPodeVisualizar.checked?'visualizar':null,
      editUserPodeEditar.checked?'editar':null,
      editUserPodeExcluir.checked?'excluir':null
    ].filter(Boolean).join(', ');
    if(!confirm(`Você está concedendo acesso ao seu financeiro.\n\nPermissões: ${permissoes||'nenhuma'}\n\nConfirma esta autorização?`)) return;
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
        action:'update',
        id:editUserId.value,
        nome:editUserNome.value.trim(),
        login:editUserLogin.value.trim().toLowerCase(),
        ativo:editUserAtivo.checked,
        administrador:editUserAdministrador.checked,
        compartilhar_financeiro:editUserCompartilhar.checked,
        pode_visualizar:editUserPodeVisualizar.checked,
        pode_editar:editUserPodeEditar.checked,
        pode_excluir:editUserPodeExcluir.checked,
        exigir_troca_senha:editUserExigirTrocaSenha.checked,
        pode_visualizar_outros_financeiros:editUserVisualizarOutrosFinanceiros.checked,
        password:novaSenha||null
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

async function carregarGruposFinanceiros(){
  try{
    const grupos=await api('/rest/v1/rpc/fn_meus_grupos_financeiros',{
      method:'POST',
      body:JSON.stringify({})
    });

    const lista=Array.isArray(grupos)?grupos:[];
    if(!lista.length){
      localStorage.removeItem('fp_grupo_id');
      return;
    }

    let atual=localStorage.getItem('fp_grupo_id');
    if(!lista.some(g=>g.grupo_id===atual)){
      const proprio=lista.find(g=>g.proprietario_id===uid());
      atual=(proprio||lista[0]).grupo_id;
      localStorage.setItem('fp_grupo_id',atual);
    }

    const sel=document.getElementById('grupoFinanceiroSelect');
    if(sel){
      sel.innerHTML=lista.map(g=>`
        <option value="${g.grupo_id}" ${g.grupo_id===atual?'selected':''}>
          ${g.eh_proprietario?'Meu financeiro':'Financeiro de '+esc(g.proprietario_nome||g.grupo_nome)}
        </option>
      `).join('');

      const sw=document.getElementById('workspaceSwitcher');
      if(sw) sw.classList.toggle('hidden',lista.length<=1);
    }

    const permissao=lista.find(g=>g.grupo_id===atual);
    localStorage.setItem('fp_grupo_editar',permissao?.pode_editar?'1':'0');
    localStorage.setItem('fp_grupo_excluir',permissao?.pode_excluir?'1':'0');
  }catch(e){
    console.warn('Não foi possível carregar os financeiros disponíveis:',e);
  }
}

async function trocarGrupoFinanceiro(){
  const sel=document.getElementById('grupoFinanceiroSelect');
  if(!sel?.value)return;
  localStorage.setItem('fp_grupo_id',sel.value);
  competencia.value=new Date().toISOString().slice(0,7);
  if(document.getElementById('competenciaPagas')) competenciaPagas.value=competencia.value;
  await carregarGruposFinanceiros();
  await atualizarTudo();
}

const gid=()=>localStorage.getItem('fp_grupo_id')||'';


function grupoFinanceiroValido(){
  const g=gid();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(g);
}

async function abrirApp(){
  try{
    let p;

    try{
      p=await api(
        '/rest/v1/perfis?select=nome,email,administrador,ativo,exigir_troca_senha,pode_visualizar_outros_financeiros&id=eq.'+
        encodeURIComponent(uid())+
        '&limit=1'
      );
    }catch(e){
      const erro=String(e?.message||e).toLowerCase();

      // Compatibilidade se os campos da versão 2.4 ainda não estiverem no banco.
      if(
        erro.includes('exigir_troca_senha') ||
        erro.includes('pode_visualizar_outros_financeiros') ||
        erro.includes('column')
      ){
        p=await api(
          '/rest/v1/perfis?select=nome,email,administrador,ativo&id=eq.'+
          encodeURIComponent(uid())+
          '&limit=1'
        );
      }else{
        throw e;
      }
    }

    if(!p?.length){
      throw new Error('Perfil do usuário não encontrado ou sem permissão de leitura.');
    }

    if(p[0].ativo===false){
      throw new Error('Usuário inativo.');
    }

    usuarioNome.textContent=p[0].nome||p[0].email||'Usuário';

    if(p[0].administrador===true){
      navUsuarios.classList.remove('hidden');
      if(document.getElementById('adminFinanceTools')) adminFinanceTools.classList.remove('hidden');
      localStorage.setItem('fp_admin','1');
    }else{
      navUsuarios.classList.add('hidden');
      if(document.getElementById('adminFinanceTools')) adminFinanceTools.classList.add('hidden');
      localStorage.setItem('fp_admin','0');
    }

    // Só troca para o aplicativo depois que o perfil foi validado.
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');

    if(p[0].exigir_troca_senha===true && document.getElementById('modalTrocaSenhaInicial')){
      appView.classList.add('password-change-pending');
      novaSenhaInicial.value='';
      novaSenhaInicial2.value='';
      hide('trocaSenhaInicialMsg');
      modalTrocaSenhaInicial.classList.remove('hidden');
      return;
    }

    appView.classList.remove('password-change-pending');

    const now=new Date();
    competencia.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    if(document.getElementById('competenciaPagas')){
      competenciaPagas.value=competencia.value;
    }

    await carregarGruposFinanceiros();

    if(!gid()){
      throw new Error('Nenhum financeiro está associado ao seu usuário.');
    }
    if(!grupoFinanceiroValido()){
      localStorage.removeItem('fp_grupo_id');
      await carregarGruposFinanceiros();
      if(!grupoFinanceiroValido()){
        throw new Error('O identificador do financeiro está inválido. Saia e entre novamente após atualizar o sistema.');
      }
    }

    hide('sessionError');
    await atualizarTudo();
  }catch(e){
    console.error('Falha ao abrir FinPlanner:',e);

    // Não apaga sessão nem permissões. Mostra a falha para correção.
    if(document.getElementById('sessionError')){
      sessionError.textContent='Não foi possível carregar o perfil financeiro: '+(e?.message||String(e));
      sessionError.className='message error';
    }

    throw e;
  }
}

async function confirmarTrocaSenhaInicial(){
  hide('trocaSenhaInicialMsg');

  const senha1=novaSenhaInicial.value;
  const senha2=novaSenhaInicial2.value;

  if(!senha1 || senha1.length<8){
    msg('trocaSenhaInicialMsg','Informe uma senha com pelo menos 8 caracteres.','error');
    return;
  }
  if(senha1!==senha2){
    msg('trocaSenhaInicialMsg','As senhas não conferem.','error');
    return;
  }

  try{
    await api('/auth/v1/user',{
      method:'PUT',
      body:JSON.stringify({password:senha1})
    });

    await api('/rest/v1/rpc/fn_concluir_troca_senha',{
      method:'POST',
      body:JSON.stringify({})
    });

    modalTrocaSenhaInicial.classList.add('hidden');
    appView.classList.remove('password-change-pending');
    await abrirApp();
  }catch(e){
    msg('trocaSenhaInicialMsg','Não foi possível alterar a senha: '+e.message,'error');
  }
}

function sair(){limparSessaoAuth();location.reload()}
function toggleMenu(){sidebar.classList.toggle('open')}
function showView(v,b){document.querySelectorAll('.app-section').forEach(x=>x.classList.add('hidden'));document.getElementById('view-'+v).classList.remove('hidden');document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));b?.classList.add('active');sidebar.classList.remove('open');if(v==='recorrentes')loadRecorrentes();if(v==='receitas')loadReceitas();if(v==='lancamentos')loadLancamentos();if(v==='cartoes')loadCartoes();if(v==='contas')loadContas();if(v==='alertas')loadPreferenciasAlerta();if(v==='usuarios')loadUsuarios();if(v==='pagas')loadContasPagas();if(v==='seguranca')loadSegurancaFinanceiro();}
function compDate(){return competencia.value+'-01'}
function monthRange(){let [y,m]=competencia.value.split('-').map(Number);let n=new Date(y,m,1);return [competencia.value+'-01',`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`]}
async function trocarCompetencia(){
 if(document.getElementById('competenciaPagas')) competenciaPagas.value=competencia.value;
 await atualizarTudo();
}
async function atualizarTudo(){await Promise.all([loadDashboard(),loadLancamentos(),loadRecorrentes(),loadReceitas(),loadCartoes(),loadContas(),loadCompras(),verificarCicloMensal(),carregarAnaliseRiscoMensal()])}

async function gerarCompetencia(){
 return iniciarNovoCiclo();
}

function addMonthsToCompetencia(comp, qtd){
 const [y,m]=comp.split('-').map(Number);
 const d=new Date(y,m-1+qtd,1);
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

async function verificarCicloMensal(){
 if(!grupoFinanceiroValido()) return;
 if(!competencia.value || !document.getElementById('statusCiclo'))return;
 try{
   const ini=compDate();
   const dados=await api(`/rest/v1/lancamentos?select=id&grupo_id=eq.${gid()}&competencia=eq.${ini}&limit=1`);
   if(dados?.length){
     statusCiclo.textContent='Ciclo iniciado. As movimentações desta competência permanecem independentes dos outros meses.';
   }else{
     statusCiclo.textContent='Este mês ainda não possui lançamentos. Inicie o ciclo para carregar salários e contas recorrentes.';
   }
   const prox=addMonthsToCompetencia(competencia.value,1);
   const [py,pm]=prox.split('-');
   btnProximoCiclo.textContent=`Carregar ${new Date(Number(py),Number(pm)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}`;
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
   const confirmar=confirm(`Carregar o ciclo de ${rotulo}?\n\nSerão carregadas as rendas e contas recorrentes ativas. Lançamentos já existentes não serão duplicados.`);
   if(!confirmar)return;

   await api('/rest/v1/rpc/fn_iniciar_ciclo_mensal',{
     method:'POST',
     body:JSON.stringify({p_competencia:`${alvo}-01`,p_grupo_id:gid()})
   });

   competencia.value=alvo;
   if(document.getElementById('competenciaPagas')) competenciaPagas.value=alvo;
   msg('dashboardMessage',`Informações de ${rotulo} carregadas/atualizadas com sucesso.`,'success');
   await atualizarTudo();
 }catch(e){
   msg('dashboardMessage','Erro ao iniciar ciclo mensal: '+e.message,'error');
 }
}

async function iniciarProximoCiclo(){
 const prox=addMonthsToCompetencia(competencia.value,1);
 await iniciarNovoCiclo(prox);
}


function atualizarAnaliseRisco(totalRendas, totalDespesas){
  const panel=document.getElementById('painelRiscoMensal');
  if(!panel)return;

  const renda=Number(totalRendas||0);
  const despesas=Number(totalDespesas||0);

  const badge=document.getElementById('riscoBadge');
  const titulo=document.getElementById('riscoTitulo');
  const resumo=document.getElementById('riscoResumo');
  const comprometimentoEl=document.getElementById('riscoComprometimento');
  const sobraEl=document.getElementById('riscoSobra');
  const margemEl=document.getElementById('riscoMargem');
  const orientacao=document.getElementById('riscoOrientacao');

  badge.className='risk-badge';

  if(renda<=0){
    badge.classList.add('risk-neutral');
    badge.textContent='Sem dados';
    titulo.textContent='Informe suas rendas';
    resumo.textContent='Ainda não há renda prevista suficiente para calcular o risco do mês.';
    comprometimentoEl.textContent='—';
    sobraEl.textContent=money(-despesas);
    margemEl.textContent='—';
    orientacao.textContent='Cadastre o salário e outras entradas previstas. A análise será atualizada automaticamente.';
    return;
  }

  const comprometimento=(despesas/renda)*100;
  const sobra=renda-despesas;
  const margem=(sobra/renda)*100;

  comprometimentoEl.textContent=`${comprometimento.toFixed(1).replace('.',',')}%`;
  sobraEl.textContent=money(sobra);
  margemEl.textContent=`${margem.toFixed(1).replace('.',',')}%`;

  if(comprometimento<=80){
    badge.classList.add('risk-good');
    badge.textContent='Bom';
    titulo.textContent='Mês financeiramente confortável';
    resumo.textContent='As despesas previstas estão dentro de uma faixa mais segura em relação à renda.';
    orientacao.textContent='Mantenha o controle e considere separar parte da sobra para reserva de emergência, metas ou redução de dívidas.';
  }else if(comprometimento<=100){
    badge.classList.add('risk-warning');
    badge.textContent='Atenção';
    titulo.textContent='Mês com pouca margem';
    resumo.textContent='Grande parte da renda já está comprometida pelas despesas previstas.';
    orientacao.textContent='Revise gastos variáveis, evite novos compromissos e priorize contas essenciais e próximas do vencimento.';
  }else{
    badge.classList.add('risk-danger');
    badge.textContent='Risco';
    titulo.textContent='Despesas acima da renda';
    resumo.textContent='O total previsto de despesas supera as entradas deste mês.';
    orientacao.textContent='Priorize despesas essenciais, adie gastos não necessários e avalie onde reduzir despesas ou complementar a renda.';
  }
}



async function carregarAnaliseRiscoMensal(){
 if(!grupoFinanceiroValido()) return;
  if(!tok()||!competencia.value)return;
  try{
    const ini=compDate();
    const dados=await api(`/rest/v1/lancamentos?select=tipo,valor_original,status&grupo_id=eq.${gid()}&competencia=eq.${ini}&status=neq.CANCELADO`);
    const totalRendas=(dados||[]).filter(x=>x.tipo==='R').reduce((s,x)=>s+Number(x.valor_original||0),0);
    const totalDespesas=(dados||[]).filter(x=>x.tipo==='D').reduce((s,x)=>s+Number(x.valor_original||0),0);
    atualizarAnaliseRisco(totalRendas,totalDespesas);
  }catch(e){
    console.warn('Análise de risco não disponível:',e);
  }
}


async function loadDashboard(){
 if(!grupoFinanceiroValido()) return;
 let [ini,fim]=monthRange();
 periodoTitulo.textContent=new Date(ini+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());

 const l=await api(`/rest/v1/lancamentos?select=*&grupo_id=eq.${gid()}&competencia=eq.${ini}&status=neq.CANCELADO&order=data_vencimento.asc`);

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
 if(!grupoFinanceiroValido()) return;
 if(!tok() || !document.getElementById('listaContasPagas'))return;

 const comp=(competenciaPagas?.value || competencia.value);
 if(!comp)return;

 const ini=comp+'-01';

 try{
   // Primeiro localiza as despesas pagas da competência.
   const lancs=await api(
     `/rest/v1/lancamentos?select=id,descricao,data_vencimento,valor_original,competencia,status,tipo&grupo_id=eq.${gid()}&competencia=eq.${ini}&tipo=eq.D&status=eq.PAGO&order=data_vencimento.asc`
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
     api(`/rest/v1/contas?select=id,descricao,banco&grupo_id=eq.${gid()}`)
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
 if(!grupoFinanceiroValido()) return;
 if(!competencia.value)return;let ini=compDate();let l=await api(`/rest/v1/lancamentos?select=*&grupo_id=eq.${gid()}&competencia=eq.${ini}&order=data_vencimento.asc`);
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
 if(!grupoFinanceiroValido()) return;
 if(!tok())return;
 let d=await api(`/rest/v1/receitas_recorrentes?select=*&grupo_id=eq.${gid()}&order=descricao.asc`);
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



function toggleParcelamentoConta(){
  const chk=document.getElementById('crParcelada');
  const box=document.getElementById('crParcelamentoCampos');
  if(!chk||!box)return;
  box.classList.toggle('hidden',!chk.checked);
}

function calcularParcelaConta(rec, competenciaStr){
  if(!rec?.parcelada || !rec?.qtd_parcelas || !rec?.parcela_inicial || !rec?.data_inicio) return null;

  const inicio=new Date(rec.data_inicio+'T00:00:00');
  const [y,m]=competenciaStr.split('-').map(Number);
  const atual=new Date(y,m-1,1);

  const diff=(atual.getFullYear()-inicio.getFullYear())*12 + (atual.getMonth()-inicio.getMonth());
  const numero=Number(rec.parcela_inicial||1)+diff;

  if(numero<1 || numero>Number(rec.qtd_parcelas)) return null;
  return {numero,total:Number(rec.qtd_parcelas)};
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
  crParcelada.checked=false;
  crQtdParcelas.value='';
  crParcelaInicial.value='1';
  toggleParcelamentoConta();
  if(document.getElementById('crLevarProximoMes')) crLevarProximoMes.checked=true;
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
  crParcelada.checked=!!x.parcelada;
  crQtdParcelas.value=x.qtd_parcelas||'';
  crParcelaInicial.value=x.parcela_inicial||1;
  toggleParcelamentoConta();
  if(document.getElementById('crLevarProximoMes')) crLevarProximoMes.checked=x.levar_proximo_mes!==false;
  hide('recorrenteMsg');
  modalRecorrente.classList.remove('hidden');
}

async function salvarContaRecorrente(){
 try{
  const payload={
    descricao:crDescricao.value.trim(),
    tipo_valor:crTipo.value,
    valor_padrao:crValor.value?+crValor.value:null,
    parcelada:crParcelada.checked,
    qtd_parcelas:crParcelada.checked?Number(crQtdParcelas.value||0):null,
    parcela_inicial:crParcelada.checked?Number(crParcelaInicial.value||1):null,
    levar_proximo_mes:document.getElementById('crLevarProximoMes')?crLevarProximoMes.checked:true,
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

  if(payload.parcelada){
    if(!payload.qtd_parcelas || payload.qtd_parcelas<1){
      msg('recorrenteMsg','Informe a quantidade total de parcelas.','error');
      return;
    }
    if(!payload.parcela_inicial || payload.parcela_inicial<1 || payload.parcela_inicial>payload.qtd_parcelas){
      msg('recorrenteMsg','A parcela inicial deve estar entre 1 e a quantidade total de parcelas.','error');
      return;
    }
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
 if(!grupoFinanceiroValido()) return;
 if(!tok())return;
 let d=await api(`/rest/v1/contas_recorrentes?select=*&grupo_id=eq.${gid()}&order=descricao.asc`);
 listaRecorrentes.innerHTML=d.length?d.map(x=>`
   <div class="row">
     <div>
       <strong>${esc(x.descricao)}</strong>
       <small>${x.tipo_valor} • vence dia ${x.dia_vencimento}${x.tipo_valor==='FIXA'?(x.levar_proximo_mes?' • renova próximo mês':' • não renova'):''}${x.parcelada?` • ${x.parcela_inicial||1}/${x.qtd_parcelas} parcelas`:''}</small>
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
    const contas=await api(`/rest/v1/contas?select=id,descricao,banco&grupo_id=eq.${gid()}&ativo=eq.true&order=descricao.asc`);
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
 if(!grupoFinanceiroValido()) return;
 if(!tok())return;
 let d=await api(`/rest/v1/contas?select=*&grupo_id=eq.${gid()}&order=descricao.asc`);
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
 if(!grupoFinanceiroValido()) return;
 if(!tok())return;
 let d=await api(`/rest/v1/cartoes?select=*&grupo_id=eq.${gid()}&order=descricao.asc`);
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
 let d=await api(`/rest/v1/cartoes?select=id,descricao&grupo_id=eq.${gid()}&ativo=eq.true&order=descricao.asc`);
 compraCartao.innerHTML=d.map(x=>`<option value="${x.id}">${esc(x.descricao)}</option>`).join('');
}

async function editarCompra(x){
 compraId.value=x.id;
 compraModalTitulo.textContent='Editar compra no cartão';
 modalCompra.classList.remove('hidden');
 hide('compraMsg');
 let d=await api(`/rest/v1/cartoes?select=id,descricao&grupo_id=eq.${gid()}&ativo=eq.true&order=descricao.asc`);
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
      usuario_id:uid(),compra_id:compraId.value,
        grupo_id:gid(),cartao_id:compraCartao.value,numero_parcela:i,
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
 if(!grupoFinanceiroValido()) return;
 if(!tok() || !document.getElementById('listaComprasCartao'))return;
 let d=await api(`/rest/v1/compras_cartao?select=*&grupo_id=eq.${gid()}&order=data_compra.desc`);
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


function traduzirErroAlerta(texto,status=0){
  const raw=String(texto||'');
  const low=raw.toLowerCase();
  if(status===403 && (low.includes('testing emails') || low.includes('own email address'))){
    return 'O serviço de e-mail está em modo de teste. O Resend permite enviar somente para o e-mail proprietário da conta. Para enviar alertas a outros usuários, configure um domínio próprio verificado no Resend e atualize o remetente no Supabase.';
  }
  if(low.includes('domain') && (low.includes('verify')||low.includes('verified'))){
    return 'O domínio utilizado para envio ainda não está verificado no Resend. Verifique o domínio e o remetente configurado no Supabase.';
  }
  if(status===401 || low.includes('invalid api key') || low.includes('unauthorized')){
    return 'Não foi possível autenticar no serviço de e-mail. Verifique a RESEND_API_KEY nos Secrets do Supabase.';
  }
  if(low.includes('failed to fetch')){
    return 'Não foi possível acessar o serviço de alertas. Verifique se a função finplanner-alertas está publicada e se CORS/OPTIONS está configurado.';
  }
  if(status>=500) return 'O serviço de alertas está temporariamente indisponível. Tente novamente em alguns minutos.';
  return raw || 'Não foi possível concluir o teste do alerta.';
}

async function testarAlerta(canal){
  hide('alertTestMsg');
  try{
    const r=await fetch(CFG.SUPABASE_URL+'/functions/v1/finplanner-alertas',{
      method:'POST',
      headers:{'apikey':CFG.SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+tok(),'Content-Type':'application/json'},
      body:JSON.stringify({mode:'test',channel:canal,email:alertEmailDestino.value.trim(),whatsapp:alertWhatsappNumero.value.trim()})
    });
    const tx=await r.text(); let d={}; try{d=tx?JSON.parse(tx):{}}catch{d={message:tx}}
    if(!r.ok) throw Object.assign(new Error(traduzirErroAlerta(d?.details||d?.error||d?.message||tx,r.status)),{friendly:true});
    msg('alertTestMsg',`${canal==='email'?'E-mail':'WhatsApp'} de teste processado com sucesso.`,'success');
  }catch(e){
    msg('alertTestMsg',e?.friendly?e.message:traduzirErroAlerta(e?.message||String(e)),'error');
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
window.addEventListener('load',async()=>{
  verificarFluxoRecuperacao();

  if(!tok()||!uid())return;

  const ok=await garantirSessao();
  if(!ok){
    limparSessaoAuth();
    return;
  }

  abrirApp().catch(e=>{
    console.error('A sessão foi mantida para diagnóstico:',e);
    // Exibe o app/erro sem apagar o token. O usuário pode sair manualmente.
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    if(document.getElementById('sessionError')){
      sessionError.textContent='Erro ao carregar o FinPlanner: '+(e.message||e);
      sessionError.className='message error';
    }
  });
});