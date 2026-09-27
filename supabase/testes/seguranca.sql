-- GIRON - testes de seguranca do banco. Tudo dentro de uma transacao desfeita no fim (ROLLBACK).
-- Rodar com: ./scripts/testar-seguranca.sh teste
begin;

insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-00000000000a','a@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000000b','b@teste.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000000d','dono@teste.local','authenticated','authenticated');
insert into public.fomentados (id, nome_empresa, subdominio) values
 ('10000000-0000-0000-0000-00000000000a','Empresa A','empresaa'),
 ('10000000-0000-0000-0000-00000000000b','Empresa B','empresab');
insert into public.usuarios (id, tenant_id, papel) values
 ('00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','fomentado'),
 ('00000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000b','fomentado'),
 ('00000000-0000-0000-0000-00000000000d',null,'dono_giron');

create function pg_temp.como(u text) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u, true);
end $$;
create function pg_temp.r(t text, ok boolean) returns void language plpgsql as $$ begin
  raise notice '%  %', case when ok then 'PASSOU' else 'FALHOU' end, t; end $$;

-- A cadastra um cliente
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select public.cliente_criar('Maria Souza','123.456.789-09','63999990000');
select pg_temp.r('1. A ve o proprio cliente', (select count(*) from public.clientes)=1);
select pg_temp.r('2. A le o CPF completo do proprio cliente', public.cliente_cpf((select id from public.clientes limit 1))='12345678909');
do $$ begin perform public.cliente_criar('Fulano de Tal','111.111.111-11','63999990000'); perform pg_temp.r('19. CPF invalido e recusado', false);
exception when others then perform pg_temp.r('19. CPF invalido e recusado', sqlerrm = 'CPF inválido'); end $$;
do $$ begin perform public.cliente_criar('Maria Repetida','12345678909','63999990000'); perform pg_temp.r('20. CPF repetido na mesma empresa e recusado', false);
exception when others then perform pg_temp.r('20. CPF repetido na mesma empresa e recusado', sqlerrm like 'Já existe%'); end $$;
select pg_temp.r('21. Cliente cadastrado a mao nasce aprovado', (select status_cadastro from public.clientes where nome_completo='Maria Souza')='aprovado');
select public.cliente_criar('Sem Cpf Um','','63999990001');
select public.cliente_criar('Sem Cpf Dois',null,'63999990002');
select pg_temp.r('22. Dois clientes SEM CPF podem ser cadastrados', (select count(*) from public.clientes where cpf_final is null)=2);
select public.cliente_definir_cpf((select id from public.clientes where nome_completo='Sem Cpf Um'),'529.982.247-25');
select pg_temp.r('23. CPF completado depois e lido certo', public.cliente_cpf((select id from public.clientes where nome_completo='Sem Cpf Um'))='52998224725');
do $$ begin perform public.cliente_definir_cpf((select id from public.clientes where nome_completo='Sem Cpf Dois'),'529.982.247-25'); perform pg_temp.r('24. Completar com CPF repetido e recusado', false);
exception when others then perform pg_temp.r('24. Completar com CPF repetido e recusado', sqlerrm like 'Já existe%'); end $$;
do $$ begin perform public.cliente_definir_cpf((select id from public.clientes where nome_completo='Sem Cpf Um'),'111.444.777-35'); perform pg_temp.r('25. Nao troca CPF de quem ja tem', false);
exception when others then perform pg_temp.r('25. Nao troca CPF de quem ja tem', sqlerrm like '%já tem CPF'); end $$;
reset role;

-- B nao ve nada de A
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select pg_temp.r('3. B NAO ve cliente de A', (select count(*) from public.clientes)=0);
select pg_temp.r('4. B NAO le CPF de cliente de A', public.cliente_cpf((select id from public.clientes limit 1)) is null);
select pg_temp.r('5. B ve so a propria empresa', (select count(*) from public.fomentados)=1);
do $$ begin
  insert into public.chaves_pix (tenant_id, numero, tipo, chave) values ('10000000-0000-0000-0000-00000000000a',1,'cpf','x');
  perform pg_temp.r('6. B NAO grava na empresa de A', false);
exception when others then perform pg_temp.r('6. B NAO grava na empresa de A', true); end $$;
do $$ begin
  update public.fomentados set status_acesso='ativo', subdominio='outro' where id='10000000-0000-0000-0000-00000000000b';
  perform pg_temp.r('7. Fomentado NAO muda o proprio status/endereco', false);
exception when others then perform pg_temp.r('7. Fomentado NAO muda o proprio status/endereco', true); end $$;
reset role;

-- CPF nao sai pela consulta direta
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
do $$ begin
  perform cpf_criptografado from public.clientes;
  perform pg_temp.r('8. CPF criptografado NAO sai pela consulta direta', false);
exception when insufficient_privilege then perform pg_temp.r('8. CPF criptografado NAO sai pela consulta direta', true); end $$;
reset role;

