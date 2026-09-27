-- GIRON - 0004: cadastro de cliente pelo Fomentado
--  * Confere os digitos verificadores do CPF (nao aceita CPF inventado).
--  * Cliente cadastrado a mao pelo proprio Fomentado ja nasce "aprovado"
--    (o cadastro pelo link do cliente, que chega "pendente", tera funcao propria).
--  * Mensagem clara quando o CPF ja esta cadastrado.

begin;

create or replace function public.cpf_valido(p_cpf text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  d text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  soma int; resto int; i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  soma := 0;
  for i in 1..9 loop soma := soma + substr(d, i, 1)::int * (11 - i); end loop;
  resto := (soma * 10) % 11; if resto = 10 then resto := 0; end if;
  if resto <> substr(d, 10, 1)::int then return false; end if;
  soma := 0;
  for i in 1..10 loop soma := soma + substr(d, i, 1)::int * (12 - i); end loop;
  resto := (soma * 10) % 11; if resto = 10 then resto := 0; end if;
  return resto = substr(d, 11, 1)::int;
end $$;

drop function if exists public.cliente_criar(text, text, text);

create or replace function public.cliente_criar(
  p_nome_completo text, p_cpf text, p_telefone text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_escrita();
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g');
  v_id uuid;
begin
  if v_tenant is null then
    raise exception 'Sem permissão para cadastrar (conta bloqueada ou usuário sem empresa)' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_nome_completo, ''))) < 3 then
    raise exception 'Informe o nome completo' using errcode = 'P0001';
  end if;
  if not public.cpf_valido(v_cpf) then
    raise exception 'CPF inválido' using errcode = 'P0001';
  end if;
  if length(v_tel) not between 10 and 13 then
    raise exception 'Telefone inválido (use DDD + número)' using errcode = 'P0001';
  end if;
  begin
    insert into public.clientes (tenant_id, nome_completo, cpf_criptografado, cpf_final, cpf_hash, telefone, status_cadastro)
    values (v_tenant, trim(p_nome_completo),
            extensions.pgp_sym_encrypt(v_cpf, giron_admin.cpf_chave()),
            right(v_cpf, 4),
            encode(extensions.hmac(v_cpf, giron_admin.cpf_chave(), 'sha256'), 'hex'),
            v_tel, 'aprovado')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe um cliente com esse CPF' using errcode = 'P0001';
  end;
  return v_id;
end $$;

revoke all on function public.cliente_criar(text, text, text) from public, anon;
grant execute on function public.cliente_criar(text, text, text) to authenticated;
grant execute on function public.cpf_valido(text) to authenticated;

commit;
