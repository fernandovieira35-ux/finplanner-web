# FinPlanner Web 0.5

Esta versão reorganiza o projeto para um modelo de planejamento financeiro mensal.

## Incluído
- Receita recorrente (ex.: salário)
- Contas mensais fixas
- Contas mensais variáveis
- Geração automática por competência
- Atualização do valor da conta em cada mês
- Linha digitável e código de barras opcionais
- Marcar conta como paga
- Saldo atual
- Saldo projetado
- Alertas internos por proximidade de vencimento
- Cadastro de cartões
- Compras parceladas no cartão
- Cadastro de contas financeiras

## Antes de abrir a versão 0.5
Execute no Supabase o arquivo:

`FinPlanner_0_5_Migracao_Supabase.sql`

Caminho:
Supabase > SQL Editor > New Query > colar o conteúdo > Run

## Como testar
1. Execute a migração SQL.
2. Abra esta pasta no VS Code.
3. Execute com Live Server.
4. Faça login.
5. Cadastre uma receita recorrente (salário).
6. Cadastre contas mensais fixas/variáveis.
7. Volte ao Dashboard.
8. Escolha a competência.
9. Clique em `Gerar mês`.
10. Nas contas variáveis, clique em `Editar` para atualizar valor, vencimento e linha digitável.
11. Clique em `Pago` para registrar o pagamento.

## Regra mensal
A conta recorrente é o modelo.
O lançamento mensal é a ocorrência daquela competência.

Exemplo:
Energia (modelo) -> Setembro/2026 -> Outubro/2026 -> Novembro/2026

Cada mês mantém valor, vencimento, código e status próprios.

## Alertas externos
A estrutura do banco foi deixada preparada para:
- alerta interno;
- e-mail;
- WhatsApp.

A integração de e-mail/WhatsApp será feita em etapa posterior com serviço externo/Edge Function.

## Segurança
A aplicação usa somente a Publishable Key no navegador.
Nunca incluir chaves secretas/service_role no front-end.


## Versão 0.6 - Edição e exclusão

Foram adicionadas as opções:

- Editar conta mensal
- Alterar descrição
- Alterar tipo FIXA/VARIAVEL
- Alterar valor padrão
- Alterar dia de vencimento
- Alterar linha digitável
- Alterar código de barras
- Excluir conta mensal
- Editar conta financeira
- Alterar saldo inicial
- Excluir conta financeira

### Regra de segurança funcional

Ao excluir uma conta mensal recorrente, somente o cadastro/modelo é removido.
Os lançamentos mensais já gerados permanecem no histórico.

Assim, por exemplo:
Energia de setembro/2026 paga continua registrada mesmo que o cadastro recorrente
seja excluído posteriormente.


## Versão 0.7 - Múltiplas rendas e déficit em vermelho

Alterações:
- A área "Receitas fixas" passou a se chamar "Rendas / Entradas".
- É possível cadastrar várias rendas recorrentes, por exemplo:
  - Salário Fernando
  - Salário esposa
  - Renda extra
- Ao gerar a competência, todas as entradas são somadas automaticamente.
- O Dashboard apresenta a composição das rendas do mês.
- O Saldo Projetado é calculado por:
  Total de Entradas Previstas - Total de Contas Previstas
- Se o resultado for negativo:
  - o Saldo Projetado fica vermelho;
  - aparece um card "Déficit previsto";
  - o card mostra quanto faltará para pagar todas as contas.

Exemplo:
Salário 1: R$ 5.000,00
Salário 2: R$ 3.000,00
Total de entradas: R$ 8.000,00
Contas previstas: R$ 8.750,00
Saldo projetado: -R$ 750,00
Déficit previsto: R$ 750,00


## Versão 0.8 - Editar e Excluir em todos os cadastros

Padronização aplicada aos módulos de cadastro:

- Rendas / Entradas recorrentes
  - Editar
  - Excluir

- Contas mensais
  - Editar
  - Excluir

- Contas financeiras
  - Editar
  - Excluir

- Cartões de crédito
  - Editar
  - Excluir

- Compras parceladas no cartão
  - Editar
  - Excluir

