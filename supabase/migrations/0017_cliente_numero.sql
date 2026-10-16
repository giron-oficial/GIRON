-- GIRON - numero do cliente (ID de busca: #0001, #0002...) - pedido do dono em 17/10/2026.
-- Cada Fomentado tem a propria contagem, comeca em 1, nunca muda e nunca e reaproveitada
-- (cliente reprovado ou apagado "queima" o numero). Os contratos ja sao numerados por cliente (CT-01, CT-02...).
begin;

-- Contador por Fomentado: guarda o ultimo numero dado (assim um numero apagado nao volta)
alter table public.fomentados add column ultimo_numero_cliente integer not null default 0;

alter table public.clientes add column numero integer;

-- Clientes que ja existem: numero pela ordem de cadastro
update public.clientes c set numero = x.n
  from (select id, row_number() over (partition by tenant_id order by criado_em, id) as n
          from public.clientes) x
 where x.id = c.id;
update public.fomentados f set ultimo_numero_cliente = coalesce(
  (select max(numero) from public.clientes where tenant_id = f.id), 0);

alter table public.clientes alter column numero set not null,
  add constraint clientes_numero_positivo check (numero > 0),
  add constraint clientes_tenant_numero_unico unique (tenant_id, numero);

-- Cliente novo (a mao ou pelo link) ganha o proximo numero; numero nunca muda depois
create or replace function giron_admin.cliente_numero() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.fomentados set ultimo_numero_cliente = ultimo_numero_cliente + 1
     where id = new.tenant_id
     returning ultimo_numero_cliente into new.numero;
  else
    new.numero := old.numero;
  end if;
  return new;
end $$;
revoke all on function giron_admin.cliente_numero() from public, anon, authenticated;

create trigger clientes_numero before insert or update on public.clientes
  for each row execute function giron_admin.cliente_numero();

-- Ninguem mexe no contador pela tela (so o gatilho acima, que roda como dono do banco)
create or replace function public.fomentado_so_muda_marca() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.ultimo_numero_cliente is distinct from old.ultimo_numero_cliente then
    raise exception 'O contador de numero de cliente nao pode ser alterado';
  end if;
  if not public.sou_dono_giron() and current_user = 'authenticated' then
    if new.status_acesso is distinct from old.status_acesso
       or new.bloqueio_manual is distinct from old.bloqueio_manual
       or new.teste_gratis_ate is distinct from old.teste_gratis_ate
       or new.subdominio is distinct from old.subdominio
       or new.id is distinct from old.id then
      raise exception 'Somente o dono do GIRON pode alterar status, bloqueio, teste gratis ou endereco';
    end if;
  end if;
  return new;
end $$;

-- A tela pode ler o numero (alterar, nao)
grant select (numero) on public.clientes to authenticated;

commit;
