-- GIRON - 0022: pedido de ativacao do robo do Telegram / WhatsApp automatico pela financeira
-- Regras do dono (cofre: 03-DECISOES/REGISTRO-DE-DECISOES.md, 26 e 27/10/2026):
--  * A financeira toca em "Quero ativar", ve o novo valor da mensalidade e confirma com a senha dela.
--  * O dono recebe o aviso (Painel do Dono + Telegram) e toca em "Liberar" (ou "Recusar").
--  * Robo do Telegram: + R$ 20,00 na mensalidade (R$ 69,90 -> R$ 89,90). WhatsApp: preco ainda nao definido (fica "a combinar").
--  * O Telegram sai pelo pg_net (envio depois do commit). Token e endereco do site ficam no cofre do banco (vault):
--    giron_telegram_token, giron_telegram_chat, giron_site_url. Sem eles, o pedido grava normal e so nao avisa.

begin;

create table public.pedidos_ativacao (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.fomentados (id) on delete cascade,
  recurso           public.recurso_extra not null,
  mensalidade_atual numeric(14,2) not null,
  mensalidade_nova  numeric(14,2), -- nulo = valor a combinar
  status            text not null default 'pendente' check (status in ('pendente', 'liberado', 'recusado')),
  pedido_por        uuid references auth.users (id) on delete set null,
  pedido_em         timestamptz not null default now(),
  resolvido_em      timestamptz
);

-- Um pedido aberto por recurso: tocar de novo nao duplica
create unique index pedidos_ativacao_um_pendente on public.pedidos_ativacao (tenant_id, recurso) where status = 'pendente';

alter table public.pedidos_ativacao enable row level security;
create policy pedidos_ativacao_ve on public.pedidos_ativacao for select to authenticated
  using (tenant_id = public.meu_tenant_leitura() or public.sou_dono_giron());
-- Ninguem grava direto: so pelas funcoes abaixo
revoke insert, update, delete on public.pedidos_ativacao from anon, authenticated;
grant select on public.pedidos_ativacao to authenticated;

-- ---------------------------------------------------------------------------
-- Aviso pro dono no Telegram (robo @girongestao_bot)
-- ---------------------------------------------------------------------------
create or replace function giron_admin.segredo(p_nome text) returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_nome limit 1
$$;
revoke all on function giron_admin.segredo(text) from public, anon, authenticated;

