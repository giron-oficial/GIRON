-- GIRON - 0010: registrar pagamento de parcela (Fase 5 passo 5.2)
-- Regra (cofre: 01-PROJETO/REGRAS-DE-EMPRESTIMO.md, secao "Pagamento parcial ou so juro"):
--  * Forma da Empresa e Recorrente: cada parcela aceita quitar aos poucos (varios pagamentos).
--    O valor entra primeiro no juro que falta, depois no capital que falta. O que nao coube
--    fica em aberto (status 'parcial'); quando fecha os dois, vira 'paga'. Nunca cobra mais
--    do que falta na parcela (isso e amortizacao/quitacao antecipada, fora deste passo).
--  * Price e SAC: e a forma normal de tabela. So aceita pagamento de uma vez so (a parcela
--    precisa estar 'aberta'). Se pagar menos que a parcela (mas pelo menos o juro do ciclo),
--    a parcela fecha ('paga') e as parcelas futuras sao recalculadas em cima do saldo devedor
--    que sobrou. Nao aceita pagar mais que a parcela nem mexer na ultima parcela pela metade
--    (sem parcela futura pra absorver a diferenca) - isso tambem fica pra depois.
--  * Multa e juro de atraso (RN futura, passo 5.5): por enquanto so campos que o Fomentado
--    preenche na mao se quiser registrar; nao entram na conta de juro/capital da parcela.

begin;

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
  v_pagamento_id uuid;
  v_ip numeric;
  v_n_restante integer;
  v_saldo numeric;
  v_pmt numeric;
  v_soma_c numeric := 0;
  r record;
  v_vj numeric; v_vc numeric;
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

  v_liquido := p_valor_pago + p_acrescimo - p_desconto;
  if v_liquido < 0 then raise exception 'Desconto maior que o valor pago' using errcode = 'P0001'; end if;

  select coalesce(sum(parte_juro), 0), coalesce(sum(parte_capital), 0) into v_ja_juro, v_ja_capital
    from public.pagamentos where parcela_id = p_parcela_id and estornado_em is null;
  v_falta_juro := parc.parte_juro - v_ja_juro;
  v_falta_capital := parc.parte_capital - v_ja_capital;

  if parc.sistema_calculo in ('price', 'sac') then
    -- Price/SAC: so aceita de uma vez, parcela precisa estar intocada, e cobrindo pelo menos o juro do ciclo
    -- (nao tem "guardar resto pendente" aqui como na Forma da Empresa - o que falta vira recalculo pra frente)
    if parc.status <> 'aberta' then raise exception 'Esta parcela já recebeu um pagamento parcial; não é possível pagar de novo por aqui' using errcode = 'P0001'; end if;
    if v_liquido < parc.parte_juro then
      raise exception 'O valor precisa cobrir pelo menos o juro desta parcela (R$ %)', to_char(parc.parte_juro, 'FM999999990.00') using errcode = 'P0001';
    end if;
    if v_liquido > parc.valor + 0.01 then raise exception 'O valor é maior que a parcela; pra pagar mais que o combinado, fale com o suporte' using errcode = 'P0001'; end if;

    v_juro_pago := parc.parte_juro;
    v_capital_pago := v_liquido - v_juro_pago;
    v_status := 'paga';

    if v_liquido < parc.valor - 0.01 then
      -- sobrou menos capital do que o previsto: recalcula as parcelas futuras
      v_n_restante := parc.quantidade_parcelas - parc.numero;
      if v_n_restante < 1 then
        raise exception 'Esta é a última parcela; não tem parcela futura pra recalcular. Use desconto ou fale com o suporte' using errcode = 'P0001';
      end if;
      -- taxa por parcela: deduzida da 1a parcela do contrato (parte_juro do inicio / capital original)
      select (p1.parte_juro / c.capital) into v_ip
        from public.parcelas p1 join public.contratos c on c.id = p1.contrato_id
       where p1.contrato_id = parc.contrato_id and p1.numero = 1;

      v_saldo := parc.capital_em_aberto - v_capital_pago; -- saldo devedor novo, depois deste pagamento
      if parc.sistema_calculo = 'price' then
        v_pmt := case when v_ip = 0 then v_saldo / v_n_restante else v_saldo * v_ip / (1 - power(1 + v_ip, -v_n_restante)) end;
      end if;

      for r in select id, numero from public.parcelas
                 where contrato_id = parc.contrato_id and numero > parc.numero and status = 'aberta'
                 order by numero
      loop
        if parc.sistema_calculo = 'price' then
          v_vj := round(v_saldo * v_ip, 2);
          v_vc := round(v_pmt, 2) - v_vj;
        else -- sac: fatia de capital fixa, calculada sobre o saldo novo (nao o saldo ja descontado)
          v_vc := round((parc.capital_em_aberto - v_capital_pago) / v_n_restante, 2);
          v_vj := round(v_saldo * v_ip, 2);
        end if;
        if r.numero = parc.quantidade_parcelas then
          v_vc := (parc.capital_em_aberto - v_capital_pago) - v_soma_c; -- ultima parcela fecha os centavos
        end if;
        v_soma_c := v_soma_c + v_vc;
        v_saldo := v_saldo - v_vc;
        update public.parcelas set valor = v_vc + v_vj, parte_juro = v_vj, parte_capital = v_vc where id = r.id;
      end loop;
    end if;
  else
    -- Forma da Empresa e Recorrente: abate juro que falta, depois capital que falta; o resto fica em aberto
    v_juro_pago := least(v_liquido, greatest(v_falta_juro, 0));
    v_capital_pago := least(v_liquido - v_juro_pago, greatest(v_falta_capital, 0));
    if (v_liquido - v_juro_pago - v_capital_pago) > 0.01 then
      raise exception 'O valor é maior do que falta nesta parcela (falta R$ %)', to_char(v_falta_juro + v_falta_capital, 'FM999999990.00') using errcode = 'P0001';
    end if;
    v_status := case when (v_ja_juro + v_juro_pago) >= parc.parte_juro - 0.01 and (v_ja_capital + v_capital_pago) >= parc.parte_capital - 0.01
                      then 'paga' else 'parcial' end;
  end if;

  insert into public.pagamentos (tenant_id, contrato_id, parcela_id, tipo, valor_calculado, valor_pago, desconto, acrescimo,
                                 multa, juro_atraso, parte_juro, parte_capital, observacao, criado_por)
  values (v_tenant, parc.contrato_id, p_parcela_id, 'pagamento', parc.valor, p_valor_pago, p_desconto, p_acrescimo,
          p_multa, p_juro_atraso, v_juro_pago, v_capital_pago, p_observacao, auth.uid())
  returning id into v_pagamento_id;

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

revoke all on function public.pagamento_registrar(uuid, numeric, numeric, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.pagamento_registrar(uuid, numeric, numeric, numeric, numeric, numeric, text) to authenticated;

-- Pagamentos so nascem pela funcao (garante a conta certa); parcelas so mudam por ela tambem
revoke insert on public.pagamentos from authenticated;
revoke update on public.parcelas from authenticated;

commit;
