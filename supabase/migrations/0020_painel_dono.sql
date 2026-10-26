-- GIRON - 0020: Painel do Dono (o dono do GIRON acompanha as financeiras que assinam o sistema)
-- Regras do dono (cofre: 03-DECISOES/REGISTRO-DE-DECISOES.md, 26/10/2026):
--  * Ao cadastrar, a financeira ganha 15 dias gratis de TUDO. Acabou o teste sem pagar: bloqueio total.
--  * Depois de pago: 3 dias de atraso = bloqueio parcial (so consulta); 4 dias ou mais = bloqueio total.
--  * O dono sempre pode liberar na mao (liberado_manual_ate) ou dar mais dias de teste.
--  * Cobrancas: mensalidade (R$ 69,90 sem robo / R$ 89,90 com robo) e implantacao (R$ 800,00 em ate 10x).
--  * Pagou a mensalidade: a proxima ja nasce sozinha (mesmo dia, mes seguinte).
--  * O dono continua SEM acesso aos clientes das financeiras: so ve numeros (quantos clientes, contratos, ultimo acesso).

begin;

-- ---------------------------------------------------------------------------
-- Dados novos da financeira e das cobrancas
-- ---------------------------------------------------------------------------
alter table public.fomentados
  add column mensalidade_valor   numeric(14,2) not null default 69.90 check (mensalidade_valor >= 0),
  add column liberado_manual_ate date,
  add column responsavel_nome    text,
  add column telefone            text,
  add column observacao_dono     text;

alter table public.fomentados alter column teste_gratis_ate set default current_date + 15;

alter table public.assinaturas
  add column tipo           text not null default 'mensalidade' check (tipo in ('mensalidade', 'implantacao')),
  add column parcela        smallint check (parcela >= 1),
  add column parcelas_total smallint check (parcelas_total >= 1);

create index assinaturas_tenant_vencimento on public.assinaturas (tenant_id, vencimento);

-- A financeira nao mexe no preco nem na liberacao manual (so o dono do GIRON)
create or replace function public.fomentado_so_muda_marca() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.ultimo_numero_cliente is distinct from old.ultimo_numero_cliente then
    raise exception 'O contador de numero de cliente nao pode ser alterado';
  end if;
  if not public.sou_dono_giron() and current_user = 'authenticated' then
    if new.status_acesso is distinct from old.status_acesso
       or new.bloqueio_manual is distinct from old.bloqueio_manual
       or new.teste_gratis_ate is distinct from old.teste_gratis_ate
       or new.subdominio is distinct from old.subdominio
       or new.mensalidade_valor is distinct from old.mensalidade_valor
       or new.liberado_manual_ate is distinct from old.liberado_manual_ate
       or new.responsavel_nome is distinct from old.responsavel_nome
       or new.telefone is distinct from old.telefone
       or new.observacao_dono is distinct from old.observacao_dono
       or new.id is distinct from old.id then
      raise exception 'Somente o dono do GIRON pode alterar status, bloqueio, teste gratis, mensalidade ou endereco';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Situacao de acesso (ativo / bloqueio parcial / bloqueio total), calculada pelas regras
-- ---------------------------------------------------------------------------
create or replace function giron_admin.situacao_calcular(p_tenant uuid) returns public.status_acesso
language sql stable set search_path = '' as $$
  select case
    when f.liberado_manual_ate >= current_date then 'ativo'
    when f.teste_gratis_ate is not null then
      case when current_date > f.teste_gratis_ate then 'bloqueio_total' else 'ativo' end
    else coalesce((
      select case when current_date - min(a.vencimento) >= 4 then 'bloqueio_total'
                  when current_date - min(a.vencimento) >= 3 then 'bloqueio_parcial'
                  else 'ativo' end
        from public.assinaturas a
       where a.tenant_id = f.id and a.pago_em is null and a.vencimento < current_date), 'ativo')
  end::public.status_acesso
  from public.fomentados f where f.id = p_tenant
$$;

create or replace function giron_admin.situacao_atualizar(p_tenant uuid) returns public.status_acesso
language plpgsql set search_path = '' as $$
declare v public.status_acesso := giron_admin.situacao_calcular(p_tenant);
begin
  update public.fomentados set status_acesso = v, atualizado_em = now()
   where id = p_tenant and status_acesso is distinct from v;
  return v;
