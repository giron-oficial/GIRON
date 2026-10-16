-- GIRON - 0015: transformar Recorrente em parcelado (Fase 5 passo 5.4, parte 3)
-- Regra (cofre: 01-PROJETO/REGRAS-DE-EMPRESTIMO.md, "Renovacao sem limite e conversao em parcelado";
-- decisao do dono 16/10/2026):
--  * Opcao do cliente. Capital a parcelar = o capital que ainda falta (1.000, ou 700 se amortizou 300).
--  * Juros vencidos em aberto (ciclos que venceram ate hoje e nao foram pagos): o dono escolhe na hora
--    quanto deles entra no parcelado - tudo, uma parte ou nada (desconto). Ex.: 1.000 + 4 x 100 = 1.400.
--  * O dono escolhe modalidade (diario/semanal/mensal), forma de calculo, juro e quantidade, como num
--    emprestimo novo (contrato_criar).
--  * O Recorrente fica "convertido": sai da cobranca, nao renova mais, e aponta pro contrato novo.
--    O contrato novo aponta de volta (convertido_de) e nao conta como "emprestado no mes" (dinheiro novo).
--  * Nao tem desfazer automatico nesta versao.

begin;

alter table public.contratos
  add column convertido_de   uuid references public.contratos (id) on delete restrict,
  add column convertido_para uuid references public.contratos (id) on delete restrict;

-- Contrato so muda pelas funcoes (criar, pagar, estornar, amortizar, converter). Antes o usuario
-- conseguia alterar a tabela direto (status, capital...) - nenhuma tela usava isso.
revoke update on public.contratos from authenticated;

-- ---------------------------------------------------------------------------
-- Previa: quanto falta de capital e quanto de juro venceu e nao foi pago (a tela mostra antes de converter)
-- ---------------------------------------------------------------------------
create or replace function public.conversao_previa(p_contrato_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_leitura();
  c record;
  v_juros numeric;
  v_meses integer;
begin
  select * into c from public.contratos where id = p_contrato_id and tenant_id = v_tenant;
  if c.id is null then raise exception 'Contrato não encontrado' using errcode = 'P0001'; end if;

  select coalesce(sum(greatest(p.parte_juro - coalesce(pg.juro, 0), 0)), 0), count(*)
    into v_juros, v_meses
    from public.parcelas p
    left join lateral (select sum(parte_juro) as juro from public.pagamentos
                        where parcela_id = p.id and estornado_em is null) pg on true
   where p.contrato_id = c.id and p.status <> 'paga' and p.vencimento <= current_date;

  return jsonb_build_object('numero', c.numero, 'cliente_id', c.cliente_id, 'modalidade', c.modalidade, 'status', c.status,
    'juro_percentual', c.juro_percentual, 'capital', c.capital_em_aberto, 'juros_vencidos', v_juros, 'meses_vencidos', v_meses);
end $$;

revoke all on function public.conversao_previa(uuid) from public, anon;
grant execute on function public.conversao_previa(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Converter: cria o parcelado com capital + juros escolhidos e fecha o Recorrente
-- ---------------------------------------------------------------------------
create or replace function public.contrato_converter(
  p_contrato_id uuid,
  p_juros_incluidos numeric,
  p_modalidade public.modalidade,
  p_sistema public.sistema_calculo,
  p_juro_mensal_percentual numeric,
  p_quantidade integer,
  p_primeiro_vencimento date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_escrita();
  c record;
  v_previa jsonb;
  v_juros numeric;
  v_novo uuid;
begin
  if v_tenant is null then
    raise exception 'Sem permissão (conta bloqueada ou usuário sem empresa)' using errcode = 'P0001';
  end if;
  select * into c from public.contratos where id = p_contrato_id and tenant_id = v_tenant for update;
  if c.id is null then raise exception 'Contrato não encontrado' using errcode = 'P0001'; end if;
  if c.modalidade <> 'recorrente' then raise exception 'Só o empréstimo Recorrente pode virar parcelado' using errcode = 'P0001'; end if;
  if c.status <> 'ativo' then raise exception 'Este contrato não está ativo' using errcode = 'P0001'; end if;
  if p_modalidade = 'recorrente' then raise exception 'Escolha diário, semanal ou mensal' using errcode = 'P0001'; end if;

  v_previa := public.conversao_previa(c.id);
  v_juros := (v_previa ->> 'juros_vencidos')::numeric;
  if p_juros_incluidos is null or p_juros_incluidos < 0 then
    raise exception 'Informe quanto dos juros vencidos entra (pode ser zero)' using errcode = 'P0001';
  end if;
  if p_juros_incluidos > v_juros + 0.001 then
    raise exception 'Os juros vencidos em aberto são R$ %; não dá pra incluir mais que isso', to_char(v_juros, 'FM999999990.00') using errcode = 'P0001';
  end if;
  if c.capital_em_aberto + p_juros_incluidos <= 0 then
    raise exception 'Não sobrou nada pra parcelar' using errcode = 'P0001';
  end if;

  v_novo := public.contrato_criar(c.cliente_id, p_modalidade, p_sistema, c.capital_em_aberto + p_juros_incluidos,
                                  p_juro_mensal_percentual, p_quantidade, current_date, p_primeiro_vencimento);

  update public.contratos set convertido_de = c.id where id = v_novo;
  update public.contratos set status = 'convertido', convertido_para = v_novo where id = c.id;
  return v_novo;
end $$;

revoke all on function public.contrato_converter(uuid, numeric, public.modalidade, public.sistema_calculo, numeric, integer, date) from public, anon;
grant execute on function public.contrato_converter(uuid, numeric, public.modalidade, public.sistema_calculo, numeric, integer, date) to authenticated;

commit;
