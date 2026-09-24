-- ===================================================================
-- Gender Shapes — database setup
--
-- Run in Supabase dashboard → SQL Editor. Safe to re-run: every
-- statement is idempotent, so it works on a fresh project AND on one
-- that already has the table/policies (it replaces them by name).
-- ===================================================================


-- -------------------------------------------------------------------
-- 1. Table
-- -------------------------------------------------------------------
create table if not exists public.shapes (
  id           uuid primary key default gen_random_uuid(),
  display_name text  not null,
  shape        jsonb not null
);

-- "Show my name in The world" toggle. Existing rows default to visible,
-- so nobody who already saved a shape disappears from the names list.
alter table public.shapes
  add column if not exists name_visible boolean not null default true;

-- "The forest" plants trees in the order people saved them, so a new tree
-- always grows on the outside and nobody's tree ever moves. That needs a
-- timestamp. Rows saved before this migration all get "now" (they keep a
-- stable order among themselves via id); every new row gets its real time.
-- Without this column the app still works: it falls back to ordering by id.
alter table public.shapes
  add column if not exists created_at timestamptz not null default now();


-- -------------------------------------------------------------------
-- 2. Row Level Security
--    The anon key in assets/js/config.js is public by design; these
--    policies ARE the security.
-- -------------------------------------------------------------------
alter table public.shapes enable row level security;

-- Read: "The world" view and "Find by ID".
drop policy if exists "anyone can read" on public.shapes;
create policy "anyone can read" on public.shapes
  for select to anon
  using (true);

-- Insert: saving a new shape.
drop policy if exists "anyone can insert" on public.shapes;
create policy "anyone can insert" on public.shapes
  for insert to anon
  with check (true);

-- Update: editing a shape you loaded by ID.
-- NOTE: this is fully open — anyone who has a row's id can overwrite it,
-- and the world view fetches every id. See README ("Backend") if you
-- want to tighten this later.
drop policy if exists "anon can update" on public.shapes;
create policy "anon can update" on public.shapes
  for update to anon
  using (true)
  with check (true);


-- -------------------------------------------------------------------
-- 3. One-time cleanup of the old connection-test setup
--    The current app no longer creates "__connection_test" rows, so this
--    policy isn't needed. It's also a little loose: anyone can name their
--    shape "__connection_test…" and then anyone can delete it.
--    Remove the leftovers, then drop the policy.
-- -------------------------------------------------------------------
delete from public.shapes where display_name like '\_\_connection\_test%';

drop policy if exists "anon can delete test rows" on public.shapes;

-- Optional: the table from the previous version of the app, if unused.
-- drop table if exists public.results;


-- -------------------------------------------------------------------
-- 4. Verify
--    Expect exactly three policies: select, insert, update.
--    Expect columns: id, display_name, shape, name_visible, created_at.
-- -------------------------------------------------------------------
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'shapes'
order by cmd;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'shapes'
order by ordinal_position;
