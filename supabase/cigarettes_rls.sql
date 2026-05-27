-- ============================================================
-- Row-Level Security for the `cigarettes` table.
-- Run this once in: Supabase Dashboard -> SQL Editor.
--
-- Without RLS enabled, by default new tables are READ/WRITE for
-- anyone with your anon key (including anonymous visitors).
-- This script locks the table down to signed-in users only.
-- ============================================================

alter table public.cigarettes enable row level security;

drop policy if exists "auth read cigarettes"  on public.cigarettes;
drop policy if exists "auth write cigarettes" on public.cigarettes;

create policy "auth read cigarettes" on public.cigarettes
  for select to authenticated using (true);

create policy "auth write cigarettes" on public.cigarettes
  for all to authenticated using (true) with check (true);