### Regras
- Ao excluir um cadastro recorrente, lançamentos mensais já gerados permanecem.
- Ao editar uma compra parcelada, as parcelas vinculadas à compra são recriadas conforme o novo valor/quantidade/competência.
- Ao excluir uma compra, as parcelas ligadas à compra são excluídas pelo relacionamento em cascata.
- Um cartão com compras vinculadas pode ter a exclusão bloqueada pelo banco para preservar integridade.


## Versão 0.9 - Ações em todos os lançamentos

A coluna `Ações` agora aparece para todos os lançamentos.

### Lançamento pendente
- Editar
- Pago
- Excluir

### Lançamento pago
- Editar
- Reabrir
- Excluir

### Reabrir
Ao reabrir um lançamento pago:
- o pagamento vinculado é removido;
- o status retorna para `PENDENTE`;
- o Dashboard e os saldos são recalculados.

### Excluir
A exclusão remove apenas o lançamento daquela competência.
O cadastro recorrente que originou a conta não é excluído.


## Versão 1.0 - Cadastro de múltiplas rendas

- Botão `+ Adicionar renda` na tela Rendas / Entradas.
- Botão `+ Adicionar renda` também em Lançamentos do mês.
- Novo botão `Salvar e adicionar outra` no cadastro de renda.
- Permite cadastrar em sequência salário do usuário, salário da esposa e outras entradas.
- Cada renda é gravada separadamente e todas são somadas automaticamente no Dashboard.

Exemplo:
- Salário Fernando: R$ 3.800,00
- Salário esposa: R$ 3.200,00
- Renda extra: R$ 500,00
- Total previsto: R$ 7.500,00


# FinPlanner Web 1.1 - Login, Alertas e Logo

## Login
Incluído:
- Criar usuário
- Senha com mínimo de 8 caracteres
- Confirmação de senha
- Recuperar senha por e-mail
- Fluxo para definir nova senha após o link de recuperação

O cadastro utiliza Supabase Auth. Se a confirmação de e-mail estiver habilitada no Supabase,
o usuário precisará confirmar o endereço antes do primeiro login.

## Alertas
Nova tela `Alertas`:
- Alerta interno
- E-mail
- WhatsApp
- E-mail de destino
- Número WhatsApp com DDI
- Dias antes do vencimento
- Teste de e-mail
- Teste de WhatsApp

Os tokens dos provedores NÃO ficam no navegador.
O envio é feito pela Supabase Edge Function `finplanner-alertas`.

## Para ativar E-mail
1. Crie uma conta no Resend.
2. Gere uma API key.
3. Configure no Supabase Edge Functions > Secrets:
   RESEND_API_KEY
   ALERT_EMAIL_FROM
4. Para produção, configure/remeta por um domínio autorizado no provedor.

## Para ativar WhatsApp
É necessária uma configuração na Meta WhatsApp Business Platform:
- token de acesso;
- Phone Number ID;
- versão da Graph API;
- template de mensagem aprovado.

Configure os secrets:
WHATSAPP_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_GRAPH_VERSION
WHATSAPP_TEMPLATE_NAME
WHATSAPP_TEMPLATE_LANGUAGE

Alertas automáticos iniciados pela empresa normalmente devem usar template aprovado.

## Deploy da Edge Function
Com Supabase CLI:
supabase functions deploy finplanner-alertas --no-verify-jwt

Depois configure os Secrets no Dashboard.

## Banco
Execute:
FinPlanner_1_1_Migracao_Login_Alertas.sql

## Agendamento
Depois que a Edge Function estiver funcionando, use:
FinPlanner_1_1_Cron_Alertas.sql

O exemplo está configurado para 11:00 UTC, correspondente a 08:00 em UTC-3.
Ajuste conforme o horário desejado.

## Logo
A logo enviada foi incorporada ao sistema e exportada em:
- 64x64
- 192x192
- 512x512
- 1024x1024
- favicon.ico

Observação: o arquivo original possui resolução 32x32.
As versões maiores melhoram a apresentação e a compatibilidade com telas de alta densidade,
mas não recriam detalhes que não existiam no arquivo original.


# FinPlanner Web 1.2 - Usuários somente dentro do sistema

## Alteração no Login
Removido:
- Criar usuário

Mantido:
- Esqueci minha senha

## Administração de usuários
Novo menu:
- Usuários

