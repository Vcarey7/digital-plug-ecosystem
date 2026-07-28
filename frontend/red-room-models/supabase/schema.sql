-- Red Room Models — database schema
-- Run this once in your Supabase project's SQL editor (Project -> SQL Editor -> New query).
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on signup
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Collector',
  role text not null default 'buyer' check (role in ('buyer', 'creator')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Public read: display_name/role aren't sensitive (email/password stay in
-- auth.users, which is never exposed) and marketplace listings need to show
-- a model's creator, so any visitor can read profile rows.
drop policy if exists "profiles: read own" on public.profiles;
drop policy if exists "profiles: public read" on public.profiles;
create policy "profiles: public read" on public.profiles
  for select using (true);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
-- Reads the display_name/role passed via supabase.auth.signUp({ options: { data } }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Collector'),
    coalesce(new.raw_user_meta_data ->> 'role', 'buyer')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- models: creator-submitted personas, reviewed before going live
-- ---------------------------------------------------------------------------
create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category text not null,
  tags text[] not null default '{}',
  tagline text,
  backstory text not null,
  gradient_from text not null default '#3a2e39',
  gradient_to text not null default '#c9a769',
  exclusive_price numeric not null check (exclusive_price >= 0),
  shared_price numeric not null check (shared_price >= 0),
  exclusive_available boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  created_at timestamptz not null default now()
);

alter table public.models enable row level security;

drop policy if exists "models: public read approved" on public.models;
create policy "models: public read approved" on public.models
  for select using (status = 'approved');

drop policy if exists "models: creator read own" on public.models;
create policy "models: creator read own" on public.models
  for select using (auth.uid() = creator_id);

drop policy if exists "models: creator insert own" on public.models;
create policy "models: creator insert own" on public.models
  for insert with check (auth.uid() = creator_id);

drop policy if exists "models: creator update own" on public.models;
create policy "models: creator update own" on public.models
  for update using (auth.uid() = creator_id);

-- ---------------------------------------------------------------------------
-- model_images: reference sets uploaded by the creator (private storage)
-- ---------------------------------------------------------------------------
create table if not exists public.model_images (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.model_images enable row level security;

drop policy if exists "model_images: creator read own" on public.model_images;
create policy "model_images: creator read own" on public.model_images
  for select using (
    exists (
      select 1 from public.models m
      where m.id = model_id and m.creator_id = auth.uid()
    )
  );

drop policy if exists "model_images: creator insert own" on public.model_images;
create policy "model_images: creator insert own" on public.model_images
  for insert with check (
    exists (
      select 1 from public.models m
      where m.id = model_id and m.creator_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- content_packs: pre-generated media collections sold from a given model
-- (not populated by the current Creator Studio form yet — schema is ready
-- for when pack uploads are added)
-- ---------------------------------------------------------------------------
create table if not exists public.content_packs (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models (id) on delete cascade,
  title text not null,
  media_count integer not null default 0,
  price numeric not null check (price >= 0),
  description text,
  created_at timestamptz not null default now()
);

alter table public.content_packs enable row level security;

drop policy if exists "content_packs: public read for approved models" on public.content_packs;
create policy "content_packs: public read for approved models" on public.content_packs
  for select using (
    exists (
      select 1 from public.models m
      where m.id = model_id and m.status = 'approved'
    )
  );

drop policy if exists "content_packs: creator manage own" on public.content_packs;
create policy "content_packs: creator manage own" on public.content_packs
  for all using (
    exists (
      select 1 from public.models m
      where m.id = model_id and m.creator_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- orders: license purchases. model_id is stored as text (not a foreign key)
-- so it can reference either a real models.id or one of the built-in demo
-- persona slugs (e.g. "aurelia-vane") used for the curated showcase.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  model_id text not null,
  model_name text not null,
  tier text check (tier in ('exclusive', 'shared')),
  pack_titles text[] not null default '{}',
  total numeric not null check (total >= 0),
  certificate_id text not null,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "orders: buyer read own" on public.orders;
create policy "orders: buyer read own" on public.orders
  for select using (auth.uid() = buyer_id);

drop policy if exists "orders: buyer insert own" on public.orders;
create policy "orders: buyer insert own" on public.orders
  for insert with check (auth.uid() = buyer_id);

-- Lets a buyer's checkout safely claim an exclusive license without needing
-- a broad UPDATE policy: it only flips exclusive_available true -> false,
-- atomically, and only for an approved model. Runs as the function owner
-- (security definer) rather than the calling user's own RLS permissions.
create or replace function public.purchase_exclusive(target_model_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  rows_affected int;
begin
  update public.models
  set exclusive_available = false
  where id = target_model_id and status = 'approved' and exclusive_available = true;
  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;

grant execute on function public.purchase_exclusive(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: create a private bucket named "model-references" in
-- Storage -> Buckets (uncheck "Public bucket") before running this, then
-- run the policies below. Files are stored under "<creator_id>/<model_id>/...".
-- ---------------------------------------------------------------------------
drop policy if exists "model-references: creator insert own" on storage.objects;
create policy "model-references: creator insert own" on storage.objects
  for insert with check (
    bucket_id = 'model-references'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "model-references: creator read own" on storage.objects;
create policy "model-references: creator read own" on storage.objects
  for select using (
    bucket_id = 'model-references'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "model-references: creator delete own" on storage.objects;
create policy "model-references: creator delete own" on storage.objects
  for delete using (
    bucket_id = 'model-references'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