end $$;

-- Roda todo dia de madrugada (e quando o dono mexe em alguma coisa)
create or replace function giron_admin.situacao_atualizar_todas() returns integer
language plpgsql set search_path = '' as $$
declare r record; n integer := 0; v public.status_acesso;
begin
  for r in select id, status_acesso from public.fomentados loop
    v := giron_admin.situacao_atualizar(r.id);
    if v is distinct from r.status_acesso then n := n + 1; end if;
  end loop;
  return n;
end $$;

revoke all on function giron_admin.situacao_calcular(uuid), giron_admin.situacao_atualizar(uuid),
  giron_admin.situacao_atualizar_todas() from public, anon, authenticated;

select cron.schedule('giron-situacao-financeiras', '10 3 * * *', 'select giron_admin.situacao_atualizar_todas()');

-- ---------------------------------------------------------------------------
-- Acoes do dono do GIRON (cada uma confere se quem chamou e o dono)
-- ---------------------------------------------------------------------------
create or replace function giron_admin.exigir_dono() returns void
language plpgsql stable set search_path = '' as $$
begin
  if not public.sou_dono_giron() then raise exception 'Somente o dono do GIRON'; end if;
end $$;
revoke all on function giron_admin.exigir_dono() from public, anon, authenticated;

-- Comecar a cobrar: grava o preco, a 1a mensalidade e as parcelas da implantacao (uma por mes)
create or replace function public.dono_comecar_cobranca(
  p_tenant uuid, p_mensalidade numeric, p_primeiro_vencimento date,
  p_implantacao numeric default 0, p_parcelas integer default 1, p_implantacao_vencimento date default null,
  p_com_robo boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare i integer; v_parcela numeric(14,2); v_venc date := coalesce(p_implantacao_vencimento, p_primeiro_vencimento);
begin
  perform giron_admin.exigir_dono();
  if not exists (select 1 from public.fomentados where id = p_tenant) then raise exception 'Financeira nao encontrada'; end if;
  if exists (select 1 from public.assinaturas where tenant_id = p_tenant) then
    raise exception 'Essa financeira ja tem cobranca comecada';
  end if;
  if p_mensalidade is null or p_mensalidade <= 0 then raise exception 'Informe o valor da mensalidade'; end if;
  if p_primeiro_vencimento is null then raise exception 'Informe o primeiro vencimento'; end if;
  if p_implantacao < 0 or p_parcelas < 1 or p_parcelas > 24 then raise exception 'Implantacao invalida'; end if;

  update public.fomentados set mensalidade_valor = p_mensalidade, atualizado_em = now() where id = p_tenant;

  insert into public.assinaturas (tenant_id, tipo, vencimento, valor)
  values (p_tenant, 'mensalidade', p_primeiro_vencimento, p_mensalidade);

  if p_implantacao > 0 then
    v_parcela := trunc(p_implantacao / p_parcelas, 2);
    for i in 1..p_parcelas loop
      insert into public.assinaturas (tenant_id, tipo, vencimento, valor, parcela, parcelas_total)
      values (p_tenant, 'implantacao', (v_venc + make_interval(months => i - 1))::date,
              -- a ultima parcela leva os centavos que sobraram da divisao
              case when i = p_parcelas then p_implantacao - v_parcela * (p_parcelas - 1) else v_parcela end,
              i, p_parcelas);
    end loop;
  end if;

  insert into public.recursos_extras (tenant_id, recurso, liberado)
  values (p_tenant, 'agente_telegram', p_com_robo)
  on conflict (tenant_id, recurso) do update set liberado = excluded.liberado, liberado_ate = null, atualizado_em = now();
end $$;

-- Recebi o pagamento: marca pago, acaba o teste, cria a proxima mensalidade e libera o acesso
create or replace function public.dono_receber(p_assinatura uuid, p_pago_em date default current_date) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.assinaturas;
begin
  perform giron_admin.exigir_dono();
  select * into a from public.assinaturas where id = p_assinatura for update;
  if a.id is null then raise exception 'Cobranca nao encontrada'; end if;
  if a.pago_em is not null then raise exception 'Essa cobranca ja foi recebida'; end if;

  update public.assinaturas set pago_em = coalesce(p_pago_em, current_date), atualizado_em = now() where id = a.id;
  update public.fomentados set teste_gratis_ate = null, atualizado_em = now()
   where id = a.tenant_id and teste_gratis_ate is not null;

  if a.tipo = 'mensalidade' and not exists (
    select 1 from public.assinaturas where tenant_id = a.tenant_id and tipo = 'mensalidade' and vencimento > a.vencimento
  ) then
    insert into public.assinaturas (tenant_id, tipo, vencimento, valor)
    select a.tenant_id, 'mensalidade', (a.vencimento + interval '1 month')::date, f.mensalidade_valor
      from public.fomentados f where f.id = a.tenant_id;
  end if;

  perform giron_admin.situacao_atualizar(a.tenant_id);
end $$;

-- Desfazer um recebimento marcado por engano (a mensalidade seguinte, se ja nasceu, fica)
create or replace function public.dono_desfazer_recebimento(p_assinatura uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  perform giron_admin.exigir_dono();
  update public.assinaturas set pago_em = null, atualizado_em = now()
   where id = p_assinatura and pago_em is not null returning tenant_id into v_tenant;
  if v_tenant is null then raise exception 'Cobranca nao encontrada ou ainda nao recebida'; end if;
  perform giron_admin.situacao_atualizar(v_tenant);
end $$;

-- Mais dias de teste (conta a partir de hoje ou do fim do teste atual, o que for mais tarde)
create or replace function public.dono_estender_teste(p_tenant uuid, p_dias integer) returns date
language plpgsql security definer set search_path = '' as $$
declare v date;
begin
  perform giron_admin.exigir_dono();
  if p_dias is null or p_dias < 1 or p_dias > 90 then raise exception 'Dias invalidos (1 a 90)'; end if;
  update public.fomentados
     set teste_gratis_ate = greatest(current_date, coalesce(teste_gratis_ate, current_date)) + p_dias, atualizado_em = now()
   where id = p_tenant returning teste_gratis_ate into v;
  if v is null then raise exception 'Financeira nao encontrada'; end if;
  perform giron_admin.situacao_atualizar(p_tenant);
  return v;
end $$;

-- Liberar na mao ate uma data (null = tirar a liberacao manual e voltar as regras)
create or replace function public.dono_liberar_ate(p_tenant uuid, p_ate date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform giron_admin.exigir_dono();
  update public.fomentados set liberado_manual_ate = p_ate, atualizado_em = now() where id = p_tenant;
  if not found then raise exception 'Financeira nao encontrada'; end if;
  perform giron_admin.situacao_atualizar(p_tenant);
end $$;

-- Robo do Telegram ligado/desligado pra financeira
create or replace function public.dono_robo(p_tenant uuid, p_ligado boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform giron_admin.exigir_dono();
  insert into public.recursos_extras (tenant_id, recurso, liberado)
  values (p_tenant, 'agente_telegram', p_ligado)
  on conflict (tenant_id, recurso) do update set liberado = excluded.liberado, atualizado_em = now();
end $$;

-- Uso de cada financeira: so numeros, nunca dados dos clientes dela
create or replace function public.dono_uso()
returns table (tenant_id uuid, clientes bigint, contratos_ativos bigint, ultimo_acesso timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform giron_admin.exigir_dono();
  return query
  select f.id,
         (select count(*) from public.clientes c where c.tenant_id = f.id and c.status_cadastro <> 'reprovado'),
         (select count(*) from public.contratos k where k.tenant_id = f.id and k.status = 'ativo'),
         (select max(au.last_sign_in_at) from public.usuarios u join auth.users au on au.id = u.id where u.tenant_id = f.id)
    from public.fomentados f;
end $$;

revoke all on function public.dono_comecar_cobranca(uuid, numeric, date, numeric, integer, date, boolean),
  public.dono_receber(uuid, date), public.dono_desfazer_recebimento(uuid), public.dono_estender_teste(uuid, integer),
  public.dono_liberar_ate(uuid, date), public.dono_robo(uuid, boolean), public.dono_uso() from public, anon;
grant execute on function public.dono_comecar_cobranca(uuid, numeric, date, numeric, integer, date, boolean),
  public.dono_receber(uuid, date), public.dono_desfazer_recebimento(uuid), public.dono_estender_teste(uuid, integer),
  public.dono_liberar_ate(uuid, date), public.dono_robo(uuid, boolean), public.dono_uso() to authenticated;

commit;
