-- GIRON - testes de multa e juro de atraso (Fase 5 passo 5.5). Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-multa.sh teste
begin;

insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000f1','f1@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values
 ('10000000-0000-0000-0000-0000000000f1','Empresa Recorrente','empresarec');
insert into public.usuarios (id, tenant_id, papel) values
 ('00000000-0000-0000-0000-0000000000f1','10000000-0000-0000-0000-0000000000f1','fomentado');

create function pg_temp.como(u text) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u, true);
end $$;
create function pg_temp.r(t text, ok boolean) returns void language plpgsql as $$ begin
  raise notice '%  %', case when ok then 'PASSOU' else 'FALHOU' end, t; end $$;
create function pg_temp.cid(cliente text) returns uuid language sql as $$
  select c.id from public.contratos c join public.clientes cl on cl.id = c.cliente_id where cl.nome_completo = cliente $$;
create function pg_temp.pid(cliente text, num int) returns uuid language sql as $$
  select id from public.parcelas where contrato_id = pg_temp.cid(cliente) and numero = num $$;
create function pg_temp.qtd(cliente text) returns bigint language sql as $$
  select count(*) from public.parcelas where contrato_id = pg_temp.cid(cliente) $$;
create function pg_temp.status(cliente text, num int) returns text language sql as $$
  select status::text from public.parcelas where id = pg_temp.pid(cliente, num) $$;
create function pg_temp.venc(cliente text, num int) returns date language sql as $$
  select vencimento from public.parcelas where id = pg_temp.pid(cliente, num) $$;

select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
create table pg_temp.pg (nome text primary key, id uuid);

-- ===========================================================================
-- Configuracao do Fomentado
-- ===========================================================================
insert into public.fomentado_configuracoes (tenant_id, multa_atraso_valor, juro_diario_atraso_valor, dias_para_critico)
values ('10000000-0000-0000-0000-0000000000f1', 20, 3, 5);
select pg_temp.r('M1. Padrao: juro diario conta desde o vencimento',
  (select juro_atraso_desde = 'vencimento' from public.fomentado_configuracoes));
update public.fomentado_configuracoes set juro_atraso_desde = 'critico', multa_atraso_valor = 10, juro_diario_atraso_valor = 5;
select pg_temp.r('M2. Fomentado muda os proprios valores e a regra (so a partir do Critico)',
  (select juro_atraso_desde = 'critico' and multa_atraso_valor = 10 and juro_diario_atraso_valor = 5 from public.fomentado_configuracoes));
do $$ begin update public.fomentado_configuracoes set juro_atraso_desde = 'amanha';
  perform pg_temp.r('M3. Regra que nao existe e recusada', false);
exception when others then perform pg_temp.r('M3. Regra que nao existe e recusada', sqlerrm like '%violates check constraint%'); end $$;

-- ===========================================================================
-- Pagamento com multa e juro de atraso: parcela de 300 (juro 100 + capital 200)
-- ===========================================================================
select public.cliente_criar('Cliente M','111.444.777-35','63999990001');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente M'), 'mensal','empresa',1000,10,5,
  (current_date - interval '2 months')::date, (current_date - interval '10 days')::date);
insert into pg_temp.pg values ('m1', public.pagamento_registrar(pg_temp.pid('Cliente M',1), 350, 0, 0, 20, 30, 'pagou com multa'));
select pg_temp.r('M4. Pagou 350 = parcela 300 + multa 20 + juro de atraso 30: parcela paga',
  pg_temp.status('Cliente M',1) = 'paga');
select pg_temp.r('M5. Multa e juro de atraso guardados separados; a parcela recebeu 100 de juro e 200 de capital',
  (select multa = 20 and juro_atraso = 30 and parte_juro = 100 and parte_capital = 200 and valor_pago = 350
     from public.pagamentos where id = (select id from pg_temp.pg where nome='m1')));
select pg_temp.r('M6. Capital em aberto baixou so os 200 da parcela (multa nao abate capital)',
  (select capital_em_aberto = 800 from public.contratos where id = pg_temp.cid('Cliente M')));

do $$ begin perform public.pagamento_registrar(pg_temp.pid('Cliente M',2), 40, 0, 0, 20, 30);
  perform pg_temp.r('M7. Valor menor que multa + juro de atraso e recusado', false);
exception when others then perform pg_temp.r('M7. Valor menor que multa + juro de atraso e recusado', sqlerrm like 'O valor pago não cobre a multa e o juro de atraso (R$ 50.00)%'); end $$;

-- Negociou: perdoou a multa (lanca multa zero)
select public.pagamento_registrar(pg_temp.pid('Cliente M',2), 330, 0, 0, 0, 30);
select pg_temp.r('M8. Perdoou a multa: pagou 330 = parcela 300 + juro de atraso 30: parcela paga', pg_temp.status('Cliente M',2) = 'paga');

select public.estorno_registrar((select id from public.pagamentos where parcela_id = pg_temp.pid('Cliente M',2)), 'lancei errado');
select public.estorno_registrar((select id from pg_temp.pg where nome='m1'), 'lancei errado');
select pg_temp.r('M9. Estorno do pagamento com multa: parcela aberta e capital de volta pros 1000',
  pg_temp.status('Cliente M',1) = 'aberta' and (select capital_em_aberto = 1000 from public.contratos where id = pg_temp.cid('Cliente M')));

-- Sem multa: igual a antes
select public.pagamento_registrar(pg_temp.pid('Cliente M',1), 300);
select pg_temp.r('M10. Sem multa e sem juro de atraso funciona igual a antes', pg_temp.status('Cliente M',1) = 'paga');

rollback;
