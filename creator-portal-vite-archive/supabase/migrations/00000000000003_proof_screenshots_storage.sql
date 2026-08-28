insert into storage.buckets (id, name, public)
values ('proof-screenshots', 'proof-screenshots', false)
on conflict (id) do nothing;

-- creators upload only into their own uid-prefixed folder: {uid}/filename
create policy "creators upload own proof screenshots"
  on storage.objects for insert
  with check (
    bucket_id = 'proof-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "creators view own proof screenshots, admins view all"
  on storage.objects for select
  using (
    bucket_id = 'proof-screenshots'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
