-- GIRON - 0001: as 16 tabelas do sistema
-- Desenho aprovado em 26/09/2026 (cofre: 05-ARQUITETURA/TABELAS-DO-BANCO.md).
-- Dinheiro: numeric(14,2). Porcentagem de juro: numeric(12,8).
-- Toda tabela de dado de Fomentado tem tenant_id; as tabelas "filhas" usam chave
-- composta (tenant_id, id) para o banco garantir que filho e pai sao do mesmo Fomentado.

begin;

create schema if not exists giron_admin;

-- ---------------------------------------------------------------------------
-- Tipos (listas fechadas de opcoes)
-- ---------------------------------------------------------------------------
create type public.status_acesso as enum ('ativo', 'bloqueio_parcial', 'bloqueio_total');
create type public.papel_usuario as enum ('fomentado', 'dono_giron', 'cobrador');
create type public.recurso_extra as enum ('agente_telegram', 'whatsapp_automatico');
create type public.modalidade as enum ('diario', 'semanal', 'mensal', 'recorrente');
create type public.sistema_calculo as enum ('empresa', 'price', 'sac');
create type public.status_cadastro as enum ('pendente', 'aprovado', 'reprovado');
create type public.tipo_arquivo as enum ('selfie', 'documento', 'comprovante', 'foto_casa');
create type public.tipo_link as enum ('cadastro', 'nova_localizacao');
create type public.status_contrato as enum ('ativo', 'quitado', 'cancelado');
create type public.status_parcela as enum ('aberta', 'paga', 'parcial');
create type public.tipo_pagamento as enum ('pagamento', 'amortizacao');

-- ---------------------------------------------------------------------------
-- Funcoes de apoio
-- ---------------------------------------------------------------------------
create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- Regra do endereco (RN-12/RN-13): so letras minusculas, sem acento/espaco/numero, e nomes reservados proibidos
create or replace function public.subdominio_valido(nome text) returns boolean
language sql immutable set search_path = '' as $$
  select nome ~ '^[a-z]{2,63}$'
     and nome not in ('www', 'app', 'api', 'admin', 'painel', 'suporte', 'mail', 'email', 'teste',
                      'giron', 'status', 'ajuda', 'login', 'cadastro', 'ftp', 'smtp', 'ns', 'dns');
$$;

-- ===========================================================================
-- Bloco A - Painel do dono do GIRON (assinatura)
-- ===========================================================================

-- 1. fomentados - a empresa que contratou o GIRON
create table public.fomentados (
  id              uuid primary key default gen_random_uuid(),
  nome_empresa    text not null check (length(trim(nome_empresa)) > 0),
  subdominio      text not null unique check (public.subdominio_valido(subdominio)),
  logo_arquivo    text,
  cor_paleta      text,
  status_acesso   public.status_acesso not null default 'ativo',
  bloqueio_manual boolean not null default false,
  teste_gratis_ate date,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- 2. fomentado_configuracoes - preferencias de cada Fomentado
create table public.fomentado_configuracoes (
  tenant_id                 uuid primary key references public.fomentados (id) on delete restrict,
  juro_padrao_percentual    numeric(12,8) check (juro_padrao_percentual >= 0),
  multa_atraso_valor        numeric(14,2) not null default 0 check (multa_atraso_valor >= 0),
  juro_diario_atraso_valor  numeric(14,2) not null default 0 check (juro_diario_atraso_valor >= 0),
  dias_para_critico         smallint not null default 2 check (dias_para_critico >= 2),
  cobra_sabado              boolean not null default true,
  cobra_domingo             boolean not null default false,
  mostrar_juro_no_extrato   boolean not null default false,
  mostrar_total_no_extrato  boolean not null default false,
  email_backup              text,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now()
);

-- 3. assinaturas - mensalidade do Fomentado pro GIRON
create table public.assinaturas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.fomentados (id) on delete restrict,
  vencimento    date not null,
  valor         numeric(14,2) not null check (valor >= 0),
  pago_em       date,
  forma         text not null default 'manual',
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.assinaturas (tenant_id, vencimento);

-- 4. recursos_extras - liga/desliga recursos pagos a parte
create table public.recursos_extras (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.fomentados (id) on delete restrict,
  recurso       public.recurso_extra not null,
  liberado      boolean not null default false,
  liberado_ate  date,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, recurso)
);

