-- GIRON - 0016: multa e juro de atraso (Fase 5 passo 5.5)
-- Regra (cofre: 01-PROJETO/REGRAS-DE-EMPRESTIMO.md "Atraso e cobranca"; ESPECIFICACAO RN-59a; dono 16/10/2026):
--  * Cada Fomentado escolhe nas Configuracoes: multa (R$, uma vez por parcela), juro por dia de atraso (R$),
--    a partir de quantos dias o atraso vira Critico, e se o juro diario conta desde o vencimento ou so
--    a partir do Critico. Valor zero = nao cobra.
--  * Multa e juro de atraso so comecam no Critico. A tela calcula e mostra o valor cheio (lib/atraso.ts);
--    o Fomentado pode mudar na hora (negociacao) - o banco grava o que foi lancado.
--  * No pagamento, o valor pago inclui a multa e o juro de atraso: eles saem primeiro e o resto abate a
--    parcela (juro, depois capital), como antes. Sem multa/juro de atraso, nada muda.

begin;

alter table public.fomentado_configuracoes
  add column juro_atraso_desde text not null default 'vencimento' check (juro_atraso_desde in ('vencimento', 'critico'));

-- pagamento_registrar: igual ao da 0011, mas a multa e o juro de atraso saem do valor pago antes de abater a parcela
create or replace function public.pagamento_registrar(
  p_parcela_id uuid,
  p_valor_pago numeric,
  p_desconto numeric default 0,
  p_acrescimo numeric default 0,
  p_multa numeric default 0,
  p_juro_atraso numeric default 0,
  p_observacao text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_escrita();
  parc record;
  v_ja_juro numeric;
  v_ja_capital numeric;
  v_falta_juro numeric;
  v_falta_capital numeric;
  v_liquido numeric;
  v_juro_pago numeric;
  v_capital_pago numeric;
  v_status public.status_parcela;
  v_pagamento_id uuid := gen_random_uuid();
  v_ip numeric;
  v_n_restante integer;
  v_saldo numeric;
  v_pmt numeric;
  v_soma_c numeric := 0;
  r record;
  v_vj numeric; v_vc numeric;
  v_recalcular boolean := false;
begin
  if v_tenant is null then
    raise exception 'Sem permissão (conta bloqueada ou usuário sem empresa)' using errcode = 'P0001';
  end if;
  if p_valor_pago is null or p_valor_pago < 0 then raise exception 'Informe o valor pago' using errcode = 'P0001'; end if;
  if p_desconto < 0 or p_acrescimo < 0 or p_multa < 0 or p_juro_atraso < 0 then
    raise exception 'Desconto, acréscimo, multa e juro de atraso não podem ser negativos' using errcode = 'P0001';
  end if;

  select p.*, c.sistema_calculo, c.modalidade, c.quantidade_parcelas, c.capital_em_aberto, c.juro_percentual, c.status as status_contrato
    into parc
    from public.parcelas p join public.contratos c on c.id = p.contrato_id
   where p.id = p_parcela_id and p.tenant_id = v_tenant
   for update of p;
  if parc.id is null then raise exception 'Parcela não encontrada' using errcode = 'P0001'; end if;
  if parc.status_contrato <> 'ativo' then raise exception 'Este contrato não está ativo' using errcode = 'P0001'; end if;
  if parc.status = 'paga' then raise exception 'Esta parcela já está paga' using errcode = 'P0001'; end if;

  -- multa e juro de atraso saem do valor pago antes: o resto e o que abate a parcela (juro e capital)
  v_liquido := p_valor_pago + p_acrescimo - p_desconto - p_multa - p_juro_atraso;
  if v_liquido < 0 then
    if p_multa + p_juro_atraso > 0 then
      raise exception 'O valor pago não cobre a multa e o juro de atraso (R$ %)', to_char(p_multa + p_juro_atraso, 'FM999999990.00') using errcode = 'P0001';
    end if;
    raise exception 'Desconto maior que o valor pago' using errcode = 'P0001';
  end if;

  select coalesce(sum(parte_juro), 0), coalesce(sum(parte_capital), 0) into v_ja_juro, v_ja_capital
    from public.pagamentos where parcela_id = p_parcela_id and estornado_em is null;
  v_falta_juro := parc.parte_juro - v_ja_juro;
  v_falta_capital := parc.parte_capital - v_ja_capital;

  if parc.sistema_calculo in ('price', 'sac') then
    if parc.status <> 'aberta' then raise exception 'Esta parcela já recebeu um pagamento parcial; não é possível pagar de novo por aqui' using errcode = 'P0001'; end if;
    if v_liquido < parc.parte_juro then
      raise exception 'O valor precisa cobrir pelo menos o juro desta parcela (R$ %)', to_char(parc.parte_juro, 'FM999999990.00') using errcode = 'P0001';
    end if;
    if v_liquido > parc.valor + 0.01 then raise exception 'O valor é maior que a parcela; pra pagar mais que o combinado, fale com o suporte' using errcode = 'P0001'; end if;

    v_juro_pago := parc.parte_juro;
    v_capital_pago := v_liquido - v_juro_pago;
    v_status := 'paga';

    if v_liquido < parc.valor - 0.01 then
      v_n_restante := parc.quantidade_parcelas - parc.numero;
      if v_n_restante < 1 then
        raise exception 'Esta é a última parcela; não tem parcela futura pra recalcular. Use desconto ou fale com o suporte' using errcode = 'P0001';
      end if;
      v_recalcular := true;
    end if;
  else
    v_juro_pago := least(v_liquido, greatest(v_falta_juro, 0));
    v_capital_pago := least(v_liquido - v_juro_pago, greatest(v_falta_capital, 0));
    if (v_liquido - v_juro_pago - v_capital_pago) > 0.01 then
      raise exception 'O valor é maior do que falta nesta parcela (falta R$ %)', to_char(v_falta_juro + v_falta_capital, 'FM999999990.00') using errcode = 'P0001';
    end if;
    v_status := case when (v_ja_juro + v_juro_pago) >= parc.parte_juro - 0.01 and (v_ja_capital + v_capital_pago) >= parc.parte_capital - 0.01
                      then 'paga' else 'parcial' end;
  end if;

  insert into public.pagamentos (id, tenant_id, contrato_id, parcela_id, tipo, valor_calculado, valor_pago, desconto, acrescimo,
                                 multa, juro_atraso, parte_juro, parte_capital, observacao, criado_por)
  values (v_pagamento_id, v_tenant, parc.contrato_id, p_parcela_id, 'pagamento', parc.valor, p_valor_pago, p_desconto, p_acrescimo,
          p_multa, p_juro_atraso, v_juro_pago, v_capital_pago, p_observacao, auth.uid());

  if v_recalcular then
    -- taxa por parcela: deduzida da 1a parcela do contrato (parte_juro do inicio / capital original)
    select (p1.parte_juro / c.capital) into v_ip
      from public.parcelas p1 join public.contratos c on c.id = p1.contrato_id
     where p1.contrato_id = parc.contrato_id and p1.numero = 1;

    v_saldo := parc.capital_em_aberto - v_capital_pago;
    if parc.sistema_calculo = 'price' then
      v_pmt := case when v_ip = 0 then v_saldo / v_n_restante else v_saldo * v_ip / (1 - power(1 + v_ip, -v_n_restante)) end;
    end if;

    for r in select id, numero, valor, parte_juro, parte_capital from public.parcelas
               where contrato_id = parc.contrato_id and numero > parc.numero and status = 'aberta'
               order by numero
    loop
      -- guarda como a parcela era, pro estorno conseguir voltar
      insert into public.pagamento_recalculos (tenant_id, pagamento_id, parcela_id, valor, parte_juro, parte_capital)
      values (v_tenant, v_pagamento_id, r.id, r.valor, r.parte_juro, r.parte_capital);

      if parc.sistema_calculo = 'price' then
        v_vj := round(v_saldo * v_ip, 2);
        v_vc := round(v_pmt, 2) - v_vj;
      else
        v_vc := round((parc.capital_em_aberto - v_capital_pago) / v_n_restante, 2);
        v_vj := round(v_saldo * v_ip, 2);
      end if;
      if r.numero = parc.quantidade_parcelas then
        v_vc := (parc.capital_em_aberto - v_capital_pago) - v_soma_c;
      end if;
      v_soma_c := v_soma_c + v_vc;
      v_saldo := v_saldo - v_vc;
      update public.parcelas set valor = v_vc + v_vj, parte_juro = v_vj, parte_capital = v_vc where id = r.id;
    end loop;
  end if;

  update public.parcelas set status = v_status where id = p_parcela_id;

  update public.contratos set
    total_juro_pago = total_juro_pago + v_juro_pago,
    total_capital_pago = total_capital_pago + v_capital_pago,
    capital_em_aberto = capital_em_aberto - v_capital_pago,
    status = case when parc.modalidade <> 'recorrente'
                       and not exists (select 1 from public.parcelas where contrato_id = parc.contrato_id and status <> 'paga' and id <> p_parcela_id)
                       and v_status = 'paga'
                  then 'quitado' else status end
   where id = parc.contrato_id;

  return v_pagamento_id;
end $$;

commit;
