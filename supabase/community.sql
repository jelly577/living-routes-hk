-- Run once in the Supabase SQL editor. Private journals never enter this table.
create table public.community_posts (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  payload jsonb not null,
  constraint public_posts_only check ((payload->>'visibility' = 'community') is true),
  constraint bounded_post check (octet_length(payload::text) < 65536),
  constraint valid_text check ((jsonb_typeof(payload->'text') = 'string' and length(trim(payload->>'text')) between 1 and 10000) is true)
);
alter table public.community_posts enable row level security;
grant select on public.community_posts to anon, authenticated;
grant insert, delete on public.community_posts to authenticated;
create policy "Visitors read community posts" on public.community_posts
  for select to anon, authenticated using (true);
create policy "Owners publish posts" on public.community_posts
  for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners remove posts" on public.community_posts
  for delete to authenticated using (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-photos', 'community-photos', true, 2097152, array['image/jpeg']);
create policy "Owners upload community photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'community-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Owners remove community photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'community-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Owners inspect community photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'community-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
