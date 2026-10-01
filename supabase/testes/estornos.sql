-- GIRON - testes do estorno de pagamento (Fase 5 passo 5.3). Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-estornos.sh teste
begin;

insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000e1','e1@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e2','e2@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values
 ('10000000-0000-0000-0000-0000000000e1','Empresa Estorno','empresaest'),
 ('10000000-0000-0000-0000-0000000000e2','Empresa Vizinha','empresaviz');
insert into public.usuarios (id, tenant_id, papel) values
 ('00000000-0000-0000-0000-0000000000e1','10000000-0000-0000-0000-0000000000e1','fomentado'),
 ('00000000-0000-0000-0000-0000000000e2','10000000-0000-0000-0000-0000000000e2','fomentado');

create function pg_temp.como(u text) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u, true);
end $$;
create function pg_temp.r(t text, ok boolean) returns void language plpgsql as $$ begin
  raise notice '%  %', case when ok then 'PASSOU' else 'FALHOU' end, t; end $$;
create function pg_temp.pid(cliente text, num int) returns uuid language sql as $$
  select p.id from public.parcelas p join public.contratos c on c.id = p.contrato_id join public.clientes cl on cl.id = c.cliente_id
   where cl.nome_completo = cliente and p.numero = num $$;
create function pg_temp.cid(cliente text) returns uuid language sql as $$
  select c.id from public.contratos c join public.clientes cl on cl.id = c.cliente_id where cl.nome_completo = cliente $$;
create function pg_temp.status(cliente text, num int) returns text language sql as $$
  select status::text from public.parcelas where id = pg_temp.pid(cliente, num) $$;
create function pg_temp.aberto(cliente text) returns numeric language sql as $$
  select capital_em_aberto from public.contratos where id = pg_temp.cid(cliente) $$;
create function pg_temp.juro_pago(cliente text) returns numeric language sql as $$
  select total_juro_pago from public.contratos where id = pg_temp.cid(cliente) $$;

select pg_temp.como('00000000-0000-0000-0000-0000000000e1');

-- ===========================================================================
-- Forma da Empresa: mensal, R$1000, 10%, 5x -> parcela R$300 (juro 100 + capital 200)
-- ===========================================================================
select public.cliente_criar('Cliente E','111.444.777-35','63999990001');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente E'), 'mensal','empresa',1000,10,5,'2026-10-01','2026-11-01');

create table pg_temp.pg (nome text primary key, id uuid);
insert into pg_temp.pg values ('e1', public.pagamento_registrar(pg_temp.pid('Cliente E',1), 300));
insert into pg_temp.pg values ('e2', public.pagamento_registrar(pg_temp.pid('Cliente E',2), 100));

do $$ begin perform public.estorno_registrar((select id from pg_temp.pg where nome='e1'), 'lancei errado');
  perform pg_temp.r('X1. Estornar pagamento que nao e o ultimo e recusado', false);
exception when others then perform pg_temp.r('X1. Estornar pagamento que nao e o ultimo e recusado', sqlerrm like 'Só dá pra estornar o último%'); end $$;

do $$ begin perform public.estorno_registrar((select id from pg_temp.pg where nome='e2'), '  ');
  perform pg_temp.r('X2. Estorno sem motivo e recusado', false);
exception when others then perform pg_temp.r('X2. Estorno sem motivo e recusado', sqlerrm = 'Escreva o motivo do estorno'); end $$;

select public.estorno_registrar((select id from pg_temp.pg where nome='e2'), 'valor errado');
select pg_temp.r('X3. Parcela 2 voltou pra aberta', pg_temp.status('Cliente E',2) = 'aberta');
select pg_temp.r('X4. Juro pago voltou pra 100 (so o da parcela 1)', pg_temp.juro_pago('Cliente E') = 100);
select pg_temp.r('X5. Capital em aberto continua 800 (o estornado era so juro)', pg_temp.aberto('Cliente E') = 800);
select pg_temp.r('X6. Pagamento marcado com data e motivo, nao apagado',
  (select estornado_em is not null and motivo_estorno = 'valor errado' from public.pagamentos where id = (select id from pg_temp.pg where nome='e2')));

do $$ begin perform public.estorno_registrar((select id from pg_temp.pg where nome='e2'), 'de novo');
  perform pg_temp.r('X7. Estornar duas vezes e recusado', false);
exception when others then perform pg_temp.r('X7. Estornar duas vezes e recusado', sqlerrm = 'Este pagamento já foi estornado'); end $$;

select public.estorno_registrar((select id from pg_temp.pg where nome='e1'), 'cliente errado');
select pg_temp.r('X8. Agora o da parcela 1 virou o ultimo e foi estornado: parcela aberta', pg_temp.status('Cliente E',1) = 'aberta');
select pg_temp.r('X9. Capital em aberto voltou pros 1000 e juro pago pra 0', pg_temp.aberto('Cliente E') = 1000 and pg_temp.juro_pago('Cliente E') = 0);
select pg_temp.r('X10. Parcela estornada pode ser paga de novo',
  public.pagamento_registrar(pg_temp.pid('Cliente E',1), 300) is not null and pg_temp.status('Cliente E',1) = 'paga');

