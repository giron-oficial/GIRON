-- GIRON - 0013: amortizacao do Recorrente (Fase 5 passo 5.4, parte 2)
-- Regra (cofre: 01-PROJETO/REGRAS-DE-EMPRESTIMO.md, "Modalidade Recorrente"; ESPECIFICACAO RN-51):
--  * O cliente abate parte do capital a qualquer momento (acao separada do pagamento do juro).
--    Ex.: capital 1.000 a 10%, amortiza 500 -> capital 500 e o juro dos meses seguintes passa a 50.
--  * Os ciclos que ainda nao venceram e nao receberam nada sao recalculados com o capital novo.
--    Ciclos vencidos (juro que ja correu) e ciclos com pagamento ficam como estao.
--  * Amortizou tudo: os ciclos futuros ficam com R$ 0 (nada a cobrar); quando nao sobrar nada em
--    aberto, o contrato fica quitado.
--  * Estorno da amortizacao (pela estorno_registrar, que ja devolve o capital): os ciclos futuros
--    sao recalculados de novo com o capital devolvido (os zerados voltam a ser cobrados).
--  * Por enquanto so no Recorrente (nas parceladas, amortizar = quitacao antecipada, decisao em aberto).

begin;

-- ---------------------------------------------------------------------------
-- Recalcula os ciclos futuros intocados com o capital atual.
-- Capital zerado: esses ciclos ficam com R$ 0 e "pagos" (nada a cobrar) e, sem nada em aberto, o
-- contrato fica quitado. Se o capital voltar (estorno), eles voltam a ser cobrados.
-- ---------------------------------------------------------------------------
create or replace function public.recorrente_recalcular_futuros(p_contrato_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare c record; v_juro numeric;
begin
  select * into c from public.contratos where id = p_contrato_id for update;
  if c.id is null or c.modalidade <> 'recorrente' then return; end if;

  if c.capital_em_aberto <= 0 then
    update public.parcelas p set valor = 0, parte_juro = 0, parte_capital = 0, status = 'paga'
     where p.contrato_id = c.id and p.status = 'aberta' and p.vencimento >= current_date
       and not exists (select 1 from public.pagamentos x where x.parcela_id = p.id);
    perform public.recorrente_fechar_se_quitado(c.id);
  else
    v_juro := round(c.capital_em_aberto * c.juro_percentual / 100, 2);
    update public.parcelas p set valor = v_juro, parte_juro = v_juro, parte_capital = 0, status = 'aberta'
     where p.contrato_id = c.id and p.vencimento >= current_date
       and (p.status = 'aberta' or (p.status = 'paga' and p.valor = 0))
       and not exists (select 1 from public.pagamentos x where x.parcela_id = p.id);
  end if;
end $$;

revoke all on function public.recorrente_recalcular_futuros(uuid) from public, anon, authenticated;

-- Capital zerado e nada em aberto: contrato quitado
create or replace function public.recorrente_fechar_se_quitado(p_contrato_id uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.contratos set status = 'quitado'
   where id = p_contrato_id and modalidade = 'recorrente' and status = 'ativo' and capital_em_aberto <= 0
     and not exists (select 1 from public.parcelas where contrato_id = p_contrato_id and status <> 'paga');
$$;

revoke all on function public.recorrente_fechar_se_quitado(uuid) from public, anon, authenticated;

-- A renovacao nao cria ciclo de juro zero: capital zerado so fecha o contrato quando tudo estiver pago
create or replace function public.recorrente_renovar(p_contrato_id uuid, p_pagamento_id uuid default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  u record;
  v_primeiro date;
  v_juro numeric;
  n integer := 0;
begin
  select * into c from public.contratos where id = p_contrato_id for update;
  if c.id is null or c.modalidade <> 'recorrente' or c.status <> 'ativo' then return 0; end if;
  if c.capital_em_aberto <= 0 then
    perform public.recorrente_fechar_se_quitado(c.id);
    return 0;
  end if;
  select vencimento into v_primeiro from public.parcelas where contrato_id = c.id and numero = 1;
  if v_primeiro is null then return 0; end if;

  loop
    select * into u from public.parcelas where contrato_id = c.id order by numero desc limit 1;
    exit when not (u.status = 'paga' or u.vencimento < current_date);
    exit when n >= 120; -- trava de seguranca (10 anos de uma vez)
    v_juro := round(c.capital_em_aberto * c.juro_percentual / 100, 2);
    insert into public.parcelas (tenant_id, contrato_id, numero, vencimento, valor, parte_juro, parte_capital, gerada_por_pagamento)
    values (c.tenant_id, c.id, u.numero + 1, (v_primeiro + make_interval(months => u.numero))::date, v_juro, v_juro, 0,
            case when u.status = 'paga' and u.vencimento >= current_date then p_pagamento_id end);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.recorrente_renovar(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registrar a amortizacao (o Fomentado chama pela tela do contrato)
-- ---------------------------------------------------------------------------
create or replace function public.amortizacao_registrar(p_contrato_id uuid, p_valor numeric, p_observacao text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_escrita();
  c record;
  v_id uuid;
begin
  if v_tenant is null then
    raise exception 'Sem permissão (conta bloqueada ou usuário sem empresa)' using errcode = 'P0001';
  end if;
  select * into c from public.contratos where id = p_contrato_id and tenant_id = v_tenant for update;
  if c.id is null then raise exception 'Contrato não encontrado' using errcode = 'P0001'; end if;
  if c.modalidade <> 'recorrente' then raise exception 'Amortização é só no empréstimo Recorrente' using errcode = 'P0001'; end if;
  if c.status <> 'ativo' then raise exception 'Este contrato não está ativo' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor da amortização' using errcode = 'P0001'; end if;
  if p_valor > c.capital_em_aberto + 0.001 then
    raise exception 'O valor é maior que o capital em aberto (R$ %)', to_char(c.capital_em_aberto, 'FM999999990.00') using errcode = 'P0001';
  end if;

  insert into public.pagamentos (tenant_id, contrato_id, parcela_id, tipo, valor_calculado, valor_pago,
                                 parte_juro, parte_capital, observacao, criado_por)
  values (v_tenant, c.id, null, 'amortizacao', c.capital_em_aberto, p_valor, 0, p_valor, p_observacao, auth.uid())
  returning id into v_id;

  update public.contratos set
    total_capital_pago = total_capital_pago + p_valor,
    capital_em_aberto = capital_em_aberto - p_valor
   where id = c.id;

  perform public.recorrente_recalcular_futuros(c.id);
  return v_id;
end $$;

revoke all on function public.amortizacao_registrar(uuid, numeric, text) from public, anon;
grant execute on function public.amortizacao_registrar(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Estorno de amortizacao: a estorno_registrar ja devolve o capital e reativa o contrato;
-- este gatilho no contrato refaz os ciclos futuros com o capital devolvido
-- ---------------------------------------------------------------------------
create or replace function public.recorrente_gatilho_contrato()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- capital voltou (estorno de amortizacao): recalcula os futuros e recria os ciclos que tinham sumido
  if new.modalidade = 'recorrente' and new.status = 'ativo' and new.capital_em_aberto > old.capital_em_aberto then
    perform public.recorrente_recalcular_futuros(new.id);
    perform public.recorrente_renovar(new.id);
  end if;
  return null;
end $$;

create trigger recorrente_capital_voltou after update of capital_em_aberto, status on public.contratos
  for each row execute function public.recorrente_gatilho_contrato();

commit;
