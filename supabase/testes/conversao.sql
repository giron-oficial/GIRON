-- GIRON - testes da conversao do Recorrente em parcelado (Fase 5 passo 5.4, parte 3). Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-conversao.sh teste
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
-- depois de converter o cliente tem 2 contratos: aqui "o contrato do cliente" e sempre o Recorrente
create or replace function pg_temp.cid(cliente text) returns uuid language sql as $$
  select c.id from public.contratos c join public.clientes cl on cl.id = c.cliente_id
   where cl.nome_completo = cliente and c.modalidade = 'recorrente' $$;
create function pg_temp.prev(cliente text) returns jsonb language sql as $$ select public.conversao_previa(pg_temp.cid(cliente)) $$;
create function pg_temp.atrasado(nome text, cpf text, meses int) returns uuid language plpgsql as $$
declare v uuid; begin
  perform public.cliente_criar(nome, cpf, '63999990000');
  select public.contrato_criar((select id from public.clientes where nome_completo = nome), 'recorrente', null, 1000, 10, null,
    (current_date - make_interval(months => meses + 1))::date, (current_date - make_interval(months => meses - 1))::date) into v;
  return v; end $$;
create function pg_temp.novo_de(cliente text) returns uuid language sql as $$
  select convertido_para from public.contratos where id = pg_temp.cid(cliente) $$;

select pg_temp.como('00000000-0000-0000-0000-0000000000f1');

-- Cada cliente com 4 meses de juro vencido (o ultimo vence hoje): 4 x 100 = 400 em aberto
select pg_temp.atrasado('Cliente T','111.444.777-35', 4);
select pg_temp.atrasado('Cliente P','926.157.020-84', 4);
select pg_temp.atrasado('Cliente N','390.533.447-05', 4);
select public.cliente_criar('Cliente D','529.982.247-25','63999990000');
select public.contrato_criar((select id from public.clientes where nome_completo='Cliente D'), 'recorrente', null, 1000, 10, null,
  current_date, (current_date + interval '1 month')::date);
reset role;
select public.recorrente_renovar_todos();
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');

select pg_temp.r('C1. Previa em dia: capital 1000, nenhum juro vencido',
  (pg_temp.prev('Cliente D')->>'capital')::numeric = 1000 and (pg_temp.prev('Cliente D')->>'juros_vencidos')::numeric = 0);
select pg_temp.r('C2. Previa atrasado: capital 1000 e 4 meses de juro vencido = 400',
  (pg_temp.prev('Cliente T')->>'juros_vencidos')::numeric = 400 and (pg_temp.prev('Cliente T')->>'meses_vencidos')::int = 4);

-- ===========================================================================
-- Exemplo do dono: capital 1.000 + 4 meses de 100 = 1.400 parcelado
-- ===========================================================================
select public.contrato_converter(pg_temp.cid('Cliente T'), 400, 'mensal', 'empresa', 10, 5, (current_date + interval '1 month')::date);
select pg_temp.r('C3. Juros todos incluidos: contrato novo de 1.400, mensal, 5 parcelas',
  (select capital = 1400 and modalidade = 'mensal' and quantidade_parcelas = 5 and status = 'ativo' and convertido_de = pg_temp.cid('Cliente T')
     from public.contratos where id = pg_temp.novo_de('Cliente T'))
  and (select count(*) = 5 from public.parcelas where contrato_id = pg_temp.novo_de('Cliente T')));
select pg_temp.r('C4. O Recorrente ficou convertido e aponta pro novo',
  (select status::text = 'convertido' and convertido_para is not null from public.contratos where id = pg_temp.cid('Cliente T')));
do $$ begin perform public.pagamento_registrar((select id from public.parcelas where contrato_id = pg_temp.cid('Cliente T') and numero = 1), 100);
  perform pg_temp.r('C5. O Recorrente convertido nao recebe mais pagamento', false);
exception when others then perform pg_temp.r('C5. O Recorrente convertido nao recebe mais pagamento', sqlerrm = 'Este contrato não está ativo'); end $$;
reset role;
select pg_temp.r('C6. O agendador nao renova mais o convertido', public.recorrente_renovar_todos() = 0);
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');

-- Parte dos juros (o resto e desconto), semanal
select public.contrato_converter(pg_temp.cid('Cliente P'), 200, 'semanal', 'price', 5, 8, (current_date + 7));
select pg_temp.r('C7. Incluiu so 200 dos 400: contrato novo de 1.200, semanal, 8 parcelas',
  (select capital = 1200 and modalidade = 'semanal' and quantidade_parcelas = 8 from public.contratos where id = pg_temp.novo_de('Cliente P')));

