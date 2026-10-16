-- GIRON - testes do link de nova localizacao (RN-45). Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-link-localizacao.sh teste
begin;

insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000c1','c1@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c2','c2@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values
 ('10000000-0000-0000-0000-0000000000c1','Empresa Local A','empresaloca'),
 ('10000000-0000-0000-0000-0000000000c2','Empresa Local B','empresalocb');
insert into public.usuarios (id, tenant_id, papel) values
 ('00000000-0000-0000-0000-0000000000c1','10000000-0000-0000-0000-0000000000c1','fomentado'),
 ('00000000-0000-0000-0000-0000000000c2','10000000-0000-0000-0000-0000000000c2','fomentado');

create function pg_temp.como(u text) returns void language plpgsql as $$ begin
  perform set_config('role', case when u = 'anon' then 'anon' else 'authenticated' end, true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role',case when u='anon' then 'anon' else 'authenticated' end)::text, true);
  perform set_config('request.jwt.claim.sub', u, true);
end $$;
create function pg_temp.r(t text, ok boolean) returns void language plpgsql as $$ begin
  raise notice '%  %', case when ok then 'PASSOU' else 'FALHOU' end, t; end $$;
create function pg_temp.falha(sql text) returns boolean language plpgsql as $$ begin
  execute sql; return false; exception when others then return true; end $$;
create table pg_temp.v (k text primary key, val text);
grant all on pg_temp.v to public;

select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
select public.cliente_criar('Cliente Local','111.444.777-35','63999990011');
insert into pg_temp.v values ('cli', (select id::text from public.clientes where nome_completo = 'Cliente Local'));
insert into pg_temp.v values ('cod', public.link_localizacao_criar((select val::uuid from pg_temp.v where k='cli')));
select pg_temp.r('fomentado gera o link de localizacao do proprio cliente', (select length(val) > 10 from pg_temp.v where k='cod'));
select pg_temp.r('o link fica marcado como nova_localizacao e ligado ao cliente',
  exists (select 1 from public.links_cliente where codigo = (select val from pg_temp.v where k='cod') and tipo = 'nova_localizacao'
            and cliente_id = (select val::uuid from pg_temp.v where k='cli')));

-- outra empresa nao consegue gerar link pra cliente que nao e dela
select pg_temp.como('00000000-0000-0000-0000-0000000000c2');
select pg_temp.r('outra empresa NAO gera link pra cliente alheio',
  pg_temp.falha(format('select public.link_localizacao_criar(%L::uuid)', (select val from pg_temp.v where k='cli'))));

-- cliente (sem login) abre o link
select pg_temp.como('anon');
select pg_temp.r('pagina publica mostra so empresa e primeiro nome',
  (select (public.link_info(val) ->> 'valido')::boolean and public.link_info(val) ->> 'primeiro_nome' = 'Cliente'
      and public.link_info(val) ->> 'tipo' = 'nova_localizacao' from pg_temp.v where k='cod'));
select pg_temp.r('sem latitude/longitude nao aceita',
  pg_temp.falha(format('select public.link_enviar_localizacao(%L, %L::jsonb)', (select val from pg_temp.v where k='cod'), '{"nome":"Casa nova"}')));
select pg_temp.r('foto de outra pasta nao aceita',
  pg_temp.falha(format('select public.link_enviar_localizacao(%L, %L::jsonb)', (select val from pg_temp.v where k='cod'),
    '{"nome":"Casa nova","latitude":-7.19,"longitude":-48.20,"foto":"outra/pasta/x.jpg"}')));
select public.link_enviar_localizacao((select val from pg_temp.v where k='cod'),
  jsonb_build_object('nome','Casa nova','latitude',-7.1912,'longitude',-48.2073,'precisao_metros',12,
                     'foto','10000000-0000-0000-0000-0000000000c1/' || (select val from pg_temp.v where k='cod') || '/local.jpg'));
reset role;
select pg_temp.r('localizacao gravada no cliente certo, com nome, GPS e foto',
  exists (select 1 from public.cliente_localizacoes where cliente_id = (select val::uuid from pg_temp.v where k='cli')
            and nome = 'Casa nova' and latitude = -7.1912 and precisao_metros = 12 and foto_arquivo like '%/local.jpg'));
select pg_temp.r('link fecha depois do envio (motivo usado)',
  (select public.link_info(val) ->> 'motivo' = 'usado' from pg_temp.v where k='cod'));
select pg_temp.como('anon');
select pg_temp.r('enviar de novo pelo mesmo link NAO funciona',
  pg_temp.falha(format('select public.link_enviar_localizacao(%L, %L::jsonb)', (select val from pg_temp.v where k='cod'), '{"latitude":1,"longitude":1}')));

-- link de cadastro nao serve pra localizacao e vice-versa
select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
insert into pg_temp.v values ('cad', public.link_cadastro_criar());
select pg_temp.como('anon');
select pg_temp.r('link de CADASTRO nao aceita envio de localizacao',
  pg_temp.falha(format('select public.link_enviar_localizacao(%L, %L::jsonb)', (select val from pg_temp.v where k='cad'), '{"latitude":1,"longitude":1}')));
select pg_temp.r('link de cadastro nao mostra primeiro_nome',
  (select public.link_info(val) ->> 'primeiro_nome' is null from pg_temp.v where k='cad'));

rollback;