Esse menu aparece somente para perfis com:
administrador = true

O administrador pode:
- Criar usuário
- Definir nome
- Definir e-mail
- Definir senha
- Definir se o novo usuário também é administrador
- Ativar/desativar usuário
- Excluir usuário

## Segurança
A criação de usuários NÃO é feita pelo navegador diretamente.

Fluxo:
FinPlanner -> Edge Function segura -> Supabase Admin API

A chave secreta/service_role permanece somente na Edge Function.

## Primeiro passo
Execute:
FinPlanner_1_2_Migracao_Admin_Usuarios.sql

Esse script transforma o primeiro perfil criado no projeto em administrador.

## Depois
Faça deploy da Edge Function:
finplanner-admin-users

Com Supabase CLI:
supabase functions deploy finplanner-admin-users --no-verify-jwt

## Resultado
Tela de login:
- E-mail
- Senha
- Entrar
- Esqueci minha senha

Criação de usuários:
- somente dentro do FinPlanner
- somente por administrador


# FinPlanner Web 1.3 - Botão Criar Novo Acesso

A tela `Usuários` agora possui um botão destacado:

`+ Criar novo acesso`

Esse botão:
- aparece somente para administradores;
- abre o cadastro de usuário;
- permite criar novos acessos ao FinPlanner;
- solicita nome, e-mail, senha, confirmação de senha, administrador e status ativo.

Também foi adicionado um segundo atalho na área de gerenciamento para facilitar
a criação de vários acessos em sequência.

Não é necessária nova migração no banco.

# FinPlanner Web 1.4 - Compartilhamento financeiro

Permite criar um acesso que utiliza o mesmo financeiro do proprietário.

No cadastro do usuário:
- Compartilhar meu financeiro
- Pode visualizar, incluir e alterar
- Pode excluir

Passos:
1. Execute `FinPlanner_1_4_Migracao_Compartilhamento.sql` no Supabase.
2. Atualize/deploy a Edge Function `finplanner-admin-users`.
3. Publique os arquivos web no GitHub/Render.


# FinPlanner Web 1.5

## Usuários
Foi adicionado o botão `Editar` na listagem de usuários.

Permissões editáveis:
- Compartilhar financeiro
- Visualizar movimentações
- Incluir/alterar movimentações
- Excluir movimentações
- Ativo
- Administrador

## Alertas
O erro `Failed to fetch` era compatível com Edge Function ausente/não publicada ou CORS.
A função `finplanner-alertas/index.ts` desta versão contém tratamento de CORS.

Novos campos:
- Início dos disparos (data e hora)
- Fim dos disparos (data e hora)

O teste manual ignora a janela de disparo.
Os alertas automáticos respeitam o início/fim.

Para o envio real:
- E-mail: configurar RESEND_API_KEY e ALERT_EMAIL_FROM
- WhatsApp: configurar WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_GRAPH_VERSION, WHATSAPP_TEMPLATE_NAME e WHATSAPP_TEMPLATE_LANGUAGE
- Cron: configurar CRON_SECRET e publicar/agendar a função

## Pagamento
Ao marcar uma conta como paga, agora é obrigatório escolher:
`Conta/Banco utilizado no pagamento`

O banco é salvo em:
pagamentos.conta_pagamento_id

## Ordem de atualização
1. Execute `FinPlanner_1_5_Migracao_Permissoes_Alertas_Banco.sql`
2. Publique novamente `finplanner-admin-users`
3. Publique `finplanner-alertas`
4. Atualize os arquivos web no GitHub
5. Aguarde o redeploy do Render
6. Configure os Secrets de e-mail/WhatsApp antes de testar os canais


# FinPlanner Web 1.6 - Identificação do desenvolvedor e DLN

## Login
Incluído:
`Desenvolvido por Fernando Vieira`

## DLN / Ajuda
Novo menu:
`DLN / Ajuda`

Conteúdo:
- Visão geral
- Login e acesso
- Usuários e permissões
- Rendas
- Contas mensais
- Lançamentos
- Pagamentos
- Cartões
- Alertas
- Financeiro compartilhado
- Dashboard e cálculos
- Publicação e atualização Web

Também foi incluído o botão:
`Imprimir DLN`

Essa versão não exige nova migração no Supabase.
