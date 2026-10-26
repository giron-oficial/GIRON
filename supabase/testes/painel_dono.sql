-- GIRON - testes do Painel do Dono (cobranca das financeiras e bloqueio automatico).
-- Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-painel-dono.sh teste
begin;

insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000d1','dono@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a2','a2@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values
 ('10000000-0000-0000-0000-0000000000a2','Financeira Painel A','painela'),
 ('10000000-0000-0000-0000-0000000000b2','Financeira Painel B','painelb');
insert into public.usuarios (id, tenant_id, papel) values
 ('00000000-0000-0000-0000-0000000000d1', null, 'dono_giron'),
 ('00000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000a2','fomentado');

create function pg_temp.como(u text) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u, true);
end $$;
create function pg_temp.r(t text, ok boolean) returns void language plpgsql as $$ begin
  raise notice '%  %', case when ok then 'PASSOU' else 'FALHOU' end, t; end $$;
create function pg_temp.falha(sql text) returns boolean language plpgsql as $$ begin
  execute sql; return false; exception when others then return true; end $$;
create function pg_temp.situacao(t text) returns text language sql as $$
  select status_acesso::text from public.fomentados where id = t::uuid $$;

\set A '10000000-0000-0000-0000-0000000000a2'
\set B '10000000-0000-0000-0000-0000000000b2'

select pg_temp.r('financeira nova ganha 15 dias de teste',
  (select teste_gratis_ate from public.fomentados where id = :'A') = current_date + 15);

-- A financeira nao mexe em nada da cobranca
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select pg_temp.r('financeira nao consegue mudar o valor da propria mensalidade',
  pg_temp.falha($q$update public.fomentados set mensalidade_valor = 1 where id = '10000000-0000-0000-0000-0000000000a2'$q$));
select pg_temp.r('financeira nao consegue comecar cobranca',
  pg_temp.falha($q$select public.dono_comecar_cobranca('10000000-0000-0000-0000-0000000000a2', 69.90, current_date)$q$));
select pg_temp.r('financeira nao consegue estender o proprio teste',
  pg_temp.falha($q$select public.dono_estender_teste('10000000-0000-0000-0000-0000000000a2', 30)$q$));
select pg_temp.r('financeira nao consegue ver o uso das outras',
  pg_temp.falha($q$select * from public.dono_uso()$q$));

-- Dono comeca a cobrar: 1 mensalidade + implantacao de R$ 800,00 em 7x (divisao com centavos)
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
select public.dono_comecar_cobranca(:'A', 89.90, current_date + 5, 800, 7, current_date + 5, true);
select pg_temp.r('cria 1 mensalidade e 7 parcelas de implantacao',
  (select count(*) filter (where tipo = 'mensalidade') = 1 and count(*) filter (where tipo = 'implantacao') = 7
     from public.assinaturas where tenant_id = :'A'));
select pg_temp.r('parcelas da implantacao somam exatamente R$ 800,00',
  (select sum(valor) from public.assinaturas where tenant_id = :'A' and tipo = 'implantacao') = 800);
select pg_temp.r('parcelas da implantacao vencem uma por mes',
  (select max(vencimento) from public.assinaturas where tenant_id = :'A' and tipo = 'implantacao') = (current_date + 5 + interval '6 months')::date);
select pg_temp.r('mensalidade ficou com o valor do plano com robo',
  (select mensalidade_valor from public.fomentados where id = :'A') = 89.90);
select pg_temp.r('robo do Telegram ficou ligado',
  (select liberado from public.recursos_extras where tenant_id = :'A' and recurso = 'agente_telegram'));
select pg_temp.r('nao deixa comecar cobranca duas vezes',
  pg_temp.falha($q$select public.dono_comecar_cobranca('10000000-0000-0000-0000-0000000000a2', 69.90, current_date)$q$));

-- Teste acabou sem pagar: bloqueio total
reset role;
update public.fomentados set teste_gratis_ate = current_date - 1 where id = :'A';
select giron_admin.situacao_atualizar_todas();
select pg_temp.r('teste acabou sem pagar: bloqueio total', pg_temp.situacao(:'A') = 'bloqueio_total');
select pg_temp.r('financeira ainda no teste continua liberada', pg_temp.situacao(:'B') = 'ativo');

