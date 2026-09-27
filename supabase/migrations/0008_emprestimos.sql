-- GIRON - 0008: criar emprestimo (contrato + parcelas) - RN-50 a RN-58
-- A conta fica num lugar so (aqui no banco): a tela usa emprestimo_simular pra mostrar as opcoes
-- e contrato_criar grava usando a MESMA conta.
--
-- Regras (cofre: 01-PROJETO/REGRAS-DE-EMPRESTIMO.md):
--  * Juro informado e MENSAL (ex.: 10% ao mes).
--  * "Meses equivalentes" (M) do prazo: mensal = n parcelas; semanal = n/4 (4 semanas = 1 mes);
--    diario = dias corridos do dia do emprestimo ate a ultima parcela / 30.
--  * Forma da Empresa (juro fixo): juro total = capital x juro x M; parcela = (capital + juro total) / n, sempre igual.
--    Ex.: R$1.000, 10%, 10 mensais -> R$200. 10 semanais -> juro R$250 -> R$125.
--  * Price e SAC: juro sobre o saldo devedor, com taxa por parcela = juro x M / n
--    (mensal = juro; semanal = juro/4). Price = parcela igual; SAC = capital igual, parcela diminui.
--  * Recorrente: paga so o juro do mes sobre o capital em aberto; capital sem prazo.
--  * Diario pula sabado/domingo conforme a configuracao do Fomentado.
--  * Centavos: arredonda cada parcela; a ultima absorve a diferenca pra fechar certinho.

begin;

-- Proxima data de vencimento a partir de uma data (usada pra montar o calendario de parcelas)
create or replace function public.emprestimo_proxima_data(
  p_data date, p_modalidade public.modalidade, p_cobra_sabado boolean, p_cobra_domingo boolean
) returns date
language plpgsql immutable set search_path = '' as $$
declare d date := p_data;
begin
  if p_modalidade = 'semanal' then return p_data + 7; end if;
  if p_modalidade in ('mensal', 'recorrente') then return (p_data + interval '1 month')::date; end if;
  -- diario
  loop
    d := d + 1;
    exit when not ((extract(isodow from d) = 6 and not p_cobra_sabado) or (extract(isodow from d) = 7 and not p_cobra_domingo));
  end loop;
  return d;
end $$;

-- Ajusta a data pra nao cair em dia que o Fomentado nao cobra (so diario)
create or replace function public.emprestimo_ajustar_dia(
  p_data date, p_modalidade public.modalidade, p_cobra_sabado boolean, p_cobra_domingo boolean
) returns date
language plpgsql immutable set search_path = '' as $$
declare d date := p_data;
begin
  if p_modalidade <> 'diario' then return d; end if;
  while (extract(isodow from d) = 6 and not p_cobra_sabado) or (extract(isodow from d) = 7 and not p_cobra_domingo) loop
    d := d + 1;
  end loop;
  return d;
end $$;

-- Calcula as parcelas. Nao grava nada. Devolve:
-- { meses_equivalentes, juro_total, total, parcelas: [{numero, vencimento, valor, parte_juro, parte_capital}] }
create or replace function public.emprestimo_calcular(
  p_modalidade public.modalidade,
  p_sistema public.sistema_calculo,
  p_capital numeric,
  p_juro_mensal_percentual numeric,
  p_quantidade integer,
  p_data_contrato date,
  p_primeiro_vencimento date,
  p_cobra_sabado boolean default true,
  p_cobra_domingo boolean default false
) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  i numeric := p_juro_mensal_percentual / 100;
  n integer := p_quantidade;
  datas date[] := '{}';
  d date;
  m numeric;          -- meses equivalentes
  ip numeric;         -- taxa por parcela
  saldo numeric := p_capital;
  pmt numeric;
  juro_total numeric := 0;
  parcelas jsonb := '[]';
  vj numeric; vc numeric; vp numeric;
  soma_c numeric := 0; soma_j numeric := 0;
  k integer;
begin
  if p_capital is null or p_capital <= 0 then raise exception 'Informe o valor emprestado' using errcode = 'P0001'; end if;
  if p_juro_mensal_percentual is null or p_juro_mensal_percentual < 0 then raise exception 'Informe o juro' using errcode = 'P0001'; end if;
  if p_primeiro_vencimento is null or p_primeiro_vencimento <= p_data_contrato then
    raise exception 'O primeiro vencimento precisa ser depois do dia do empréstimo' using errcode = 'P0001';
  end if;

  d := public.emprestimo_ajustar_dia(p_primeiro_vencimento, p_modalidade, p_cobra_sabado, p_cobra_domingo);

  -- Recorrente: uma parcela (so juro) por ciclo
  if p_modalidade = 'recorrente' then
    vj := round(p_capital * i, 2);
    return jsonb_build_object('meses_equivalentes', 1, 'juro_total', vj, 'total', vj,
      'parcelas', jsonb_build_array(jsonb_build_object('numero', 1, 'vencimento', d, 'valor', vj, 'parte_juro', vj, 'parte_capital', 0)));
  end if;

  if n is null or n < 1 or n > 400 then raise exception 'Quantidade de parcelas inválida' using errcode = 'P0001'; end if;
  if p_sistema is null then raise exception 'Escolha a forma de cálculo' using errcode = 'P0001'; end if;

  for k in 1..n loop
    datas := datas || d;
    d := public.emprestimo_proxima_data(d, p_modalidade, p_cobra_sabado, p_cobra_domingo);
  end loop;

  m := case p_modalidade
         when 'mensal' then n
         when 'semanal' then n / 4.0
         else (datas[n] - p_data_contrato) / 30.0
       end;
  ip := i * m / n;

  if p_sistema = 'empresa' then
    juro_total := round(p_capital * i * m, 2);
    vp := round((p_capital + juro_total) / n, 2);
  elsif p_sistema = 'price' then
    pmt := case when ip = 0 then p_capital / n else p_capital * ip / (1 - power(1 + ip, -n)) end;
    vp := round(pmt, 2);
  end if;

  for k in 1..n loop
    if p_sistema = 'empresa' then
      vj := round(juro_total / n, 2);
      vc := round(p_capital / n, 2);
    elsif p_sistema = 'price' then
      vj := round(saldo * ip, 2);
      vc := vp - vj;
    else -- sac
      vc := round(p_capital / n, 2);
      vj := round(saldo * ip, 2);
    end if;
    if k = n then
      -- ultima parcela fecha os centavos
      vc := p_capital - soma_c;
      if p_sistema = 'empresa' then vj := juro_total - soma_j; end if;
    end if;
    saldo := saldo - vc;
    soma_c := soma_c + vc;
    soma_j := soma_j + vj;
    parcelas := parcelas || jsonb_build_object('numero', k, 'vencimento', datas[k], 'valor', vc + vj,
                                              'parte_juro', vj, 'parte_capital', vc);
  end loop;

  return jsonb_build_object('meses_equivalentes', round(m, 4), 'juro_total', soma_j,
                            'total', p_capital + soma_j, 'parcelas', parcelas);