-- Parcial: paga 100 (juro) + 200 (capital) na mesma parcela, estorna o ultimo -> parcela volta pra parcial
select public.cliente_criar('Cliente P','926.157.020-84','63999990002');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente P'), 'mensal','empresa',1000,10,5,'2026-10-01','2026-11-01');
select public.pagamento_registrar(pg_temp.pid('Cliente P',1), 100);
insert into pg_temp.pg values ('p2', public.pagamento_registrar(pg_temp.pid('Cliente P',1), 200));
select public.estorno_registrar((select id from pg_temp.pg where nome='p2'), 'era de outro cliente');
select pg_temp.r('X11. Estornou a 2a parte: parcela volta pra parcial (sobrou o juro pago)', pg_temp.status('Cliente P',1) = 'parcial');
select pg_temp.r('X12. Capital volta pros 1000, juro pago fica 100', pg_temp.aberto('Cliente P') = 1000 and pg_temp.juro_pago('Cliente P') = 100);

-- Quitado: 1 parcela so, paga tudo -> quitado; estorno -> ativo de novo
select public.cliente_criar('Cliente Q','438.837.240-41','63999990003');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente Q'), 'mensal','empresa',1000,10,1,'2026-10-01','2026-11-01');
insert into pg_temp.pg values ('q1', public.pagamento_registrar(pg_temp.pid('Cliente Q',1), 1100));
select pg_temp.r('X13. Contrato quitado depois de pagar tudo', (select status from public.contratos where id=pg_temp.cid('Cliente Q')) = 'quitado');
select public.estorno_registrar((select id from pg_temp.pg where nome='q1'), 'pagamento nao caiu');
select pg_temp.r('X14. Estorno reabre o contrato (ativo) e a parcela (aberta)',
  (select status from public.contratos where id=pg_temp.cid('Cliente Q')) = 'ativo' and pg_temp.status('Cliente Q',1) = 'aberta');

-- ===========================================================================
-- Price: pagamento menor recalcula as parcelas futuras; o estorno devolve exatamente
-- ===========================================================================
select public.cliente_criar('Cliente Price','529.982.247-25','63999990004');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente Price'), 'mensal','price',1000,10,5,'2026-10-01','2026-11-01');
create table pg_temp.antes as
  select p.numero, p.valor, p.parte_juro, p.parte_capital from public.parcelas p where p.contrato_id = pg_temp.cid('Cliente Price');

do $$ declare j numeric; c numeric; begin
  select parte_juro, parte_capital into j, c from public.parcelas where id=pg_temp.pid('Cliente Price',1);
  insert into pg_temp.pg values ('pr1', public.pagamento_registrar(pg_temp.pid('Cliente Price',1), j + c/2));
end $$;
select pg_temp.r('X15. Pagamento menor mudou as parcelas futuras (Price)',
  (select valor from public.parcelas where id=pg_temp.pid('Cliente Price',2)) <> (select valor from pg_temp.antes where numero=2));
select pg_temp.r('X16. Guardou como as 4 parcelas futuras eram',
  (select count(*) from public.pagamento_recalculos where pagamento_id=(select id from pg_temp.pg where nome='pr1')) = 4);

select public.estorno_registrar((select id from pg_temp.pg where nome='pr1'), 'valor digitado errado');
select pg_temp.r('X17. Estorno devolveu TODAS as parcelas exatamente como eram',
  not exists (select 1 from public.parcelas p join pg_temp.antes a on a.numero = p.numero
               where p.contrato_id = pg_temp.cid('Cliente Price')
                 and (p.valor <> a.valor or p.parte_juro <> a.parte_juro or p.parte_capital <> a.parte_capital)));
select pg_temp.r('X18. Price: parcela 1 aberta e capital em aberto de volta em 1000',
  pg_temp.status('Cliente Price',1) = 'aberta' and pg_temp.aberto('Cliente Price') = 1000);

-- ===========================================================================
-- Segurança
-- ===========================================================================
do $$ begin
  update public.pagamentos set estornado_em = now(), motivo_estorno = 'na mao' where id = (select id from pg_temp.pg where nome='q1');
  perform pg_temp.r('X19. Marcar estorno direto na tabela (sem a funcao) e proibido', false);
exception when others then perform pg_temp.r('X19. Marcar estorno direto na tabela (sem a funcao) e proibido', true); end $$;

select pg_temp.como('00000000-0000-0000-0000-0000000000e2');
do $$ begin perform public.estorno_registrar((select id from pg_temp.pg where nome='p2'), 'invasao');
  perform pg_temp.r('X20. Outro Fomentado nao consegue estornar pagamento alheio', false);
exception when others then perform pg_temp.r('X20. Outro Fomentado nao consegue estornar pagamento alheio', sqlerrm = 'Pagamento não encontrado'); end $$;
select pg_temp.r('X21. Outro Fomentado nao ve os registros de recalculo alheios', (select count(*) from public.pagamento_recalculos) = 0);

rollback;