-- Recebi o pagamento: libera, acaba o teste e cria a proxima mensalidade
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
select public.dono_receber((select id from public.assinaturas where tenant_id = :'A' and tipo = 'mensalidade'));
select pg_temp.r('pagou: acesso liberado na hora', pg_temp.situacao(:'A') = 'ativo');
select pg_temp.r('pagou: teste gratis encerrado', (select teste_gratis_ate is null from public.fomentados where id = :'A'));
select pg_temp.r('pagou: proxima mensalidade criada um mes depois, com o mesmo valor',
  exists (select 1 from public.assinaturas where tenant_id = :'A' and tipo = 'mensalidade' and pago_em is null
           and vencimento = (current_date + 5 + interval '1 month')::date and valor = 89.90));
select pg_temp.r('nao deixa receber a mesma cobranca duas vezes',
  pg_temp.falha(format('select public.dono_receber(%L)', (select id from public.assinaturas where tenant_id = '10000000-0000-0000-0000-0000000000a2' and tipo = 'mensalidade' and pago_em is not null))));

-- Atraso depois de pago: 2 dias nada, 3 dias parcial, 4 dias total
reset role;
update public.assinaturas set pago_em = current_date where tenant_id = :'A' and tipo = 'implantacao';
update public.assinaturas set vencimento = current_date - 2 where tenant_id = :'A' and tipo = 'mensalidade' and pago_em is null;
select giron_admin.situacao_atualizar_todas();
select pg_temp.r('2 dias de atraso: continua liberado', pg_temp.situacao(:'A') = 'ativo');
update public.assinaturas set vencimento = current_date - 3 where tenant_id = :'A' and tipo = 'mensalidade' and pago_em is null;
select giron_admin.situacao_atualizar_todas();
select pg_temp.r('3 dias de atraso: bloqueio parcial', pg_temp.situacao(:'A') = 'bloqueio_parcial');
update public.assinaturas set vencimento = current_date - 4 where tenant_id = :'A' and tipo = 'mensalidade' and pago_em is null;
select giron_admin.situacao_atualizar_todas();
select pg_temp.r('4 dias de atraso: bloqueio total', pg_temp.situacao(:'A') = 'bloqueio_total');

-- Dono libera na mao, depois tira a liberacao
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
select public.dono_liberar_ate(:'A', current_date + 3);
select pg_temp.r('liberacao manual: volta a funcionar mesmo atrasada', pg_temp.situacao(:'A') = 'ativo');
select public.dono_liberar_ate(:'A', null);
select pg_temp.r('tirou a liberacao manual: volta o bloqueio', pg_temp.situacao(:'A') = 'bloqueio_total');

-- Desfazer recebimento
select public.dono_receber((select id from public.assinaturas where tenant_id = :'A' and tipo = 'mensalidade' and pago_em is null));
select pg_temp.r('recebeu a atrasada: liberado', pg_temp.situacao(:'A') = 'ativo');
select public.dono_desfazer_recebimento((select id from public.assinaturas where tenant_id = :'A' and tipo = 'mensalidade'
                                           and vencimento = current_date - 4));
select pg_temp.r('desfez o recebimento: bloqueia de novo', pg_temp.situacao(:'A') = 'bloqueio_total');

-- Mais dias de teste
select public.dono_estender_teste(:'B', 5);
select pg_temp.r('mais 5 dias de teste somam no fim do teste atual',
  (select teste_gratis_ate from public.fomentados where id = :'B') = current_date + 20);

-- WhatsApp automatico: so o dono liga
select public.dono_whatsapp(:'B', true);
select pg_temp.r('dono liga o WhatsApp automatico',
  (select liberado from public.recursos_extras where tenant_id = :'B' and recurso = 'whatsapp_automatico'));
select pg_temp.como('00000000-0000-0000-0000-0000000000a2');
select pg_temp.r('financeira nao consegue ligar o proprio WhatsApp automatico',
  pg_temp.falha($q$select public.dono_whatsapp('10000000-0000-0000-0000-0000000000a2', true)$q$));
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');

-- Uso: dono ve so numeros; nao ve clientes
select pg_temp.r('dono ve o uso de cada financeira', (select count(*) from public.dono_uso() where tenant_id in (:'A', :'B')) = 2);
select pg_temp.r('dono continua sem ver os clientes das financeiras', (select count(*) from public.clientes) = 0);

rollback;
