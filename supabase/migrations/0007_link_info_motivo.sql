-- GIRON - 0007: pagina do link explica POR QUE o link nao vale mais
-- (ja enviado x vencido), pra o cliente nao achar que deu erro.

begin;

create or replace function public.link_info(p_codigo text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('valido', true, 'tipo', a.tipo, 'tenant_id', a.tenant_id,
                               'empresa', f.nome_empresa, 'logo', f.logo_arquivo, 'cor', f.cor_paleta)
       from giron_admin.link_aberto(p_codigo) a
       join public.fomentados f on f.id = a.tenant_id),
    (select jsonb_build_object('valido', false, 'empresa', f.nome_empresa,
                               'motivo', case when l.usado_em is not null then 'usado'
                                              when l.expira_em <= now() then 'vencido'
                                              else 'indisponivel' end)
       from public.links_cliente l
       join public.fomentados f on f.id = l.tenant_id
      where l.codigo = p_codigo),
    jsonb_build_object('valido', false, 'motivo', 'nao_existe'))
$$;

commit;