-- 5. usuarios - quem faz login (senha fica no Supabase Auth). Cliente final NUNCA tem usuario.
create table public.usuarios (
  id            uuid primary key references auth.users (id) on delete cascade,
  tenant_id     uuid references public.fomentados (id) on delete restrict,
  papel         public.papel_usuario not null default 'fomentado',
  nome          text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((papel = 'dono_giron') = (tenant_id is null))
);
create index on public.usuarios (tenant_id);

-- ===========================================================================
-- Bloco B - Clientes do Fomentado
-- ===========================================================================

-- 6. clientes (obrigatorios: nome completo, CPF, telefone - RN-31)
create table public.clientes (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.fomentados (id) on delete restrict,
  nome_completo             text not null check (length(trim(nome_completo)) > 0),
  cpf_criptografado         bytea not null,
  cpf_final                 text not null check (cpf_final ~ '^[0-9]{4}$'),
  cpf_hash                  text not null,
  telefone                  text not null check (length(trim(telefone)) >= 10),
  endereco                  text,
  cep                       text,
  trabalho_empresa          text,
  trabalho_endereco         text,
  trabalho_telefone         text,
  trabalho_referencia       text,
  indicado_por              text,
  valor_pretendido          numeric(14,2) check (valor_pretendido > 0),
  modalidade_preferida      public.modalidade,
  dia_vencimento_preferido  smallint check (dia_vencimento_preferido between 1 and 31),
  status_cadastro           public.status_cadastro not null default 'pendente',
  termometro_nivel          smallint,
  consentimento_lgpd_em     timestamptz,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, cpf_hash)
);
create index on public.clientes (tenant_id, nome_completo);

-- 7. cliente_arquivos - fotos e documentos (o arquivo fica no Storage, aqui so o caminho)
create table public.cliente_arquivos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  cliente_id      uuid not null,
  tipo            public.tipo_arquivo not null,
  caminho_arquivo text not null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  foreign key (tenant_id, cliente_id) references public.clientes (tenant_id, id) on delete cascade
);
create index on public.cliente_arquivos (tenant_id, cliente_id);

-- 8. cliente_localizacoes - varias por cliente, com nome livre (RN-44)
create table public.cliente_localizacoes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  cliente_id      uuid not null,
  nome            text not null check (length(trim(nome)) > 0),
  latitude        numeric(9,6) not null check (latitude between -90 and 90),
  longitude       numeric(9,6) not null check (longitude between -180 and 180),
  precisao_metros numeric(8,1) check (precisao_metros >= 0),
  foto_arquivo    text,
  registrado_em   timestamptz not null default now(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  foreign key (tenant_id, cliente_id) references public.clientes (tenant_id, id) on delete cascade
);
create index on public.cliente_localizacoes (tenant_id, cliente_id);

-- 9. links_cliente - links de uso unico (cadastro / nova localizacao)
create table public.links_cliente (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.fomentados (id) on delete restrict,
  cliente_id    uuid,
  tipo          public.tipo_link not null,
  codigo        text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  expira_em     timestamptz not null default now() + interval '7 days',
  usado_em      timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (tenant_id, cliente_id) references public.clientes (tenant_id, id) on delete cascade,
  check (tipo = 'cadastro' or cliente_id is not null)
);

-- ===========================================================================
-- Bloco C - Emprestimos e dinheiro
-- ===========================================================================

-- 10. contratos
create table public.contratos (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  cliente_id          uuid not null,
  numero              integer not null check (numero > 0),
  modalidade          public.modalidade not null,
  sistema_calculo     public.sistema_calculo,
  capital             numeric(14,2) not null check (capital > 0),
  juro_percentual     numeric(12,8) not null check (juro_percentual >= 0),
  juro_valor          numeric(14,2) not null check (juro_valor >= 0),
  quantidade_parcelas integer check (quantidade_parcelas > 0),
  data_contrato       date not null,
  dia_vencimento      smallint check (dia_vencimento between 1 and 31),
  status              public.status_contrato not null default 'ativo',
  total_juro_pago     numeric(14,2) not null default 0,
  total_capital_pago  numeric(14,2) not null default 0,
  capital_em_aberto   numeric(14,2) not null,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  unique (tenant_id, id),
  unique (cliente_id, numero),
  foreign key (tenant_id, cliente_id) references public.clientes (tenant_id, id) on delete restrict,
  -- recorrente nao usa sistema de calculo nem quantidade de parcelas; parceladas usam os dois
  check ((modalidade = 'recorrente') = (sistema_calculo is null)),
  check ((modalidade = 'recorrente') = (quantidade_parcelas is null))
);
create index on public.contratos (tenant_id, status);

