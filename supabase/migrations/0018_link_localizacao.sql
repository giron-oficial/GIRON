-- GIRON - 0018: link de NOVA LOCALIZACAO (RN-45). Item 6 do "sistema completo" (16/10/2026).
--  * Na ficha do cliente, o Fomentado aperta "Pedir nova localizacao" e manda o link.
--  * O cliente abre sem login, escreve o nome do local, tira a foto e envia a localizacao GPS.
--  * O link serve SO pra isso, nao mostra nenhum outro dado e perde a validade apos o envio (7 dias no maximo).
--  * A foto vai pro mesmo cofre do cadastro (<tenant_id>/<codigo_do_link>/local.jpg); a regra de envio ja existe (0006).
begin;

-- Fomentado gera o link pra um cliente dele
create or replace function public.link_localizacao_criar(p_cliente_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_escrita();
  v_codigo text;
begin
  if v_tenant is null then
    raise exception 'Sem permissão (conta bloqueada ou usuário sem empresa)' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and tenant_id = v_tenant) then
    raise exception 'Cliente não encontrado' using errcode = 'P0001';
  end if;
  insert into public.links_cliente (tenant_id, tipo, cliente_id) values (v_tenant, 'nova_localizacao', p_cliente_id)
  returning codigo into v_codigo;
  return v_codigo;
end $$;
revoke all on function public.link_localizacao_criar(uuid) from public, anon;
grant execute on function public.link_localizacao_criar(uuid) to authenticated;

-- Cliente envia a localizacao (sem login). Grava no cliente do link e fecha o link.
create or replace function public.link_enviar_localizacao(p_codigo text, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  v_prefixo text;
  v_foto text := nullif(p_dados ->> 'foto', '');
begin
  select * into a from giron_admin.link_aberto(p_codigo);
  if a.link_id is null or a.tipo <> 'nova_localizacao' or a.cliente_id is null then
    raise exception 'Este link não está mais valendo. Peça um novo link.' using errcode = 'P0001';
  end if;
  if p_dados ->> 'latitude' is null or p_dados ->> 'longitude' is null then
    raise exception 'A localização não veio. Toque em "Enviar minha localização" e permita o acesso.' using errcode = 'P0001';
  end if;
  v_prefixo := a.tenant_id::text || '/' || p_codigo || '/';
  if v_foto is not null and left(v_foto, length(v_prefixo)) <> v_prefixo then
    raise exception 'Arquivo inválido' using errcode = 'P0001';
  end if;

  insert into public.cliente_localizacoes (tenant_id, cliente_id, nome, latitude, longitude, precisao_metros, foto_arquivo)
  values (a.tenant_id, a.cliente_id, coalesce(nullif(trim(p_dados ->> 'nome'), ''), 'Novo endereço'),
          (p_dados ->> 'latitude')::numeric, (p_dados ->> 'longitude')::numeric,
          nullif(p_dados ->> 'precisao_metros', '')::numeric, v_foto);

  update public.links_cliente set usado_em = now() where id = a.link_id;
end $$;
revoke all on function public.link_enviar_localizacao(text, jsonb) from public;
grant execute on function public.link_enviar_localizacao(text, jsonb) to anon, authenticated;

-- A pagina publica do link de localizacao mostra tambem o primeiro nome do cliente (so isso), pra ele saber que e dele
create or replace function public.link_info(p_codigo text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('valido', true, 'tipo', a.tipo, 'tenant_id', a.tenant_id,
                               'empresa', f.nome_empresa, 'logo', f.logo_arquivo, 'cor', f.cor_paleta,
                               'primeiro_nome', case when a.tipo = 'nova_localizacao'
                                                     then (select split_part(c.nome_completo, ' ', 1) from public.clientes c where c.id = a.cliente_id) end)
       from giron_admin.link_aberto(p_codigo) a
       join public.fomentados f on f.id = a.tenant_id),
    (select jsonb_build_object('valido', false, 'empresa', f.nome_empresa, 'tipo', l.tipo,
                               'motivo', case when l.usado_em is not null then 'usado'
                                              when l.expira_em <= now() then 'vencido'
                                              else 'indisponivel' end)
       from public.links_cliente l
       join public.fomentados f on f.id = l.tenant_id
      where l.codigo = p_codigo),
    jsonb_build_object('valido', false, 'motivo', 'nao_existe'))
$$;

commit;
