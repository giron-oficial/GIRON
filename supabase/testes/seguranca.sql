-- GIRON - testes de seguranca do banco. Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-seguranca.sh teste
begin;

insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-00000000000a','a@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000000b','b@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000000d','dono@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values
 ('10000000-0000-0000-0000-00000000000a','Empresa A','empresaa'),
 ('10000000-0000-0000-0000-00000000000b','Empresa B','empresab');
insert into public.usuarios (id, tenant_id, papel) values
 ('00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','fomentado'),
 ('00000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000b','fomentado'),
 ('00000000-0000-0000-0000-00000000000d',null,'dono_giron');

create function pg_temp.como(u text) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u, true);
end $$;
create function pg_temp.r(t text, ok boolean) returns void language plpgsql as $$ begin
  raise notice '%  %', case when ok then 'PASSOU' else 'FALHOU' end, t; end $$;

-- A cadastra um cliente
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select public.cliente_criar('Maria Souza','123.456.789-09','63999990000');
select pg_temp.r('1. A ve o proprio cliente', (select count(*) from public.clientes)=1);
select pg_temp.r('2. A le o CPF completo do proprio cliente', public.cliente_cpf((select id from public.clientes limit 1))='12345678909');
reset role;

-- B nao ve nada de A
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select pg_temp.r('3. B NAO ve cliente de A', (select count(*) from public.clientes)=0);
select pg_temp.r('4. B NAO le CPF de cliente de A', public.cliente_cpf((select id from public.clientes limit 1)) is null);
select pg_temp.r('5. B ve so a propria empresa', (select count(*) from public.fomentados)=1);
do $$ begin
  insert into public.chaves_pix (tenant_id, numero, tipo, chave) values ('10000000-0000-0000-0000-00000000000a',1,'cpf','x');
  perform pg_temp.r('6. B NAO grava na empresa de A', false);
exception when others then perform pg_temp.r('6. B NAO grava na empresa de A', true); end $$;
do $$ begin
  update public.fomentados set status_acesso='ativo', subdominio='outro' where id='10000000-0000-0000-0000-00000000000b';
  perform pg_temp.r('7. Fomentado NAO muda o proprio status/endereco', false);
exception when others then perform pg_temp.r('7. Fomentado NAO muda o proprio status/endereco', true); end $$;
reset role;

-- CPF nao sai pela consulta direta
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
do $$ begin
  perform cpf_criptografado from public.clientes;
  perform pg_temp.r('8. CPF criptografado NAO sai pela consulta direta', false);
exception when insufficient_privilege then perform pg_temp.r('8. CPF criptografado NAO sai pela consulta direta', true); end $$;
reset role;

-- Dono do GIRON: ve empresas, NAO ve clientes
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
select pg_temp.r('9. Dono do GIRON ve as 2 empresas', (select count(*) from public.fomentados)=2);
select pg_temp.r('10. Dono do GIRON NAO ve clientes dos Fomentados', (select count(*) from public.clientes)=0);
reset role;

-- Visitante sem login
set local role anon;
do $$ begin perform 1 from public.clientes; perform pg_temp.r('11. Visitante sem login NAO acessa', false);
exception when insufficient_privilege then perform pg_temp.r('11. Visitante sem login NAO acessa', true); end $$;
reset role;

-- Bloqueio parcial: ve, nao altera
update public.fomentados set status_acesso='bloqueio_parcial' where id='10000000-0000-0000-0000-00000000000a';
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select pg_temp.r('12. Bloqueio parcial: ainda VE os clientes', (select count(*) from public.clientes)=1);
do $$ begin perform public.cliente_criar('Joao','98765432100','63988880000'); perform pg_temp.r('13. Bloqueio parcial: NAO cadastra', false);
exception when others then perform pg_temp.r('13. Bloqueio parcial: NAO cadastra', true); end $$;
reset role;

-- Bloqueio total: nao ve nada
update public.fomentados set status_acesso='bloqueio_total' where id='10000000-0000-0000-0000-00000000000a';
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select pg_temp.r('14. Bloqueio total: NAO ve nada', (select count(*) from public.clientes)=0);
reset role;

-- Auditoria
select pg_temp.r('15. Auditoria registrou e sem CPF', (select count(*) from public.auditoria where tabela='clientes' and not (depois ? 'cpf_criptografado'))>=1);
do $$ begin delete from public.auditoria; perform pg_temp.r('16. Auditoria NAO pode ser apagada', false);
exception when others then perform pg_temp.r('16. Auditoria NAO pode ser apagada', true); end $$;

-- Regras de campo
do $$ begin insert into public.fomentados (nome_empresa, subdominio) values ('X','Carlos1'); perform pg_temp.r('17. Endereco com maiuscula/numero e recusado', false);
exception when check_violation then perform pg_temp.r('17. Endereco com maiuscula/numero e recusado', true); end $$;
do $$ begin insert into public.fomentados (nome_empresa, subdominio) values ('X','teste'); perform pg_temp.r('18. Nome reservado e recusado', false);
exception when check_violation then perform pg_temp.r('18. Nome reservado e recusado', true); end $$;

rollback;
