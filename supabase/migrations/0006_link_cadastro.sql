-- GIRON - 0006: link de cadastro que o cliente preenche sozinho (RN-30 a RN-46)
--  * O Fomentado gera um link de uso unico (valido 7 dias).
--  * O cliente abre sem login, preenche dados, manda fotos/documentos e a localizacao GPS.
--  * O cadastro chega como "pendente" pro Fomentado aprovar.
--  * Fotos e documentos vao pro "cofre" (bucket privado "clientes"), numa pasta so do Fomentado.
--    Caminho dos arquivos: <tenant_id>/<codigo_do_link>/<arquivo>

begin;

-- ---------------------------------------------------------------------------
-- Cofre de arquivos (privado). Ate 20 MB por arquivo; so imagem e PDF.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clientes', 'clientes', false, 20 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

-- Link ainda aceita envio? (existe, nao usado, nao vencido, empresa sem bloqueio)
create or replace function giron_admin.link_aberto(p_codigo text)
returns table (link_id uuid, tenant_id uuid, tipo public.tipo_link, cliente_id uuid)
language sql stable security definer set search_path = '' as $$
  select l.id, l.tenant_id, l.tipo, l.cliente_id
    from public.links_cliente l
    join public.fomentados f on f.id = l.tenant_id
   where l.codigo = p_codigo
     and l.usado_em is null
     and l.expira_em > now()
     and f.status_acesso = 'ativo' and not f.bloqueio_manual
$$;
revoke all on function giron_admin.link_aberto(text) from public, anon, authenticated;

create or replace function giron_admin.pode_enviar_arquivo(p_caminho text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from giron_admin.link_aberto(split_part(p_caminho, '/', 2)) a
     where a.tenant_id::text = split_part(p_caminho, '/', 1)
  )
$$;
revoke all on function giron_admin.pode_enviar_arquivo(text) from public;
grant usage on schema giron_admin to anon, authenticated;
grant execute on function giron_admin.pode_enviar_arquivo(text) to anon, authenticated;

-- Quem esta com um link valido pode MANDAR arquivo (nao pode ver, trocar nem apagar)
create policy giron_link_envia on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'clientes' and giron_admin.pode_enviar_arquivo(name));

-- O Fomentado ve so os arquivos da propria empresa
create policy giron_fomentado_ve on storage.objects for select to authenticated
  using (bucket_id = 'clientes' and split_part(name, '/', 1) = public.meu_tenant_leitura()::text);

-- ---------------------------------------------------------------------------
-- Fomentado gera o link de cadastro
-- ---------------------------------------------------------------------------
create or replace function public.link_cadastro_criar() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_escrita();
  v_codigo text;
begin
  if v_tenant is null then
    raise exception 'Sem permissão (conta bloqueada ou usuário sem empresa)' using errcode = 'P0001';
  end if;
  insert into public.links_cliente (tenant_id, tipo) values (v_tenant, 'cadastro') returning codigo into v_codigo;
  return v_codigo;
end $$;
revoke all on function public.link_cadastro_criar() from public, anon;
grant execute on function public.link_cadastro_criar() to authenticated;

-- ---------------------------------------------------------------------------
-- Pagina publica: o que o cliente pode ver do link (so o nome da empresa)
-- ---------------------------------------------------------------------------
create or replace function public.link_info(p_codigo text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('valido', true, 'tipo', a.tipo, 'tenant_id', a.tenant_id,
                               'empresa', f.nome_empresa, 'logo', f.logo_arquivo, 'cor', f.cor_paleta)
       from giron_admin.link_aberto(p_codigo) a
       join public.fomentados f on f.id = a.tenant_id),
    jsonb_build_object('valido', false))