-- 11. parcelas
create table public.parcelas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  contrato_id   uuid not null,
  numero        integer not null check (numero > 0),
  vencimento    date not null,
  valor         numeric(14,2) not null check (valor >= 0),
  parte_juro    numeric(14,2) not null default 0,
  parte_capital numeric(14,2) not null default 0,
  status        public.status_parcela not null default 'aberta',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, id),
  unique (contrato_id, numero),
  foreign key (tenant_id, contrato_id) references public.contratos (tenant_id, id) on delete restrict
);
create index on public.parcelas (tenant_id, vencimento) where status <> 'paga';

-- 12. pagamentos (nunca apagados: estorno marca estornado_em)
create table public.pagamentos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  contrato_id     uuid not null,
  parcela_id      uuid,
  tipo            public.tipo_pagamento not null default 'pagamento',
  valor_calculado numeric(14,2),
  valor_pago      numeric(14,2) not null check (valor_pago >= 0),
  desconto        numeric(14,2) not null default 0 check (desconto >= 0),
  acrescimo       numeric(14,2) not null default 0 check (acrescimo >= 0),
  multa           numeric(14,2) not null default 0 check (multa >= 0),
  juro_atraso     numeric(14,2) not null default 0 check (juro_atraso >= 0),
  parte_juro      numeric(14,2) not null default 0,
  parte_capital   numeric(14,2) not null default 0,
  pago_em         date not null default current_date,
  observacao      text,
  estornado_em    timestamptz,
  motivo_estorno  text,
  criado_por      uuid references auth.users (id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  foreign key (tenant_id, contrato_id) references public.contratos (tenant_id, id) on delete restrict,
  foreign key (tenant_id, parcela_id) references public.parcelas (tenant_id, id) on delete restrict,
  check ((estornado_em is null) = (motivo_estorno is null))
);
create index on public.pagamentos (tenant_id, contrato_id);
create index on public.pagamentos (tenant_id, pago_em);

-- ===========================================================================
-- Bloco D - Apoio
-- ===========================================================================

-- 13. chaves_pix - ate 5 por Fomentado, numeradas de 1 a 5
create table public.chaves_pix (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.fomentados (id) on delete restrict,
  numero        smallint not null check (numero between 1 and 5),
  tipo          text not null,
  chave         text not null,
  padrao        boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, numero)
);
create unique index chaves_pix_uma_padrao on public.chaves_pix (tenant_id) where padrao;

-- 14. modelos_mensagem - textos de cobranca com {{nome}}, {{valor}}, {{data_vencimento}}, {{chave_pix}}
create table public.modelos_mensagem (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.fomentados (id) on delete restrict,
  nome          text not null,
  texto         text not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 15. cobrancas_disparadas - registro do clique no botao de WhatsApp
create table public.cobrancas_disparadas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  cliente_id    uuid not null,
  parcela_id    uuid,
  disparado_em  timestamptz not null default now(),
  foreign key (tenant_id, cliente_id) references public.clientes (tenant_id, id) on delete cascade,
  foreign key (tenant_id, parcela_id) references public.parcelas (tenant_id, id) on delete cascade
);

-- 16. auditoria - quem fez o que. So recebe registro novo (ver 0003).
create table public.auditoria (
  id          bigint generated always as identity primary key,
  tenant_id   uuid,
  usuario_id  uuid,
  acao        text not null,
  tabela      text not null,
  registro_id text,
  antes       jsonb,
  depois      jsonb,
  quando      timestamptz not null default now()
);
create index on public.auditoria (tenant_id, quando desc);

-- ---------------------------------------------------------------------------
-- atualizado_em automatico
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['fomentados','fomentado_configuracoes','assinaturas','recursos_extras','usuarios',
    'clientes','cliente_arquivos','cliente_localizacoes','links_cliente','contratos','parcelas','pagamentos',
    'chaves_pix','modelos_mensagem']
  loop
    execute format('create trigger tocar_atualizado_em before update on public.%I
                    for each row execute function public.tocar_atualizado_em()', t);
  end loop;
end $$;

commit;
