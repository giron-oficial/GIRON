-- GIRON - 0003: auditoria (quem fez o que)
-- Toda mudanca nas tabelas sensiveis gera um registro automatico com o antes e o depois.
-- O registro e a prova de adulteracao: ninguem altera nem apaga (nem o proprio Fomentado).

begin;

create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_tenant uuid;
begin
  -- nunca guardar o CPF (nem criptografado) no historico
  v_antes  := v_antes  - 'cpf_criptografado' - 'cpf_hash';
  v_depois := v_depois - 'cpf_criptografado' - 'cpf_hash';
  if tg_table_name = 'fomentados' then
    v_tenant := coalesce((v_depois ->> 'id')::uuid, (v_antes ->> 'id')::uuid);
  else
    v_tenant := coalesce((v_depois ->> 'tenant_id')::uuid, (v_antes ->> 'tenant_id')::uuid);
  end if;
  insert into public.auditoria (tenant_id, usuario_id, acao, tabela, registro_id, antes, depois)
  values (v_tenant, auth.uid(), lower(tg_op), tg_table_name,
          coalesce(v_depois ->> 'id', v_antes ->> 'id', v_depois ->> 'tenant_id'), v_antes, v_depois);
  return null;
end $$;
revoke all on function public.auditar() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['fomentados','fomentado_configuracoes','assinaturas','recursos_extras',
    'clientes','contratos','parcelas','pagamentos','chaves_pix']
  loop
    execute format('create trigger auditar after insert or update or delete on public.%I
                    for each row execute function public.auditar()', t);
  end loop;
end $$;

-- Ninguem altera nem apaga registro de auditoria
create or replace function public.auditoria_imutavel() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Registro de auditoria nao pode ser alterado nem apagado';
end $$;
create trigger auditoria_imutavel before update or delete on public.auditoria
  for each row execute function public.auditoria_imutavel();
create trigger auditoria_sem_truncate before truncate on public.auditoria
  for each statement execute function public.auditoria_imutavel();

commit;
