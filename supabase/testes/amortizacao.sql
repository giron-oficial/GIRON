-- GIRON - testes da amortizacao do Recorrente (Fase 5 passo 5.4, parte 2). Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-amortizacao.sh teste
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

create function pg_temp.cap(cliente text) returns numeric language sql as $$
  select capital_em_aberto from public.contratos where id = pg_temp.cid(cliente) $$;
create function pg_temp.st(cliente text) returns text language sql as $$
  select status::text from public.contratos where id = pg_temp.cid(cliente) $$;
create function pg_temp.val(cliente text, num int) returns numeric language sql as $$
  select valor from public.parcelas where id = pg_temp.pid(cliente, num) $$;
create function pg_temp.novo(nome text, cpf text, ini date, prim date) returns uuid language plpgsql as $$
declare v uuid; begin
  perform public.cliente_criar(nome, cpf, '63999990000');
  select public.contrato_criar((select id from public.clientes where nome_completo = nome), 'recorrente', null, 1000, 10, null, ini, prim) into v;
  return v; end $$;
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
create table pg_temp.pg (nome text primary key, id uuid);

-- ===========================================================================
-- Exemplo do dono: capital 1.000 a 10%, amortiza 500 -> capital 500, juro 50
-- ===========================================================================
select pg_temp.novo('Cliente A','111.444.777-35', current_date, (current_date + interval '1 month')::date);
insert into pg_temp.pg values ('a1', public.amortizacao_registrar(pg_temp.cid('Cliente A'), 500, 'trouxe 500 em dinheiro'));
select pg_temp.r('A1. Amortizou 500: capital em aberto 500', pg_temp.cap('Cliente A') = 500);
select pg_temp.r('A2. Juro do mes que ainda nao venceu caiu pra 50', pg_temp.val('Cliente A',1) = 50);
select pg_temp.r('A3. Ficou registrada como amortizacao, toda no capital, sem parcela',
  (select tipo = 'amortizacao' and parcela_id is null and parte_capital = 500 and parte_juro = 0 and valor_pago = 500
     from public.pagamentos where id = (select id from pg_temp.pg where nome='a1')));
select public.pagamento_registrar(pg_temp.pid('Cliente A',1), 50);
select pg_temp.r('A4. Pagou o juro de 50: o mes seguinte nasce com juro de 50', pg_temp.val('Cliente A',2) = 50 and pg_temp.st('Cliente A') = 'ativo');

do $$ begin perform public.amortizacao_registrar(pg_temp.cid('Cliente A'), 600);
  perform pg_temp.r('A5. Amortizar mais que o capital e recusado', false);
exception when others then perform pg_temp.r('A5. Amortizar mais que o capital e recusado', sqlerrm like 'O valor é maior que o capital em aberto%'); end $$;
do $$ begin perform public.amortizacao_registrar(pg_temp.cid('Cliente A'), 0);
  perform pg_temp.r('A6. Amortizar zero e recusado', false);
exception when others then perform pg_temp.r('A6. Amortizar zero e recusado', sqlerrm = 'Informe o valor da amortização'); end $$;

-- ===========================================================================
-- Estorno da amortizacao: tudo volta
-- ===========================================================================
select pg_temp.novo('Cliente E','926.157.020-84', current_date, (current_date + interval '1 month')::date);
insert into pg_temp.pg values ('e1', public.amortizacao_registrar(pg_temp.cid('Cliente E'), 300));
select pg_temp.r('A7. Amortizou 300: juro do mes 70', pg_temp.val('Cliente E',1) = 70);
select public.estorno_registrar((select id from pg_temp.pg where nome='e1'), 'lancei errado');
select pg_temp.r('A8. Estornou: capital volta pra 1000 e juro do mes volta pra 100', pg_temp.cap('Cliente E') = 1000 and pg_temp.val('Cliente E',1) = 100);