-- Nada dos juros, depois de amortizar 300
select public.amortizacao_registrar(pg_temp.cid('Cliente N'), 300);
select public.contrato_converter(pg_temp.cid('Cliente N'), 0, 'mensal', 'sac', 10, 4, (current_date + interval '1 month')::date);
select pg_temp.r('C8. Amortizou 300 e nao incluiu juros: parcela so os 700',
  (select capital = 700 from public.contratos where id = pg_temp.novo_de('Cliente N')));

-- ===========================================================================
-- Recusas
-- ===========================================================================
do $$ begin perform public.contrato_converter(pg_temp.cid('Cliente D'), 50, 'mensal', 'empresa', 10, 5, (current_date + interval '1 month')::date);
  perform pg_temp.r('C9. Incluir mais juro do que venceu e recusado', false);
exception when others then perform pg_temp.r('C9. Incluir mais juro do que venceu e recusado', sqlerrm like 'Os juros vencidos em aberto são R$ 0.00%'); end $$;
do $$ begin perform public.contrato_converter(pg_temp.cid('Cliente D'), 0, 'recorrente', null, 10, null, (current_date + interval '1 month')::date);
  perform pg_temp.r('C10. Converter pra Recorrente de novo e recusado', false);
exception when others then perform pg_temp.r('C10. Converter pra Recorrente de novo e recusado', sqlerrm = 'Escolha diário, semanal ou mensal'); end $$;
do $$ begin perform public.contrato_converter(pg_temp.cid('Cliente T'), 0, 'mensal', 'empresa', 10, 5, (current_date + interval '1 month')::date);
  perform pg_temp.r('C11. Converter duas vezes e recusado', false);
exception when others then perform pg_temp.r('C11. Converter duas vezes e recusado', sqlerrm = 'Este contrato não está ativo'); end $$;
do $$ begin perform public.contrato_converter(pg_temp.novo_de('Cliente T'), 0, 'mensal', 'empresa', 10, 5, (current_date + interval '1 month')::date);
  perform pg_temp.r('C12. Parcelado nao pode ser convertido', false);
exception when others then perform pg_temp.r('C12. Parcelado nao pode ser convertido', sqlerrm = 'Só o empréstimo Recorrente pode virar parcelado'); end $$;

-- Pagamento parcial de um mes vencido diminui o juro em aberto
select pg_temp.atrasado('Cliente X','153.509.460-56', 4);
reset role;
select public.recorrente_renovar_todos();
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
select public.pagamento_registrar((select id from public.parcelas where contrato_id = pg_temp.cid('Cliente X') and numero = 1), 40);
select pg_temp.r('C13. Pagou 40 de um mes vencido: juro vencido em aberto cai pra 360',
  (pg_temp.prev('Cliente X')->>'juros_vencidos')::numeric = 360);

-- Seguranca
do $$ begin update public.contratos set capital_em_aberto = 0 where id = pg_temp.cid('Cliente X');
  perform pg_temp.r('C14. Usuario nao altera contrato direto (so pelas regras)', false);
exception when others then perform pg_temp.r('C14. Usuario nao altera contrato direto (so pelas regras)', sqlerrm like 'permission denied%'); end $$;

reset role;
insert into auth.users (id, email, aud, role) values ('00000000-0000-0000-0000-0000000000f9','f9@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values ('10000000-0000-0000-0000-0000000000f9','Outra Empresa','outraemp');
insert into public.usuarios (id, tenant_id, papel) values ('00000000-0000-0000-0000-0000000000f9','10000000-0000-0000-0000-0000000000f9','fomentado');
create temp table alvo as select pg_temp.cid('Cliente X') as id;
grant select on alvo to authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000f9');
do $$ begin perform public.contrato_converter((select id from alvo), 0, 'mensal', 'empresa', 10, 5, (current_date + interval '1 month')::date);
  perform pg_temp.r('C15. Outra empresa nao converte contrato que nao e dela', false);
exception when others then perform pg_temp.r('C15. Outra empresa nao converte contrato que nao e dela', sqlerrm = 'Contrato não encontrado'); end $$;
do $$ begin perform public.conversao_previa((select id from alvo));
  perform pg_temp.r('C16. Outra empresa nao ve a previa', false);
exception when others then perform pg_temp.r('C16. Outra empresa nao ve a previa', sqlerrm = 'Contrato não encontrado'); end $$;

rollback;