create or replace function giron_admin.avisar_dono_telegram(p_texto text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := giron_admin.segredo('giron_telegram_token');
  v_chat  text := giron_admin.segredo('giron_telegram_chat');
begin
  if v_token is null or v_chat is null then return false; end if;
  perform net.http_post(
    url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body    := jsonb_build_object('chat_id', v_chat, 'text', p_texto, 'parse_mode', 'HTML', 'disable_web_page_preview', true),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return true;
exception when others then
  return false; -- aviso nunca derruba o pedido
end $$;
revoke all on function giron_admin.avisar_dono_telegram(text) from public, anon, authenticated;

create or replace function giron_admin.html(p text) returns text
language sql immutable set search_path = '' as $$
  select replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

create or replace function giron_admin.reais(p numeric) returns text
language sql immutable set search_path = '' as $$
  select 'R$ ' || replace(replace(replace(to_char(p, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.')
$$;

-- ---------------------------------------------------------------------------
-- Financeira pede a ativacao (a senha e conferida na tela, entrando de novo com ela)
-- ---------------------------------------------------------------------------
create or replace function public.pedir_ativacao(p_recurso public.recurso_extra) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_leitura();
  v_fom    public.fomentados;
  v_id     uuid;
  v_nova   numeric(14,2);
  v_nome   text;
  v_site   text;
begin
  if v_tenant is null or not exists (select 1 from public.usuarios where id = auth.uid() and papel = 'fomentado') then
    raise exception 'Somente o dono da financeira pode pedir ativacao';
  end if;
  if exists (select 1 from public.recursos_extras where tenant_id = v_tenant and recurso = p_recurso and liberado) then
    raise exception 'Esse recurso ja esta ligado';
  end if;
  select id into v_id from public.pedidos_ativacao where tenant_id = v_tenant and recurso = p_recurso and status = 'pendente';
  if v_id is not null then return v_id; end if;

  select * into v_fom from public.fomentados where id = v_tenant;
  v_nova := case when p_recurso = 'agente_telegram' then v_fom.mensalidade_valor + 20.00 end;
  insert into public.pedidos_ativacao (tenant_id, recurso, mensalidade_atual, mensalidade_nova, pedido_por)
  values (v_tenant, p_recurso, v_fom.mensalidade_valor, v_nova, auth.uid())
  returning id into v_id;

  v_nome := case p_recurso when 'agente_telegram' then 'Robô do Telegram' else 'WhatsApp automático' end;
  v_site := giron_admin.segredo('giron_site_url');
  perform giron_admin.avisar_dono_telegram(
    '🔔 <b>Pedido de ativação</b>' || chr(10) ||
    'Financeira: <b>' || giron_admin.html(v_fom.nome_empresa) || '</b>' || chr(10) ||
    'Quer ativar: <b>' || v_nome || '</b>' || chr(10) ||
    'Mensalidade: ' || giron_admin.reais(v_fom.mensalidade_valor) || ' → ' ||
      coalesce(giron_admin.reais(v_nova), 'valor a combinar') || chr(10) ||
    'Ela já confirmou com a senha.' ||
    case when v_site is not null then chr(10) || chr(10) || 'Toque em Liberar no Painel do Dono: ' || v_site || '/dono' else '' end
  );
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Dono libera ou recusa
-- ---------------------------------------------------------------------------
create or replace function public.dono_liberar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.pedidos_ativacao;
begin
  perform giron_admin.exigir_dono();
  select * into v_p from public.pedidos_ativacao where id = p_pedido and status = 'pendente' for update;
  if not found then raise exception 'Pedido nao encontrado ou ja resolvido'; end if;

  insert into public.recursos_extras (tenant_id, recurso, liberado)
  values (v_p.tenant_id, v_p.recurso, true)
  on conflict (tenant_id, recurso) do update set liberado = true, atualizado_em = now();

  -- Valor novo combinado: vale pras proximas mensalidades e pras que ainda nao foram pagas
  if v_p.mensalidade_nova is not null then
    update public.fomentados set mensalidade_valor = v_p.mensalidade_nova, atualizado_em = now() where id = v_p.tenant_id;
    update public.assinaturas set valor = v_p.mensalidade_nova
     where tenant_id = v_p.tenant_id and tipo = 'mensalidade' and pago_em is null;
  end if;

  update public.pedidos_ativacao set status = 'liberado', resolvido_em = now() where id = p_pedido;
end $$;

create or replace function public.dono_recusar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform giron_admin.exigir_dono();
  update public.pedidos_ativacao set status = 'recusado', resolvido_em = now() where id = p_pedido and status = 'pendente';
  if not found then raise exception 'Pedido nao encontrado ou ja resolvido'; end if;
end $$;

-- Ligou na mao pelo interruptor da ficha: o pedido aberto daquele recurso fica resolvido
create or replace function giron_admin.fechar_pedido_ao_ligar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.liberado then
    update public.pedidos_ativacao set status = 'liberado', resolvido_em = now()
     where tenant_id = new.tenant_id and recurso = new.recurso and status = 'pendente';
  end if;
  return new;
end $$;
create trigger recursos_extras_fecha_pedido after insert or update of liberado on public.recursos_extras
  for each row execute function giron_admin.fechar_pedido_ao_ligar();

revoke all on function public.pedir_ativacao(public.recurso_extra), public.dono_liberar_pedido(uuid), public.dono_recusar_pedido(uuid) from public, anon;
grant execute on function public.pedir_ativacao(public.recurso_extra), public.dono_liberar_pedido(uuid), public.dono_recusar_pedido(uuid) to authenticated;

commit;