-- Aprovar / reprovar
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
update public.clientes set status_cadastro = 'reprovado' where nome_completo = 'Sem Cpf Dois';
select pg_temp.r('26. A aprova/reprova o proprio cliente', (select status_cadastro from public.clientes where nome_completo='Sem Cpf Dois')='reprovado');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
update public.clientes set status_cadastro = 'aprovado' where nome_completo = 'Sem Cpf Dois';
reset role;
select pg_temp.r('27. B NAO muda status de cliente de A', (select status_cadastro from public.clientes where nome_completo='Sem Cpf Dois')='reprovado');

-- Emprestimos
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select public.contrato_criar((select id from public.clientes where nome_completo='Maria Souza'), 'mensal', 'empresa', 1000, 10, 10, '2026-10-01', '2026-11-01');
select pg_temp.r('28. A faz emprestimo pra cliente aprovado (10 parcelas de R$200)',
  (select count(*) from public.parcelas p join public.contratos c on c.id = p.contrato_id where p.valor = 200 and c.numero = 1) = 10);
do $$ begin perform public.contrato_criar((select id from public.clientes where nome_completo='Sem Cpf Dois'), 'mensal', 'empresa', 500, 10, 5, '2026-10-01', '2026-11-01');
  perform pg_temp.r('29. Cliente reprovado NAO recebe emprestimo', false);
exception when others then perform pg_temp.r('29. Cliente reprovado NAO recebe emprestimo', sqlerrm like 'Aprove%'); end $$;
do $$ begin insert into public.contratos (tenant_id, cliente_id, numero, modalidade, sistema_calculo, capital, juro_percentual, juro_valor, quantidade_parcelas, data_contrato, capital_em_aberto)
  select tenant_id, id, 99, 'mensal', 'empresa', 1, 0, 0, 1, current_date, 1 from public.clientes limit 1;
  perform pg_temp.r('30. Contrato NAO nasce fora da funcao (conta sempre certa)', false);
exception when insufficient_privilege then perform pg_temp.r('30. Contrato NAO nasce fora da funcao (conta sempre certa)', true); end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select pg_temp.r('31. B NAO ve emprestimo de A', (select count(*) from public.contratos) = 0 and (select count(*) from public.parcelas) = 0);
do $$ begin perform public.contrato_criar((select id from public.clientes limit 1), 'mensal', 'empresa', 1000, 10, 10, '2026-10-01', '2026-11-01');
  perform pg_temp.r('32. B NAO faz emprestimo pra cliente de A', false);
exception when others then perform pg_temp.r('32. B NAO faz emprestimo pra cliente de A', true); end $$;
reset role;

-- Dono do GIRON: ve empresas, NAO ve clientes
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
select pg_temp.r('9. Dono do GIRON ve as empresas de teste', (select count(*) from public.fomentados where subdominio in ('empresaa','empresab'))=2);
select pg_temp.r('10. Dono do GIRON NAO ve clientes dos Fomentados', (select count(*) from public.clientes)=0);
reset role;

-- Visitante sem login
set local role anon;
do $$ begin perform 1 from public.clientes; perform pg_temp.r('11. Visitante sem login NAO acessa', false);
exception when insufficient_privilege then perform pg_temp.r('11. Visitante sem login NAO acessa', true); end $$;
reset role;

-- Bloqueio parcial: ve, nao altera
update public.fomentados set status_acesso='bloqueio_parcial' where id='10000000-0000-0000-0000-00000000000a';
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select pg_temp.r('12. Bloqueio parcial: ainda VE os clientes', (select count(*) from public.clientes)=3);
do $$ begin perform public.cliente_criar('Joao','98765432100','63988880000'); perform pg_temp.r('13. Bloqueio parcial: NAO cadastra', false);
exception when others then perform pg_temp.r('13. Bloqueio parcial: NAO cadastra', true); end $$;
reset role;

-- Bloqueio total: nao ve nada
update public.fomentados set status_acesso='bloqueio_total' where id='10000000-0000-0000-0000-00000000000a';
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select pg_temp.r('14. Bloqueio total: NAO ve nada', (select count(*) from public.clientes)=0);
reset role;

-- Auditoria
select pg_temp.r('15. Auditoria registrou e sem CPF', (select count(*) from public.auditoria where tabela='clientes' and not (depois ? 'cpf_criptografado'))>=1);
do $$ begin delete from public.auditoria; perform pg_temp.r('16. Auditoria NAO pode ser apagada', false);
exception when others then perform pg_temp.r('16. Auditoria NAO pode ser apagada', true); end $$;

-- Regras de campo
do $$ begin insert into public.fomentados (nome_empresa, subdominio) values ('X','Carlos1'); perform pg_temp.r('17. Endereco com maiuscula/numero e recusado', false);
exception when check_violation then perform pg_temp.r('17. Endereco com maiuscula/numero e recusado', true); end $$;
do $$ begin insert into public.fomentados (nome_empresa, subdominio) values ('X','teste'); perform pg_temp.r('18. Nome reservado e recusado', false);
exception when check_violation then perform pg_temp.r('18. Nome reservado e recusado', true); end $$;

rollback;
