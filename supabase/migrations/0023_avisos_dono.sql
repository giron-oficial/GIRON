-- GIRON - 0023: fila de avisos pro dono do GIRON (e-mail agora; WhatsApp e SMS depois)
--  * O Telegram continua saindo na hora pelo pg_net (0022). E-mail, WhatsApp e SMS nao saem de dentro do banco:
--    o script /opt/giron/scripts/avisos-dono.sh (VPS, a cada minuto) le esta fila, manda e marca o que foi enviado.
--  * Todo pedido de ativacao novo entra na fila sozinho (gatilho abaixo).

begin;

create table giron_admin.avisos_dono (
  id          bigint generated always as identity primary key,
  assunto     text not null,
  texto       text not null,
  criado_em   timestamptz not null default now(),
  email_em    timestamptz, -- quando o e-mail saiu (nulo = ainda nao)
  whatsapp_em timestamptz,
  sms_em      timestamptz,
  tentativas  smallint not null default 0
);
revoke all on giron_admin.avisos_dono from public, anon, authenticated;

create or replace function giron_admin.pedido_vira_aviso() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa text;
  v_nome    text := case new.recurso when 'agente_telegram' then 'Robô do Telegram' else 'WhatsApp automático' end;
  v_site    text := giron_admin.segredo('giron_site_url');
begin
  select nome_empresa into v_empresa from public.fomentados where id = new.tenant_id;
  insert into giron_admin.avisos_dono (assunto, texto) values (
    'GIRON: ' || v_empresa || ' quer ativar o ' || v_nome,
    'Pedido de ativação' || chr(10) || chr(10) ||
    'Financeira: ' || v_empresa || chr(10) ||
    'Quer ativar: ' || v_nome || chr(10) ||
    'Mensalidade: ' || giron_admin.reais(new.mensalidade_atual) || ' -> ' || coalesce(giron_admin.reais(new.mensalidade_nova), 'valor a combinar') || chr(10) ||
    'Ela já confirmou com a senha.' ||
    case when v_site is not null then chr(10) || chr(10) || 'Toque em Liberar no Painel do Dono: ' || v_site || '/dono' else '' end
  );
  return new;
end $$;

create trigger pedidos_ativacao_aviso after insert on public.pedidos_ativacao
  for each row execute function giron_admin.pedido_vira_aviso();

commit;
