-- GIRON - testes das contas de emprestimo (exemplos dados pelo dono). Nao grava nada.
create function pg_temp.r(t text, ok boolean) returns void language plpgsql as $$ begin
  raise notice '%  %', case when ok then 'PASSOU' else 'FALHOU' end, t; end $$;
create function pg_temp.c(mod text, sis text, cap numeric, juro numeric, n int, ini date, pv date, sab boolean default true, dom boolean default false)
returns jsonb language sql as $$ select public.emprestimo_calcular(mod::public.modalidade, sis::public.sistema_calculo, cap, juro, n, ini, pv, sab, dom) $$;

-- Forma da Empresa (exemplos do dono)
select pg_temp.r('C1. Empresa mensal R$1000 10% 10x = R$200 cada, juro R$1000',
  (select bool_and((p->>'valor')::numeric = 200) from jsonb_array_elements(pg_temp.c('mensal','empresa',1000,10,10,'2026-10-01','2026-11-01')->'parcelas') p)
  and (pg_temp.c('mensal','empresa',1000,10,10,'2026-10-01','2026-11-01')->>'juro_total')::numeric = 1000);
select pg_temp.r('C2. Empresa semanal R$1000 10% 10x = R$125 cada, juro R$250',
  (select bool_and((p->>'valor')::numeric = 125) from jsonb_array_elements(pg_temp.c('semanal','empresa',1000,10,10,'2026-10-01','2026-10-08')->'parcelas') p)
  and (pg_temp.c('semanal','empresa',1000,10,10,'2026-10-01','2026-10-08')->>'juro_total')::numeric = 250);
-- Diario: 30 parcelas todos os dias (cobra sab e dom), 30 dias -> R$1100 no total
select pg_temp.r('C3. Diario R$1000 10% 30 dias (todos os dias) = total R$1100',
  (pg_temp.c('diario','empresa',1000,10,30,'2026-10-01','2026-10-02',true,true)->>'total')::numeric = 1100);
-- Diario sem domingo: nenhuma parcela cai no domingo
select pg_temp.r('C4. Diario sem domingo: nenhuma parcela no domingo',
  (select bool_and(extract(isodow from (p->>'vencimento')::date) <> 7) from jsonb_array_elements(pg_temp.c('diario','empresa',1000,10,26,'2026-10-01','2026-10-02',true,false)->'parcelas') p));
select pg_temp.r('C5. Diario sem sabado e sem domingo: so dia de semana',
  (select bool_and(extract(isodow from (p->>'vencimento')::date) < 6) from jsonb_array_elements(pg_temp.c('diario','empresa',1000,10,22,'2026-10-01','2026-10-02',false,false)->'parcelas') p));
-- Price: parcelas iguais (tolerancia de 1 centavo na ultima), capital fecha
select pg_temp.r('C6. Price mensal 1000 10% 10x: parcelas iguais ~R$162,75 e capital fecha 1000',
  (select max((p->>'valor')::numeric) = min((p->>'valor')::numeric) and abs(avg((p->>'valor')::numeric) - 162.75) < 0.02
          and sum((p->>'parte_capital')::numeric) = 1000
     from jsonb_array_elements(pg_temp.c('mensal','price',1000,10,10,'2026-10-01','2026-11-01')->'parcelas') p));
select pg_temp.r('C7. Price: juro diminui e capital aumenta ao longo do tempo',
  (select (arr->0->>'parte_juro')::numeric > (arr->9->>'parte_juro')::numeric and (arr->0->>'parte_capital')::numeric < (arr->9->>'parte_capital')::numeric
     from (select pg_temp.c('mensal','price',1000,10,10,'2026-10-01','2026-11-01')->'parcelas' arr) x));
-- SAC: capital igual (100), primeira parcela 200, ultima 110
select pg_temp.r('C8. SAC mensal 1000 10% 10x: capital R$100 cada, 1a R$200, ultima R$110',
  (select (arr->0->>'valor')::numeric = 200 and (arr->9->>'valor')::numeric = 110
          and (select bool_and((q->>'parte_capital')::numeric = 100) from jsonb_array_elements(arr) q)
     from (select pg_temp.c('mensal','sac',1000,10,10,'2026-10-01','2026-11-01')->'parcelas' arr) x));
-- Recorrente: so juro
select pg_temp.r('C9. Recorrente R$1000 10% = juro R$100 no mes',
  (pg_temp.c('recorrente',null,1000,10,null,'2026-10-01','2026-11-01')->'parcelas'->0->>'valor')::numeric = 100);
-- Centavos: capital que nao divide exato fecha certinho
select pg_temp.r('C10. Centavos: R$1000 em 3x fecha exato no capital',
  (select sum((p->>'parte_capital')::numeric) = 1000 from jsonb_array_elements(pg_temp.c('mensal','empresa',1000,10,3,'2026-10-01','2026-11-01')->'parcelas') p));
-- Mensal: vencimentos mes a mes
select pg_temp.r('C11. Mensal: vencimentos 01/11, 01/12, 01/01',
  (select array_agg((p->>'vencimento')::date order by (p->>'numero')::int) = array['2026-11-01','2026-12-01','2027-01-01']::date[]
     from jsonb_array_elements(pg_temp.c('mensal','empresa',1000,10,3,'2026-10-01','2026-11-01')->'parcelas') p));
