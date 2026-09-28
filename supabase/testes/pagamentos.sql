-- GIRON - testes do pagamento de parcela (Fase 5 passo 5.2). Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-pagamentos.sh teste
begin;

insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000f1','f@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values
 ('10000000-0000-0000-0000-0000000000f1','Empresa Pagto','empresapg');
insert into public.usuarios (id, tenant_id, papel) values
 ('00000000-0000-0000-0000-0000000000f1','10000000-0000-0000-0000-0000000000f1','fomentado');

create function pg_temp.como(u text) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u, true);
end $$;
create function pg_temp.r(t text, ok boolean) returns void language plpgsql as $$ begin
  raise notice '%  %', case when ok then 'PASSOU' else 'FALHOU' end, t; end $$;
-- acha a parcela pelo nome do cliente + numero (so tem 1 contrato por cliente nestes testes)
create function pg_temp.pid(cliente text, num int) returns uuid language sql as $$
  select p.id from public.parcelas p join public.contratos c on c.id = p.contrato_id join public.clientes cl on cl.id = c.cliente_id
   where cl.nome_completo = cliente and p.numero = num $$;
create function pg_temp.cid(cliente text) returns uuid language sql as $$
  select c.id from public.contratos c join public.clientes cl on cl.id = c.cliente_id where cl.nome_completo = cliente $$;

select pg_temp.como('00000000-0000-0000-0000-0000000000f1');

-- ===========================================================================
-- Forma da Empresa: mensal, R$1000, 10%, 5x -> cada parcela R$300 (juro 100 + capital 200)
-- ===========================================================================
select public.cliente_criar('Cliente Empresa','111.444.777-35','63999990001');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente Empresa'), 'mensal','empresa',1000,10,5,'2026-10-01','2026-11-01');

select public.pagamento_registrar(pg_temp.pid('Cliente Empresa',1), 300);
select pg_temp.r('E1. Parcela 1 paga em cheio', (select status from public.parcelas where id=pg_temp.pid('Cliente Empresa',1))='paga');
select pg_temp.r('E2. Capital em aberto caiu 200', (select capital_em_aberto from public.contratos where id=pg_temp.cid('Cliente Empresa'))=800);

select public.pagamento_registrar(pg_temp.pid('Cliente Empresa',2), 100);
select pg_temp.r('E3. Parcela 2 so o juro: fica parcial (empurra a parcela)', (select status from public.parcelas where id=pg_temp.pid('Cliente Empresa',2))='parcial');
select pg_temp.r('E4. Capital em aberto nao mudou (so juro pago)', (select capital_em_aberto from public.contratos where id=pg_temp.cid('Cliente Empresa'))=800);

select public.pagamento_registrar(pg_temp.pid('Cliente Empresa',2), 200);
select pg_temp.r('E5. Parcela 2 completada depois: fecha paga', (select status from public.parcelas where id=pg_temp.pid('Cliente Empresa',2))='paga');
select pg_temp.r('E6. Capital em aberto caiu mais 200 (total 600)', (select capital_em_aberto from public.contratos where id=pg_temp.cid('Cliente Empresa'))=600);

select public.pagamento_registrar(pg_temp.pid('Cliente Empresa',3), 40);
select pg_temp.r('E7. Pagar menos que o juro tambem fica parcial (sem piso na Forma da Empresa)', (select status from public.parcelas where id=pg_temp.pid('Cliente Empresa',3))='parcial');

do $$ begin perform public.pagamento_registrar(pg_temp.pid('Cliente Empresa',3), 1000);
  perform pg_temp.r('E8. Pagar mais do que falta na parcela e recusado', false);
exception when others then perform pg_temp.r('E8. Pagar mais do que falta na parcela e recusado', sqlerrm like 'O valor é maior do que falta%'); end $$;

do $$ begin perform public.pagamento_registrar(pg_temp.pid('Cliente Empresa',1), 10);
  perform pg_temp.r('E9. Pagar parcela ja paga e recusado', false);
exception when others then perform pg_temp.r('E9. Pagar parcela ja paga e recusado', sqlerrm = 'Esta parcela já está paga'); end $$;

-- Recorrente: paga so juro, R$1000 10% = parcela R$100. Tambem aceita parcial (sem piso).
select public.cliente_criar('Cliente Recorrente','926.157.020-84','63999990002');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente Recorrente'), 'recorrente', null, 1000, 10, null, '2026-10-01','2026-11-01');

