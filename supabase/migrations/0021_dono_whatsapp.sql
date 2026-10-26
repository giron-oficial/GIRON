-- GIRON - 0021: dono liga/desliga o WhatsApp automatico de cada financeira (igual ao robo do Telegram)
--  * So guarda a escolha; o envio automatico ainda vai ser construido.
--  * No teste gratis: ate 5 mensagens, cada uma pra um cliente diferente (regra do dono, 26/10/2026).

begin;

create or replace function public.dono_whatsapp(p_tenant uuid, p_ligado boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform giron_admin.exigir_dono();
  insert into public.recursos_extras (tenant_id, recurso, liberado)
  values (p_tenant, 'whatsapp_automatico', p_ligado)
  on conflict (tenant_id, recurso) do update set liberado = excluded.liberado, atualizado_em = now();
end $$;

revoke all on function public.dono_whatsapp(uuid, boolean) from public, anon;
grant execute on function public.dono_whatsapp(uuid, boolean) to authenticated;

commit;
