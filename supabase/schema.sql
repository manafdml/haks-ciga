-- ============================================================
-- Hak's Ciga Co — Supabase schema
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- 1) Per-product settings (just the selling price for now).
create table if not exists public.product_settings (
  product_id text primary key
    check (product_id in ('gosale','rothman','oris')),
  selling_price numeric not null default 0
);

insert into public.product_settings (product_id) values
  ('gosale'), ('rothman'), ('oris')
on conflict (product_id) do nothing;

-- 2) Box purchases (inventory in).
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  product_id text not null
    check (product_id in ('gosale','rothman','oris')),
  boxes int not null check (boxes > 0),
  cost_per_box numeric not null check (cost_per_box >= 0),
  pieces_per_box int not null check (pieces_per_box > 0),
  created_at timestamptz not null default now()
);

-- 3) Daily sales records (one row = one day's total for one product).
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id text not null
    check (product_id in ('gosale','rothman','oris')),
  qty int not null check (qty > 0),
  price numeric not null check (price >= 0),
  cost numeric not null check (cost >= 0),
  sale_date date not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row-Level Security: any signed-in user can read & write
-- (Data is shared across all users of the shop.)
-- ============================================================
alter table public.product_settings enable row level security;
alter table public.purchases        enable row level security;
alter table public.sales            enable row level security;

-- product_settings
drop policy if exists "auth read settings"  on public.product_settings;
drop policy if exists "auth write settings" on public.product_settings;
create policy "auth read settings"  on public.product_settings
  for select to authenticated using (true);
create policy "auth write settings" on public.product_settings
  for all to authenticated using (true) with check (true);

-- purchases
drop policy if exists "auth read purchases"  on public.purchases;
drop policy if exists "auth write purchases" on public.purchases;
create policy "auth read purchases"  on public.purchases
  for select to authenticated using (true);
create policy "auth write purchases" on public.purchases
  for all to authenticated using (true) with check (true);

-- sales
drop policy if exists "auth read sales"  on public.sales;
drop policy if exists "auth write sales" on public.sales;
create policy "auth read sales"  on public.sales
  for select to authenticated using (true);
create policy "auth write sales" on public.sales
  for all to authenticated using (true) with check (true);