select public.pagamento_registrar(pg_temp.pid('Cliente Recorrente',1), 40);
select pg_temp.r('E10. Recorrente aceita parcial (sem piso)', (select status from public.parcelas where id=pg_temp.pid('Cliente Recorrente',1))='parcial');
select public.pagamento_registrar(pg_temp.pid('Cliente Recorrente',1), 60);
select pg_temp.r('E11. Recorrente completa e fica paga', (select status from public.parcelas where id=pg_temp.pid('Cliente Recorrente',1))='paga');
select pg_temp.r('E12. Contrato recorrente NAO vira quitado so por pagar 1 parcela', (select status from public.contratos where id=pg_temp.cid('Cliente Recorrente'))='ativo');

-- ===========================================================================
-- Price: mensal, R$1000, 10%, 5x
-- ===========================================================================
select public.cliente_criar('Cliente Price','438.837.240-41','63999990003');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente Price'), 'mensal','price',1000,10,5,'2026-10-01','2026-11-01');
create table pg_temp.antes as select parte_juro as juro3_antes from public.parcelas where id=pg_temp.pid('Cliente Price',3);

select public.pagamento_registrar(pg_temp.pid('Cliente Price',1), (select valor from public.parcelas where id=pg_temp.pid('Cliente Price',1)));
select pg_temp.r('P1. Parcela 1 paga em cheio', (select status from public.parcelas where id=pg_temp.pid('Cliente Price',1))='paga');
select pg_temp.r('P2. Pagamento cheio nao muda parcela futura', (select parte_juro from public.parcelas where id=pg_temp.pid('Cliente Price',3))=(select juro3_antes from pg_temp.antes));

do $$ declare j numeric; c numeric; begin
  select parte_juro, parte_capital into j, c from public.parcelas where id=pg_temp.pid('Cliente Price',2);
  perform public.pagamento_registrar(pg_temp.pid('Cliente Price',2), j + c/2); -- paga o juro inteiro + metade do capital previsto
end $$;
select pg_temp.r('P3. Parcela 2 com pagamento parcial: fecha paga mesmo assim', (select status from public.parcelas where id=pg_temp.pid('Cliente Price',2))='paga');
select pg_temp.r('P4. Parcelas futuras recalculadas: juro da 3 aumentou', (select parte_juro from public.parcelas where id=pg_temp.pid('Cliente Price',3)) > (select juro3_antes from pg_temp.antes));

do $$ declare j numeric; begin
  select parte_juro into j from public.parcelas where id=pg_temp.pid('Cliente Price',3);
  perform public.pagamento_registrar(pg_temp.pid('Cliente Price',3), j - 1);
  perform pg_temp.r('P5. Price recusa valor menor que o juro da parcela', false);
exception when others then perform pg_temp.r('P5. Price recusa valor menor que o juro da parcela', sqlerrm like 'O valor precisa cobrir pelo menos o juro%'); end $$;

do $$ declare v numeric; begin
  select valor into v from public.parcelas where id=pg_temp.pid('Cliente Price',3);
  perform public.pagamento_registrar(pg_temp.pid('Cliente Price',3), v + 500);
  perform pg_temp.r('P6. Price recusa valor maior que a parcela', false);
exception when others then perform pg_temp.r('P6. Price recusa valor maior que a parcela', sqlerrm like 'O valor é maior que a parcela%'); end $$;

-- ===========================================================================
-- SAC: mensal, R$1000, 10%, 5x -> capital igual (200) e juro sobre saldo
-- ===========================================================================
select public.cliente_criar('Cliente Sac','241.615.590-38','63999990004');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente Sac'), 'mensal','sac',1000,10,5,'2026-10-01','2026-11-01');

select public.pagamento_registrar(pg_temp.pid('Cliente Sac',1), 200); -- juro 100 + so metade do capital previsto (100 de 200)
select pg_temp.r('S1. SAC com pagamento parcial recalcula: capital da parcela 2 sobe pra 225', (select parte_capital from public.parcelas where id=pg_temp.pid('Cliente Sac',2))=225);
select pg_temp.r('S2. SAC recalcula: juro da parcela 2 e 90 (10% de 900)', (select parte_juro from public.parcelas where id=pg_temp.pid('Cliente Sac',2))=90);
select pg_temp.r('S3. Ultima parcela do SAC fecha os centavos certinho (soma capital = 900)',
  (select sum(parte_capital) from public.parcelas where contrato_id=pg_temp.cid('Cliente Sac') and numero>1)=900);

-- Ultima parcela sem parcela futura pra recalcular: nao aceita parcial
do $$ declare v numeric; begin
  select valor into v from public.parcelas where id=pg_temp.pid('Cliente Sac',5);
  perform public.pagamento_registrar(pg_temp.pid('Cliente Sac',5), v - 50);
  perform pg_temp.r('S4. Ultima parcela do SAC recusa pagamento parcial', false);
exception when others then perform pg_temp.r('S4. Ultima parcela do SAC recusa pagamento parcial', sqlerrm like '%última parcela%'); end $$;

rollback;
