-- GIRON - 0019: logo da empresa do Fomentado (white-label)
--  * A logo aparece no menu do sistema (no lugar das iniciais) e, no futuro, nas telas do cliente final.
--  * Arquivo vai pro bucket PUBLICO "marcas" (logo nao e dado sigiloso e precisa abrir sem login).
--    Caminho: <tenant_id>/<arquivo>. O caminho fica gravado em fomentados.logo_arquivo.
--  * Cada Fomentado so manda, troca e apaga arquivos da propria pasta.

begin;

-- Ate 2 MB por arquivo; so PNG, JPEG e WEBP (SVG fica de fora: pode carregar script)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marcas', 'marcas', true, 2 * 1024 * 1024, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy giron_marca_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'marcas' and split_part(name, '/', 1) = public.meu_tenant_escrita()::text);

create policy giron_marca_ve on storage.objects for select to authenticated
  using (bucket_id = 'marcas' and split_part(name, '/', 1) = public.meu_tenant_leitura()::text);

create policy giron_marca_troca on storage.objects for update to authenticated
  using (bucket_id = 'marcas' and split_part(name, '/', 1) = public.meu_tenant_escrita()::text)
  with check (bucket_id = 'marcas' and split_part(name, '/', 1) = public.meu_tenant_escrita()::text);

create policy giron_marca_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'marcas' and split_part(name, '/', 1) = public.meu_tenant_escrita()::text);

-- Nome da empresa com no maximo 60 letras (cabe no menu)
alter table public.fomentados
  add constraint fomentados_nome_empresa_tamanho check (length(nome_empresa) <= 60) not valid;

commit;
