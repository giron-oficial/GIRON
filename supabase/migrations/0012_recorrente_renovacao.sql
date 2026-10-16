-- GIRON - 0012: renovacao automatica do Recorrente (Fase 5 passo 5.4, parte 1)
-- Regra (cofre: 01-PROJETO/REGRAS-DE-EMPRESTIMO.md, "Modalidade Recorrente"; decisao do dono 16/10/2026):
--  * O Recorrente renova todo mes, sem limite, enquanto o contrato estiver ativo.
--  * Cada ciclo e uma parcela so de juro: capital em aberto x juro do contrato.
--  * O ciclo seguinte nasce quando o atual e pago (renova na hora) OU quando o atual venceu
--    sem pagamento (o juro do mes seguinte continua correndo e os atrasados se acumulam).
--  * Vencimento do ciclo n = 1o vencimento + (n-1) meses (nao escorrega do dia 31 pro 28).
--  * Estorno: se o pagamento estornado foi o que fez nascer o ciclo seguinte, esse ciclo
--    (ainda sem pagamento) e apagado. Se o ciclo ja venceu, a renovacao por data recria.
--  * O agendador do banco (pg_cron) roda a renovacao todo dia 00:05 (Brasilia).

begin;

-- Qual pagamento fez a parcela nascer (so o Recorrente usa; vazio = nasceu pela data ou na criacao)
alter table public.parcelas add column gerada_por_pagamento uuid references public.pagamentos (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Cria os ciclos que faltam de um contrato Recorrente. Devolve quantos criou.
-- Uso interno (gatilho e agendador); o Fomentado nao chama direto.
-- ---------------------------------------------------------------------------
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
  select vencimento into v_primeiro from public.parcelas where contrato_id = c.id and numero = 1;
  if v_primeiro is null then return 0; end if;

  loop
    select * into u from public.parcelas where contrato_id = c.id order by numero desc limit 1;
    exit when not (u.status = 'paga' or u.vencimento < current_date);
    exit when n >= 120; -- trava de seguranca (10 anos de uma vez)
    v_juro := round(c.capital_em_aberto * c.juro_percentual / 100, 2);
    insert into public.parcelas (tenant_id, contrato_id, numero, vencimento, valor, parte_juro, parte_capital, gerada_por_pagamento)
    values (c.tenant_id, c.id, u.numero + 1, (v_primeiro + make_interval(months => u.numero))::date, v_juro, v_juro, 0,
            -- so conta como "nascida do pagamento" quando a data sozinha ainda nao justificava o ciclo novo
            case when u.status = 'paga' and u.vencimento >= current_date then p_pagamento_id end);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.recorrente_renovar(uuid, uuid) from public, anon, authenticated;

-- Todos os contratos Recorrente ativos de todas as empresas (agendador diario)
create or replace function public.recorrente_renovar_todos()
returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; total integer := 0;
begin
  for r in select id from public.contratos where modalidade = 'recorrente' and status = 'ativo' loop
    total := total + public.recorrente_renovar(r.id);
  end loop;
  return total;
end $$;

revoke all on function public.recorrente_renovar_todos() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gatilho na parcela: pagou -> renova; estornou -> desfaz o ciclo que o pagamento criou
-- (pagamento_registrar e estorno_registrar ficam como estao)
-- ---------------------------------------------------------------------------
create or replace function public.recorrente_gatilho_parcela()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pagamento uuid;
begin
  if not exists (select 1 from public.contratos where id = new.contrato_id and modalidade = 'recorrente') then
    return null;
  end if;

  if new.status = 'paga' and old.status <> 'paga' then
    select id into v_pagamento from public.pagamentos
     where parcela_id = new.id and estornado_em is null order by ordem desc limit 1;
    perform public.recorrente_renovar(new.contrato_id, v_pagamento);

  elsif old.status = 'paga' and new.status <> 'paga' then
    delete from public.parcelas p
     where p.contrato_id = new.contrato_id
       and p.gerada_por_pagamento in (select id from public.pagamentos where parcela_id = new.id and estornado_em is not null)
       and not exists (select 1 from public.pagamentos x where x.parcela_id = p.id);
    perform public.recorrente_renovar(new.contrato_id);
  end if;
  return null;
end $$;

create trigger recorrente_renovacao after update of status on public.parcelas
  for each row execute function public.recorrente_gatilho_parcela();

-- ---------------------------------------------------------------------------
-- Agendador: todo dia 03:05 UTC = 00:05 em Brasilia
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule('giron-recorrente-renovar', '5 3 * * *', 'select public.recorrente_renovar_todos()');

commit;
