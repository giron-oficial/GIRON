-- GIRON - testes do numero do cliente (#0001, #0002...). Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-cliente-numero.sh teste
begin;

insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','a1@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b1','b1@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values
 ('10000000-0000-0000-0000-0000000000a1','Empresa Numero A','empresanuma'),
 ('10000000-0000-0000-0000-0000000000b1','Empresa Numero B','empresanumb');
insert into public.usuarios (id, tenant_id, papel) values
 ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000a1','fomentado'),
 ('00000000-0000-0000-0000-0000000000b1','10000000-0000-0000-0000-0000000000b1','fomentado');

create function pg_temp.como(u text) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u, true);
end $$;
create function pg_temp.r(t text, ok boolean) returns void language plpgsql as $$ begin
  raise notice '%  %', case when ok then 'PASSOU' else 'FALHOU' end, t; end $$;
create function pg_temp.num(nome text) returns int language sql as $$
  select numero from public.clientes where nome_completo = nome $$;
create function pg_temp.falha(sql text) returns boolean language plpgsql as $$ begin
  execute sql; return false; exception when others then return true; end $$;

-- Clientes que ja existiam: todos com numero, sem buraco nem repeticao em cada empresa
select pg_temp.r('clientes antigos: todos numerados de 1 em diante, sem repetir',
  not exists (select 1 from (select tenant_id, numero, row_number() over (partition by tenant_id order by numero) n
                               from public.clientes) x where x.numero <> x.n));

select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select public.cliente_criar('Numero A1','111.444.777-35','63999990001');
select public.cliente_criar('Numero A2',null,'63999990002');
select public.cliente_criar('Numero A3',null,'63999990003');
select pg_temp.r('empresa A: primeiro cliente e o #1', pg_temp.num('Numero A1') = 1);
select pg_temp.r('empresa A: terceiro cliente e o #3', pg_temp.num('Numero A3') = 3);

select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
select public.cliente_criar('Numero B1',null,'63999990004');
select pg_temp.r('empresa B tem contagem propria (comeca no #1)', pg_temp.num('Numero B1') = 1);

select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select pg_temp.r('a tela nao consegue trocar o numero',
  pg_temp.falha($q$update public.clientes set numero = 99 where nome_completo = 'Numero A2'$q$));
update public.clientes set telefone = '63988887777' where nome_completo = 'Numero A2';
select pg_temp.r('alterar outro dado nao mexe no numero', pg_temp.num('Numero A2') = 2);
select pg_temp.r('a tela nao consegue mexer no contador da empresa',
  pg_temp.falha($q$update public.fomentados set ultimo_numero_cliente = 0 where id = '10000000-0000-0000-0000-0000000000a1'$q$));
select pg_temp.r('a tela consegue ler o numero',
  (select numero from public.clientes where nome_completo = 'Numero A3') = 3);

-- Cliente apagado: o numero dele nao volta
reset role;
delete from public.clientes where nome_completo = 'Numero A3';
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select public.cliente_criar('Numero A4',null,'63999990005');
select pg_temp.r('numero de cliente apagado nao e reaproveitado (proximo e #4)', pg_temp.num('Numero A4') = 4);

-- Cadastro pelo link tambem ganha numero
reset role;
insert into public.clientes (tenant_id, nome_completo, cpf_criptografado, cpf_final, cpf_hash, telefone)
values ('10000000-0000-0000-0000-0000000000a1','Numero Link','\x00','0000','hash-teste-link','63999990006');
select pg_temp.r('cliente que entra por fora da tela tambem ganha o proximo (#5)', pg_temp.num('Numero Link') = 5);

rollback;