-- ===========================================================================
-- Atrasados: o juro que ja venceu nao muda, so o que ainda vai vencer
-- ===========================================================================
select pg_temp.novo('Cliente T','390.533.447-05', (current_date - interval '3 months')::date, (current_date - interval '2 months')::date);
reset role;
select public.recorrente_renovar_todos();
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
select public.amortizacao_registrar(pg_temp.cid('Cliente T'), 400);
select pg_temp.r('A9. Os 2 meses vencidos continuam 100 cada', pg_temp.val('Cliente T',1) = 100 and pg_temp.val('Cliente T',2) = 100);
select pg_temp.r('A10. O mes que vence hoje caiu pra 60', pg_temp.val('Cliente T',3) = 60);

-- ===========================================================================
-- Amortizou tudo: quitacao (e o estorno desfaz)
-- ===========================================================================
select pg_temp.novo('Cliente Q','529.982.247-25', current_date, (current_date + interval '1 month')::date);
insert into pg_temp.pg values ('q1', public.amortizacao_registrar(pg_temp.cid('Cliente Q'), 1000));
select pg_temp.r('A11. Amortizou os 1000 com o mes em dia: contrato quitado, mes futuro fica R$ 0',
  pg_temp.st('Cliente Q') = 'quitado' and pg_temp.cap('Cliente Q') = 0 and pg_temp.val('Cliente Q',1) = 0 and pg_temp.status('Cliente Q',1) = 'paga');
select public.estorno_registrar((select id from pg_temp.pg where nome='q1'), 'cliente desistiu');
select pg_temp.r('A12. Estornou a quitacao: ativo, capital 1000, mes volta a cobrar 100',
  pg_temp.st('Cliente Q') = 'ativo' and pg_temp.cap('Cliente Q') = 1000 and pg_temp.val('Cliente Q',1) = 100 and pg_temp.status('Cliente Q',1) = 'aberta');

-- Quitou o capital devendo juro atrasado: so fica quitado depois de pagar os atrasados
select pg_temp.novo('Cliente V','153.509.460-56', (current_date - interval '2 months')::date, (current_date - interval '1 month')::date);
reset role;
select public.recorrente_renovar_todos();
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
select public.amortizacao_registrar(pg_temp.cid('Cliente V'), 1000);
select pg_temp.r('A13. Capital zerado mas com 1 mes vencido sem pagar: continua ativo', pg_temp.st('Cliente V') = 'ativo' and pg_temp.status('Cliente V',1) = 'aberta');
select public.pagamento_registrar(pg_temp.pid('Cliente V',1), 100);
select pg_temp.r('A14. Pagou o atrasado: agora quitado e nao nasce mes novo',
  pg_temp.st('Cliente V') = 'quitado' and not exists (select 1 from public.parcelas where contrato_id = pg_temp.cid('Cliente V') and status <> 'paga'));

-- ===========================================================================
-- Seguranca e outras modalidades
-- ===========================================================================
select public.cliente_criar('Cliente M','714.602.380-01','63999990009');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente M'), 'mensal','empresa',1000,10,5,
  current_date, (current_date + interval '1 month')::date);
do $$ begin perform public.amortizacao_registrar(pg_temp.cid('Cliente M'), 100);
  perform pg_temp.r('A15. Amortizar empréstimo parcelado e recusado (por enquanto)', false);
exception when others then perform pg_temp.r('A15. Amortizar empréstimo parcelado e recusado (por enquanto)', sqlerrm = 'Amortização é só no empréstimo Recorrente'); end $$;

reset role;
insert into auth.users (id, email, aud, role) values ('00000000-0000-0000-0000-0000000000f9','f9@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values ('10000000-0000-0000-0000-0000000000f9','Outra Empresa','outraemp');
insert into public.usuarios (id, tenant_id, papel) values ('00000000-0000-0000-0000-0000000000f9','10000000-0000-0000-0000-0000000000f9','fomentado');
create temp table alvo as select pg_temp.cid('Cliente E') as id;
grant select on alvo to authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000f9');
do $$ begin perform public.amortizacao_registrar((select id from alvo), 100);
  perform pg_temp.r('A16. Outra empresa nao consegue amortizar contrato que nao e dela', false);
exception when others then perform pg_temp.r('A16. Outra empresa nao consegue amortizar contrato que nao e dela', sqlerrm = 'Contrato não encontrado'); end $$;

rollback;