end $$;

-- Simulacao pra tela: usa a configuracao de sabado/domingo do Fomentado logado
create or replace function public.emprestimo_simular(
  p_modalidade public.modalidade, p_sistema public.sistema_calculo, p_capital numeric,
  p_juro_mensal_percentual numeric, p_quantidade integer, p_data_contrato date, p_primeiro_vencimento date
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cfg record;
begin
  select coalesce(c.cobra_sabado, true) as sab, coalesce(c.cobra_domingo, false) as dom into cfg
    from (select 1) x left join public.fomentado_configuracoes c on c.tenant_id = public.meu_tenant_leitura();
  return public.emprestimo_calcular(p_modalidade, p_sistema, p_capital, p_juro_mensal_percentual, p_quantidade,
                                    p_data_contrato, p_primeiro_vencimento, cfg.sab, cfg.dom);
end $$;

-- Grava o emprestimo: contrato + parcelas. So cliente aprovado.
create or replace function public.contrato_criar(
  p_cliente_id uuid, p_modalidade public.modalidade, p_sistema public.sistema_calculo, p_capital numeric,
  p_juro_mensal_percentual numeric, p_quantidade integer, p_data_contrato date, p_primeiro_vencimento date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid := public.meu_tenant_escrita();
  cfg record;
  calc jsonb;
  v_status public.status_cadastro;
  v_numero integer;
  v_id uuid;
  p jsonb;
  v_rec boolean := p_modalidade = 'recorrente';
begin
  if v_tenant is null then
    raise exception 'Sem permissão (conta bloqueada ou usuário sem empresa)' using errcode = 'P0001';
  end if;
  select status_cadastro into v_status from public.clientes where id = p_cliente_id and tenant_id = v_tenant;
  if v_status is null then raise exception 'Cliente não encontrado' using errcode = 'P0001'; end if;
  if v_status <> 'aprovado' then raise exception 'Aprove o cadastro do cliente antes do empréstimo' using errcode = 'P0001'; end if;

  select coalesce(c.cobra_sabado, true) as sab, coalesce(c.cobra_domingo, false) as dom into cfg
    from (select 1) x left join public.fomentado_configuracoes c on c.tenant_id = v_tenant;
  calc := public.emprestimo_calcular(p_modalidade, case when v_rec then null else p_sistema end, p_capital,
                                     p_juro_mensal_percentual, case when v_rec then null else p_quantidade end,
                                     p_data_contrato, p_primeiro_vencimento, cfg.sab, cfg.dom);

  select coalesce(max(numero), 0) + 1 into v_numero from public.contratos where cliente_id = p_cliente_id;

  insert into public.contratos (tenant_id, cliente_id, numero, modalidade, sistema_calculo, capital, juro_percentual,
                                juro_valor, quantidade_parcelas, data_contrato, dia_vencimento, capital_em_aberto)
  values (v_tenant, p_cliente_id, v_numero, p_modalidade, case when v_rec then null else p_sistema end, p_capital,
          p_juro_mensal_percentual, (calc ->> 'juro_total')::numeric, case when v_rec then null else p_quantidade end,
          p_data_contrato, extract(day from (calc -> 'parcelas' -> 0 ->> 'vencimento')::date), p_capital)
  returning id into v_id;

  for p in select * from jsonb_array_elements(calc -> 'parcelas') loop
    insert into public.parcelas (tenant_id, contrato_id, numero, vencimento, valor, parte_juro, parte_capital)
    values (v_tenant, v_id, (p ->> 'numero')::int, (p ->> 'vencimento')::date, (p ->> 'valor')::numeric,
            (p ->> 'parte_juro')::numeric, (p ->> 'parte_capital')::numeric);
  end loop;

  return v_id;
end $$;

revoke all on function public.emprestimo_simular(public.modalidade, public.sistema_calculo, numeric, numeric, integer, date, date),
                       public.contrato_criar(uuid, public.modalidade, public.sistema_calculo, numeric, numeric, integer, date, date)
  from public, anon;
grant execute on function public.emprestimo_simular(public.modalidade, public.sistema_calculo, numeric, numeric, integer, date, date),
                          public.contrato_criar(uuid, public.modalidade, public.sistema_calculo, numeric, numeric, integer, date, date)
  to authenticated;

-- Contratos e parcelas so nascem pela funcao (garante a conta certa)
revoke insert on public.contratos, public.parcelas from authenticated;

commit;
