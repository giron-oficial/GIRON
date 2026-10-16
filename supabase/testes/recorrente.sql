-- GIRON - testes da renovacao do Recorrente (Fase 5 passo 5.4, parte 1). Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-recorrente.sh teste
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

-- ===========================================================================
-- Recorrente em dia: R$1000 a 10% -> juro R$100 por mes
-- ===========================================================================
select public.cliente_criar('Cliente R','111.444.777-35','63999990001');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente R'), 'recorrente', null, 1000, 10, null,
  current_date, (current_date + interval '1 month')::date);
select pg_temp.r('R1. Recorrente nasce com 1 ciclo de R$100 so de juro',
  pg_temp.qtd('Cliente R') = 1 and (select valor = 100 and parte_juro = 100 and parte_capital = 0 from public.parcelas where id = pg_temp.pid('Cliente R',1)));

create table pg_temp.pg (nome text primary key, id uuid);
insert into pg_temp.pg values ('r1', public.pagamento_registrar(pg_temp.pid('Cliente R',1), 100));
select pg_temp.r('R2. Pagou o juro: ciclo 1 pago e ciclo 2 nasceu', pg_temp.status('Cliente R',1) = 'paga' and pg_temp.qtd('Cliente R') = 2);
select pg_temp.r('R3. Ciclo 2: R$100, vence 1 mes depois do 1o',
  (select valor = 100 and parte_juro = 100 from public.parcelas where id = pg_temp.pid('Cliente R',2))
  and pg_temp.venc('Cliente R',2) = (pg_temp.venc('Cliente R',1) + interval '1 month')::date);
select pg_temp.r('R4. Contrato continua ativo e com o capital inteiro',
  (select status = 'ativo' and capital_em_aberto = 1000 and total_juro_pago = 100 from public.contratos where id = pg_temp.cid('Cliente R')));

select public.estorno_registrar((select id from pg_temp.pg where nome='r1'), 'lancei errado');
select pg_temp.r('R5. Estornou: ciclo 2 (criado pelo pagamento) sumiu e ciclo 1 voltou pra aberto',
  pg_temp.qtd('Cliente R') = 1 and pg_temp.status('Cliente R',1) = 'aberta');

select public.pagamento_registrar(pg_temp.pid('Cliente R',1), 40);
select pg_temp.r('R6. Pagou so parte do juro: fica parcial e nao renova', pg_temp.status('Cliente R',1) = 'parcial' and pg_temp.qtd('Cliente R') = 1);
select public.pagamento_registrar(pg_temp.pid('Cliente R',1), 60);
select pg_temp.r('R7. Completou o juro: agora renova', pg_temp.status('Cliente R',1) = 'paga' and pg_temp.qtd('Cliente R') = 2);

do $$ begin perform public.recorrente_renovar(pg_temp.cid('Cliente R'));
  perform pg_temp.r('R8. Fomentado nao consegue chamar a renovacao direto', false);
exception when others then perform pg_temp.r('R8. Fomentado nao consegue chamar a renovacao direto', sqlerrm like 'permission denied%'); end $$;

-- ===========================================================================
-- Recorrente atrasado: 1o vencimento ha 3 meses, nunca pagou
-- ===========================================================================
select public.cliente_criar('Cliente A','926.157.020-84','63999990002');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente A'), 'recorrente', null, 1000, 10, null,
  (current_date - interval '4 months')::date, (current_date - interval '3 months')::date);

reset role;
select public.recorrente_renovar_todos();
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
select pg_temp.r('R9. Agendador criou os ciclos atrasados ate o mes atual (4 ciclos, o ultimo vence hoje)',
  pg_temp.qtd('Cliente A') = 4 and pg_temp.venc('Cliente A',4) = current_date);
select pg_temp.r('R10. Os 4 ciclos sao de R$100, todos em aberto (R$400 de juro acumulado)',
  (select count(*) = 4 and sum(valor) = 400 from public.parcelas where contrato_id = pg_temp.cid('Cliente A') and status = 'aberta'));

reset role;
select pg_temp.r('R11. Rodar o agendador de novo nao duplica nada', public.recorrente_renovar_todos() = 0 and pg_temp.qtd('Cliente A') = 4);
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');

insert into pg_temp.pg values ('a1', public.pagamento_registrar(pg_temp.pid('Cliente A',1), 100));
select pg_temp.r('R12. Pagou um atrasado antigo: nao cria ciclo a mais', pg_temp.qtd('Cliente A') = 4);
select public.estorno_registrar((select id from pg_temp.pg where nome='a1'), 'lancei errado');
select pg_temp.r('R13. Estorno do atrasado nao apaga nenhum ciclo', pg_temp.qtd('Cliente A') = 4 and pg_temp.status('Cliente A',1) = 'aberta');

-- ===========================================================================
-- Dia 31: nao escorrega pro dia 28 depois de fevereiro
-- ===========================================================================
select public.cliente_criar('Cliente D','390.533.447-05','63999990003');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente D'), 'recorrente', null, 1000, 10, null,
  '2025-12-31', '2026-01-31');
reset role;
select public.recorrente_renovar_todos();
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
select pg_temp.r('R14. 31/01 -> 28/02 -> 31/03 (volta pro dia 31)',
  pg_temp.venc('Cliente D',2) = '2026-02-28' and pg_temp.venc('Cliente D',3) = '2026-03-31');

-- ===========================================================================
-- Parcelado nao e afetado
-- ===========================================================================
select public.cliente_criar('Cliente M','529.982.247-25','63999990004');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente M'), 'mensal','empresa',1000,10,5,
  current_date, (current_date + interval '1 month')::date);
select public.pagamento_registrar(pg_temp.pid('Cliente M',1), 300);
select pg_temp.r('R15. Parcelado: pagar uma parcela nao cria parcela nova', pg_temp.qtd('Cliente M') = 5);

reset role;
select pg_temp.r('R16. Agendador diario cadastrado', exists (select 1 from cron.job where jobname = 'giron-recorrente-renovar'));

rollback;