$$;
revoke all on function public.link_info(text) from public;
grant execute on function public.link_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cliente envia o cadastro (sem login). Cria o cliente "pendente" e fecha o link.
-- ---------------------------------------------------------------------------
create or replace function public.link_enviar_cadastro(p_codigo text, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  v_cpf text := regexp_replace(coalesce(p_dados ->> 'cpf', ''), '[^0-9]', '', 'g');
  v_tel text := regexp_replace(coalesce(p_dados ->> 'telefone', ''), '[^0-9]', '', 'g');
  v_nome text := trim(coalesce(p_dados ->> 'nome_completo', ''));
  v_cliente uuid;
  v_arq jsonb;
  v_loc jsonb := p_dados -> 'localizacao';
  v_prefixo text;
begin
  select * into a from giron_admin.link_aberto(p_codigo);
  if a.link_id is null or a.tipo <> 'cadastro' then
    raise exception 'Este link não está mais valendo. Peça um novo link.' using errcode = 'P0001';
  end if;
  v_prefixo := a.tenant_id::text || '/' || p_codigo || '/';

  if length(v_nome) < 3 then raise exception 'Informe o nome completo' using errcode = 'P0001'; end if;
  if not public.cpf_valido(v_cpf) then raise exception 'CPF inválido' using errcode = 'P0001'; end if;
  if length(v_tel) not between 10 and 13 then raise exception 'Telefone inválido (use DDD + número)' using errcode = 'P0001'; end if;
  if coalesce((p_dados ->> 'consentimento')::boolean, false) is not true then
    raise exception 'É preciso autorizar o uso dos dados' using errcode = 'P0001';
  end if;

  begin
    insert into public.clientes (
      tenant_id, nome_completo, cpf_criptografado, cpf_final, cpf_hash, telefone,
      endereco, cep, trabalho_empresa, trabalho_endereco, trabalho_telefone, trabalho_referencia,
      indicado_por, valor_pretendido, modalidade_preferida, dia_vencimento_preferido,
      status_cadastro, consentimento_lgpd_em)
    values (
      a.tenant_id, v_nome,
      extensions.pgp_sym_encrypt(v_cpf, giron_admin.cpf_chave()), right(v_cpf, 4),
      encode(extensions.hmac(v_cpf, giron_admin.cpf_chave(), 'sha256'), 'hex'), v_tel,
      nullif(trim(p_dados ->> 'endereco'), ''), nullif(regexp_replace(coalesce(p_dados ->> 'cep', ''), '[^0-9]', '', 'g'), ''),
      nullif(trim(p_dados ->> 'trabalho_empresa'), ''), nullif(trim(p_dados ->> 'trabalho_endereco'), ''),
      nullif(regexp_replace(coalesce(p_dados ->> 'trabalho_telefone', ''), '[^0-9]', '', 'g'), ''),
      nullif(trim(p_dados ->> 'trabalho_referencia'), ''), nullif(trim(p_dados ->> 'indicado_por'), ''),
      nullif(p_dados ->> 'valor_pretendido', '')::numeric,
      nullif(p_dados ->> 'modalidade_preferida', '')::public.modalidade,
      nullif(p_dados ->> 'dia_vencimento_preferido', '')::smallint,
      'pendente', now())
    returning id into v_cliente;
  exception when unique_violation then
    raise exception 'Este CPF já está cadastrado nesta empresa. Fale com quem te mandou o link.' using errcode = 'P0001';
  end;

  -- arquivos: so aceita caminhos da pasta deste link
  for v_arq in select * from jsonb_array_elements(coalesce(p_dados -> 'arquivos', '[]'::jsonb)) loop
    if left(v_arq ->> 'caminho', length(v_prefixo)) <> v_prefixo then
      raise exception 'Arquivo inválido' using errcode = 'P0001';
    end if;
    insert into public.cliente_arquivos (tenant_id, cliente_id, tipo, caminho_arquivo)
    values (a.tenant_id, v_cliente, (v_arq ->> 'tipo')::public.tipo_arquivo, v_arq ->> 'caminho');
  end loop;

  -- localizacao GPS (opcional - RN-43)
  if v_loc is not null and v_loc ->> 'latitude' is not null then
    if v_loc ->> 'foto' is not null and left(v_loc ->> 'foto', length(v_prefixo)) <> v_prefixo then
      raise exception 'Arquivo inválido' using errcode = 'P0001';
    end if;
    insert into public.cliente_localizacoes (tenant_id, cliente_id, nome, latitude, longitude, precisao_metros, foto_arquivo)
    values (a.tenant_id, v_cliente, coalesce(nullif(trim(v_loc ->> 'nome'), ''), 'Minha casa'),
            (v_loc ->> 'latitude')::numeric, (v_loc ->> 'longitude')::numeric,
            nullif(v_loc ->> 'precisao_metros', '')::numeric, v_loc ->> 'foto');
  end if;

  update public.links_cliente set usado_em = now(), cliente_id = v_cliente where id = a.link_id;
end $$;
revoke all on function public.link_enviar_cadastro(text, jsonb) from public;
grant execute on function public.link_enviar_cadastro(text, jsonb) to anon, authenticated;

commit;
