-- GIRON - 0002: seguranca (separacao entre Fomentados, bloqueio, CPF criptografado)
-- Regras (cofre: 05-ARQUITETURA/ISOLAMENTO-ENTRE-FOMENTADOS.md e PERMISSOES-E-AUDITORIA.md):
--  * Cada Fomentado so enxerga e mexe nos proprios dados (Row Level Security por tenant_id).
--  * Bloqueio parcial (RN-02): ve tudo, nao altera nada. Bloqueio total: nao ve nada.
--  * Dono do GIRON: ve e mexe so na parte de assinatura (fomentados, assinaturas, recursos_extras).
--    NAO tem acesso a clientes, emprestimos, pagamentos nem documentos dos Fomentados.
--  * Cliente final nao tem login. Links publicos serao atendidos por funcoes proprias (fase seguinte).

begin;

-- ---------------------------------------------------------------------------
-- Quem e o usuario logado
-- ---------------------------------------------------------------------------

-- Fomentado do usuario logado, se ele puder VER (nao esta em bloqueio total). Senao, nulo.
create or replace function public.meu_tenant_leitura() returns uuid
language sql stable security definer set search_path = '' as $$
  select u.tenant_id
    from public.usuarios u
    join public.fomentados f on f.id = u.tenant_id
   where u.id = auth.uid()
     and u.papel in ('fomentado', 'cobrador')
     and f.status_acesso <> 'bloqueio_total'
$$;

-- Fomentado do usuario logado, se ele puder ALTERAR (em dia e sem bloqueio manual). Senao, nulo.
create or replace function public.meu_tenant_escrita() returns uuid
language sql stable security definer set search_path = '' as $$
  select u.tenant_id
    from public.usuarios u
    join public.fomentados f on f.id = u.tenant_id
   where u.id = auth.uid()
     and u.papel in ('fomentado', 'cobrador')
     and f.status_acesso = 'ativo'
     and not f.bloqueio_manual
$$;

create or replace function public.sou_dono_giron() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios where id = auth.uid() and papel = 'dono_giron')
$$;

revoke all on function public.meu_tenant_leitura(), public.meu_tenant_escrita(), public.sou_dono_giron() from public, anon;
grant execute on function public.meu_tenant_leitura(), public.meu_tenant_escrita(), public.sou_dono_giron() to authenticated;

-- ---------------------------------------------------------------------------
-- Ninguem de fora (anon) acessa tabelas direto. Usuario logado passa pelas regras (RLS).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['fomentados','fomentado_configuracoes','assinaturas','recursos_extras','usuarios',
    'clientes','cliente_arquivos','cliente_localizacoes','links_cliente','contratos','parcelas','pagamentos',
    'chaves_pix','modelos_mensagem','cobrancas_disparadas','auditoria']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Tabelas do dia a dia do Fomentado (dono do GIRON NAO entra aqui)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clientes','cliente_arquivos','cliente_localizacoes','links_cliente','contratos',
    'parcelas','pagamentos','chaves_pix','modelos_mensagem','cobrancas_disparadas']
  loop
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format($p$create policy fomentado_ve on public.%I for select to authenticated
                      using (tenant_id = public.meu_tenant_leitura())$p$, t);
    execute format($p$create policy fomentado_cria on public.%I for insert to authenticated
                      with check (tenant_id = public.meu_tenant_escrita())$p$, t);
    execute format($p$create policy fomentado_altera on public.%I for update to authenticated
                      using (tenant_id = public.meu_tenant_escrita())
                      with check (tenant_id = public.meu_tenant_escrita())$p$, t);
  end loop;
end $$;

