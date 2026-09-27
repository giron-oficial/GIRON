-- GIRON - 0005: cliente pode ser cadastrado SEM CPF (decisao do dono em 27/09/2026)
-- Motivo: clientes antigos migrados nao tem CPF. O sistema NAO inventa numero (poderia ser o CPF
-- de outra pessoa): o CPF fica vazio ("SEM CPF") e pode ser completado depois na ficha.
-- Obrigatorios passam a ser: nome completo e telefone. Se o CPF for informado, continua conferido.

begin;

alter table public.clientes
  alter column cpf_criptografado drop not null,
  alter column cpf_final drop not null,
  alter column cpf_hash drop not null,
  add constraint clientes_cpf_tudo_ou_nada check (
    (cpf_criptografado is null) = (cpf_final is null) and (cpf_final is null) = (cpf_hash is null)
  );

create or replace function public.cliente_criar(
  p_nome_completo text, p_cpf text, p_telefone text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_escrita();
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'), '');
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g');
  v_id uuid;
begin
  if v_tenant is null then
    raise exception 'Sem permissão para cadastrar (conta bloqueada ou usuário sem empresa)' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_nome_completo, ''))) < 3 then
    raise exception 'Informe o nome completo' using errcode = 'P0001';
  end if;
  if v_cpf is not null and not public.cpf_valido(v_cpf) then
    raise exception 'CPF inválido' using errcode = 'P0001';
  end if;
  if length(v_tel) not between 10 and 13 then
    raise exception 'Telefone inválido (use DDD + número)' using errcode = 'P0001';
  end if;
  begin
    insert into public.clientes (tenant_id, nome_completo, cpf_criptografado, cpf_final, cpf_hash, telefone, status_cadastro)
    values (v_tenant, trim(p_nome_completo),
            case when v_cpf is not null then extensions.pgp_sym_encrypt(v_cpf, giron_admin.cpf_chave()) end,
            right(v_cpf, 4),
            case when v_cpf is not null then encode(extensions.hmac(v_cpf, giron_admin.cpf_chave(), 'sha256'), 'hex') end,
            v_tel, 'aprovado')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe um cliente com esse CPF' using errcode = 'P0001';
  end;
  return v_id;
end $$;

-- Completar o CPF de quem foi cadastrado sem (so se ainda estiver vazio)
create or replace function public.cliente_definir_cpf(p_cliente_id uuid, p_cpf text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_escrita();
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
begin
  if v_tenant is null then
    raise exception 'Sem permissão (conta bloqueada ou usuário sem empresa)' using errcode = 'P0001';
  end if;
  if not public.cpf_valido(v_cpf) then
    raise exception 'CPF inválido' using errcode = 'P0001';
  end if;
  begin
    update public.clientes
       set cpf_criptografado = extensions.pgp_sym_encrypt(v_cpf, giron_admin.cpf_chave()),
           cpf_final = right(v_cpf, 4),
           cpf_hash = encode(extensions.hmac(v_cpf, giron_admin.cpf_chave(), 'sha256'), 'hex')
     where id = p_cliente_id and tenant_id = v_tenant and cpf_final is null;
  exception when unique_violation then
    raise exception 'Já existe um cliente com esse CPF' using errcode = 'P0001';
  end;
  if not found then
    raise exception 'Cliente não encontrado ou já tem CPF' using errcode = 'P0001';
  end if;
end $$;

revoke all on function public.cliente_definir_cpf(uuid, text) from public, anon;
grant execute on function public.cliente_definir_cpf(uuid, text) to authenticated;

commit;
