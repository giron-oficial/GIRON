-- GIRON - 0009: na Tabela Price a ultima parcela fica IGUAL as outras
-- (a diferenca de centavos do arredondamento vai pro juro da ultima parcela, nao pro valor).

begin;

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
  m numeric;
  ip numeric;
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
    else
      vc := round(p_capital / n, 2);
      vj := round(saldo * ip, 2);
    end if;
    if k = n then
      vc := p_capital - soma_c;
      if p_sistema = 'empresa' then vj := juro_total - soma_j; end if;
      if p_sistema = 'price' then vj := greatest(vp - vc, 0); end if;
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

commit;
