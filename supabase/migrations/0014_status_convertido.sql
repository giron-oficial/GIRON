-- GIRON - 0014: situacao "convertido" do contrato (Fase 5 passo 5.4, parte 3)
-- Fica num arquivo separado porque o Postgres so deixa usar um valor novo de enum depois do commit.
-- Convertido = Recorrente que virou parcelado; sai da cobranca e aponta pro contrato novo.

begin;
alter type public.status_contrato add value if not exists 'convertido';
commit;
