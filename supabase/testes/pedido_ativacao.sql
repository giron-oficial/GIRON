-- GIRON - testes do pedido de ativacao (robo do Telegram / WhatsApp) e do Liberar do dono.
-- Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-pedido-ativacao.sh teste
begin;

insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000d1','dono@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a2','a2@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b2','b2@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c2','c2@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values
 ('10000000-0000-0000-0000-0000000000a2','Financeira <Pedido> A','pedidoa'),
 ('10000000-0000-0000-0000-0000000000b2','Financeira Pedido B','pedidob');
insert into public.usuarios (id, tenant_id, papel) values
 ('00000000-0000-0000-0000-0000000000d1', null, 'dono_giron'),
 ('00000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000a2','fomentado'),
 ('00000000-0000-0000-0000-0000000000b2','10000000-0000-0000-0000-0000000000b2','fomentado'),
 ('00000000-0000-0000-0000-0000000000c2','10000000-0000-0000-0000-0000000000a2','cobrador');
insert into public.assinaturas (tenant_id, tipo, vencimento, valor) values
 ('10000000-0000-0000-0000-0000000000a2','mensalidade', current_date + 10, 69.90);

create function pg_temp.como(u text) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u, true);
end $$;
create function pg_temp.r(t text, ok boolean) returns void language plpgsql as $$ begin
  raise notice '%  %', case when ok then 'PASSOU' else 'FALHOU' end, t; end $$;
create function pg_temp.falha(sql text) returns boolean language plpgsql as $$ begin
  execute sql; return false; exception when others then return true; end $$;

\set A '10000000-0000-0000-0000-0000000000a2'

-- Financeira A pede o robo
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
create temp table t_pedido as select public.pedir_ativacao('agente_telegram') as id;
select pg_temp.r('pedido do robo fica pendente com 69,90 -> 89,90',
  (select status = 'pendente' and mensalidade_atual = 69.90 and mensalidade_nova = 89.90 from public.pedidos_ativacao where id = (select id from t_pedido)));
select pg_temp.r('tocar de novo nao duplica o pedido',
  public.pedir_ativacao('agente_telegram') = (select id from t_pedido));
select pg_temp.r('financeira ve o proprio pedido',
  (select count(*) from public.pedidos_ativacao) = 1);
select pg_temp.r('financeira nao grava pedido direto na tabela',
  pg_temp.falha($q$insert into public.pedidos_ativacao (tenant_id, recurso, mensalidade_atual) values ('10000000-0000-0000-0000-0000000000a2','agente_telegram',1)$q$));
select pg_temp.r('financeira nao libera o proprio pedido',
  pg_temp.falha(format('select public.dono_liberar_pedido(%L)', (select id from t_pedido))));

-- Outra financeira e o cobrador
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
select pg_temp.r('outra financeira nao ve o pedido da A',
  (select count(*) from public.pedidos_ativacao) = 0);
select pg_temp.como('00000000-0000-0000-0000-0000000000c2');
select pg_temp.r('cobrador nao pode pedir ativacao',
  pg_temp.falha($q$select public.pedir_ativacao('whatsapp_automatico')$q$));

-- Dono ve e libera
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
select pg_temp.r('dono ve o pedido',
  (select count(*) from public.pedidos_ativacao) = 1);
select public.dono_liberar_pedido((select id from t_pedido));
select pg_temp.r('liberar liga o robo',
  (select liberado from public.recursos_extras where tenant_id = :'A' and recurso = 'agente_telegram'));
select pg_temp.r('liberar muda a mensalidade pra 89,90',
  (select mensalidade_valor = 89.90 from public.fomentados where id = :'A'));
select pg_temp.r('mensalidade em aberto passa a 89,90',
  (select valor = 89.90 from public.assinaturas where tenant_id = :'A' and tipo = 'mensalidade' and pago_em is null));
select pg_temp.r('pedido fica liberado',
  (select status = 'liberado' and resolvido_em is not null from public.pedidos_ativacao where id = (select id from t_pedido)));
select pg_temp.r('nao libera duas vezes',
  pg_temp.falha(format('select public.dono_liberar_pedido(%L)', (select id from t_pedido))));

-- Robo ja ligado: nao pede de novo
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select pg_temp.r('robo ja ligado nao aceita outro pedido',
  pg_temp.falha($q$select public.pedir_ativacao('agente_telegram')$q$));

-- WhatsApp: valor a combinar; dono recusa
create temp table t_zap as select public.pedir_ativacao('whatsapp_automatico') as id;
select pg_temp.r('pedido do WhatsApp fica com valor a combinar',
  (select mensalidade_nova is null from public.pedidos_ativacao where id = (select id from t_zap)));
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
select public.dono_recusar_pedido((select id from t_zap));
select pg_temp.r('recusar fecha o pedido sem ligar nada',
  (select status = 'recusado' from public.pedidos_ativacao where id = (select id from t_zap))
  and not exists (select 1 from public.recursos_extras where tenant_id = :'A' and recurso = 'whatsapp_automatico' and liberado));

-- Ligou na mao pelo interruptor: pedido aberto se resolve sozinho
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
create temp table t_zap2 as select public.pedir_ativacao('whatsapp_automatico') as id;
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
select public.dono_whatsapp(:'A', true);
select pg_temp.r('ligar no interruptor resolve o pedido aberto',
  (select status = 'liberado' from public.pedidos_ativacao where id = (select id from t_zap2)));

-- Textos do aviso
reset role;
select pg_temp.r('valor em reais no formato do Brasil',
  giron_admin.reais(1234.5) = 'R$ 1.234,50' and giron_admin.reais(89.9) = 'R$ 89,90');
select pg_temp.r('nome da empresa sem quebrar o Telegram',
  giron_admin.html('Financeira <Pedido> & Cia') = 'Financeira &lt;Pedido&gt; &amp; Cia');

rollback;
