-- ============================================================================
-- Storage bucket for employee profile photos.
-- Run after 0001_init.sql.
-- ============================================================================

-- Public read is enabled so an <img> tag can render the photo without a signed
-- URL round-trip. Paths contain the employee's uuid, so they are not guessable,
-- but they are not secret either. To harden this, set `public` to false and
-- switch lib/employees/photos.ts to createSignedUrl() — see the README.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-photos',
  'employee-photos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may READ a photo (the bucket is public).
drop policy if exists "employee photos: public read" on storage.objects;
create policy "employee photos: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'employee-photos');

-- Only signed-in admins may write directly. Employee uploads go through the
-- server route, which uses the service-role key and checks the session cookie,
-- so no client-side write policy is needed for them.
drop policy if exists "employee photos: admin write" on storage.objects;
create policy "employee photos: admin write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'employee-photos' and public.is_admin());

drop policy if exists "employee photos: admin update" on storage.objects;
create policy "employee photos: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'employee-photos' and public.is_admin())
  with check (bucket_id = 'employee-photos' and public.is_admin());

drop policy if exists "employee photos: admin delete" on storage.objects;
create policy "employee photos: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'employee-photos' and public.is_admin());