-- Apagar: so o que nao e financeiro nem historico (dinheiro nunca e apagado: cancela ou estorna)
do $$
declare t text;
begin
  foreach t in array array['cliente_arquivos','cliente_localizacoes','links_cliente','chaves_pix','modelos_mensagem']
  loop
    execute format('grant delete on public.%I to authenticated', t);
    execute format($p$create policy fomentado_apaga on public.%I for delete to authenticated
                      using (tenant_id = public.meu_tenant_escrita())$p$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Configuracoes do Fomentado
-- ---------------------------------------------------------------------------
grant select, insert, update on public.fomentado_configuracoes to authenticated;
create policy fomentado_ve on public.fomentado_configuracoes for select to authenticated
  using (tenant_id = public.meu_tenant_leitura());
create policy fomentado_cria on public.fomentado_configuracoes for insert to authenticated
  with check (tenant_id = public.meu_tenant_escrita());
create policy fomentado_altera on public.fomentado_configuracoes for update to authenticated
  using (tenant_id = public.meu_tenant_escrita()) with check (tenant_id = public.meu_tenant_escrita());

-- ---------------------------------------------------------------------------
-- Parte da assinatura (dono do GIRON administra; Fomentado so ve a propria)
-- ---------------------------------------------------------------------------
grant select, insert, update on public.fomentados, public.assinaturas, public.recursos_extras to authenticated;

create policy dono_giron_tudo on public.fomentados for all to authenticated
  using (public.sou_dono_giron()) with check (public.sou_dono_giron());
create policy fomentado_ve_o_seu on public.fomentados for select to authenticated
  using (id = public.meu_tenant_leitura());
-- Fomentado pode mudar so a propria marca (nome, logo, cor) - colunas controladas abaixo
create policy fomentado_muda_marca on public.fomentados for update to authenticated
  using (id = public.meu_tenant_escrita()) with check (id = public.meu_tenant_escrita());

create policy dono_giron_tudo on public.assinaturas for all to authenticated
  using (public.sou_dono_giron()) with check (public.sou_dono_giron());
create policy fomentado_ve_as_suas on public.assinaturas for select to authenticated
  using (tenant_id = public.meu_tenant_leitura());

create policy dono_giron_tudo on public.recursos_extras for all to authenticated
  using (public.sou_dono_giron()) with check (public.sou_dono_giron());
create policy fomentado_ve_os_seus on public.recursos_extras for select to authenticated
  using (tenant_id = public.meu_tenant_leitura());

-- Trava de colunas: Fomentado nao pode mexer em status, bloqueio, teste gratis nem endereco
create or replace function public.fomentado_so_muda_marca() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.sou_dono_giron() and current_user = 'authenticated' then
    if new.status_acesso is distinct from old.status_acesso
       or new.bloqueio_manual is distinct from old.bloqueio_manual
       or new.teste_gratis_ate is distinct from old.teste_gratis_ate
       or new.subdominio is distinct from old.subdominio
       or new.id is distinct from old.id then
      raise exception 'Somente o dono do GIRON pode alterar status, bloqueio, teste gratis ou endereco';
    end if;
  end if;
  return new;
end $$;
create trigger fomentado_so_muda_marca before update on public.fomentados
  for each row execute function public.fomentado_so_muda_marca();

-- ---------------------------------------------------------------------------
-- Usuarios: cada um ve o proprio cadastro; dono do GIRON ve todos
-- ---------------------------------------------------------------------------
grant select on public.usuarios to authenticated;
create policy ve_o_proprio on public.usuarios for select to authenticated
  using (id = auth.uid());
create policy dono_giron_ve on public.usuarios for select to authenticated
  using (public.sou_dono_giron());

-- ---------------------------------------------------------------------------
-- Auditoria: Fomentado le a propria; ninguem altera nem apaga (ver 0003)
-- ---------------------------------------------------------------------------
grant select on public.auditoria to authenticated;
create policy fomentado_ve on public.auditoria for select to authenticated
  using (tenant_id = public.meu_tenant_leitura());

-- ---------------------------------------------------------------------------
-- CPF criptografado (chave guardada no Vault do Supabase, nunca no codigo)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'giron_cpf_chave') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'giron_cpf_chave',
                                'Chave de criptografia do CPF dos clientes (GIRON)');
  end if;
end $$;

create or replace function giron_admin.cpf_chave() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'giron_cpf_chave'
$$;
revoke all on function giron_admin.cpf_chave() from public, anon, authenticated;

-- Grava um cliente guardando o CPF criptografado. Usado pelas telas do Fomentado.
create or replace function public.cliente_criar(
  p_nome_completo text, p_cpf text, p_telefone text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_escrita();
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_id uuid;
begin
  if v_tenant is null then
    raise exception 'Sem permissao para cadastrar (conta bloqueada ou usuario sem empresa)';
  end if;
  if length(v_cpf) <> 11 then
    raise exception 'CPF precisa ter 11 numeros';
  end if;
  insert into public.clientes (tenant_id, nome_completo, cpf_criptografado, cpf_final, cpf_hash, telefone)
  values (v_tenant, trim(p_nome_completo),
          extensions.pgp_sym_encrypt(v_cpf, giron_admin.cpf_chave()),
          right(v_cpf, 4),
          encode(extensions.hmac(v_cpf, giron_admin.cpf_chave(), 'sha256'), 'hex'),
          trim(p_telefone))
  returning id into v_id;
  return v_id;
end $$;

-- Mostra o CPF completo de um cliente - so para o Fomentado dono desse cliente
create or replace function public.cliente_cpf(p_cliente_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select extensions.pgp_sym_decrypt(c.cpf_criptografado, giron_admin.cpf_chave())
    from public.clientes c
   where c.id = p_cliente_id
     and c.tenant_id = public.meu_tenant_leitura()
$$;

revoke all on function public.cliente_criar(text, text, text), public.cliente_cpf(uuid) from public, anon;
grant execute on function public.cliente_criar(text, text, text), public.cliente_cpf(uuid) to authenticated;

-- A coluna do CPF criptografado e o hash nao saem pela API (so pela funcao cliente_cpf)
revoke select on public.clientes from authenticated;
grant select (id, tenant_id, nome_completo, cpf_final, telefone, endereco, cep, trabalho_empresa,
              trabalho_endereco, trabalho_telefone, trabalho_referencia, indicado_por, valor_pretendido,
              modalidade_preferida, dia_vencimento_preferido, status_cadastro, termometro_nivel,
              consentimento_lgpd_em, criado_em, atualizado_em)
  on public.clientes to authenticated;
revoke insert on public.clientes from authenticated;  -- cliente novo so pela funcao cliente_criar
-- Alterar: todas as colunas menos tenant e CPF (trocar CPF sera funcao propria, se um dia precisar)
revoke update on public.clientes from authenticated;
grant update (nome_completo, telefone, endereco, cep, trabalho_empresa, trabalho_endereco, trabalho_telefone,
              trabalho_referencia, indicado_por, valor_pretendido, modalidade_preferida,
              dia_vencimento_preferido, status_cadastro, termometro_nivel, consentimento_lgpd_em)
  on public.clientes to authenticated;

commit;
