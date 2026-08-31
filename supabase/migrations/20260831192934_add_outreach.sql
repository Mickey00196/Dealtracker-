-- Outreach queue: touch tracking, cadence, and next-touch scheduling.
-- Run this against the Supabase project before deploying the code.

-- ---------------------------------------------------------------------------
-- 1. Outreach status enum
-- ---------------------------------------------------------------------------

create type public.outreach_status as enum (
  'active',     -- in the cadence, keep touching
  'responded',  -- they replied; company moves onto the mandate board
  'parked',     -- exhausted the cadence, revisit later
  'dead'        -- explicitly not interested
);

create type public.touch_outcome as enum (
  'no_answer',
  'not_now',
  'not_interested',
  'responded',
  'meeting_booked'
);

-- ---------------------------------------------------------------------------
-- 2. Columns on companies
-- ---------------------------------------------------------------------------

alter table public.companies
  add column outreach_status public.outreach_status not null default 'active',
  add column touch_count     integer                 not null default 0,
  add column last_touch_at   timestamptz,
  add column next_touch_at   timestamptz,
  add column employee_count  integer,
  add column industry        text not null default '',
  add column website         text not null default '';

-- Existing mandates are already live conversations, not cold targets.
update public.companies
   set outreach_status = 'responded'
 where stage <> 'targeting';

create index companies_next_touch_idx
  on public.companies (next_touch_at)
  where archived = false;

create index companies_outreach_status_idx
  on public.companies (outreach_status);

-- ---------------------------------------------------------------------------
-- 3. Touches table
--
-- One row per contact attempt. Separate from log_entries because these are
-- structured events used for counting, where log entries are prose. Append
-- only, same as the logbook.
-- ---------------------------------------------------------------------------

create table public.touches (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  outcome      public.touch_outcome not null,
  touch_number integer not null,
  note         text not null default '',
  created_at   timestamptz not null default now()
);

create index touches_company_idx on public.touches (company_id, created_at desc);
create index touches_created_idx on public.touches (created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Access
--
-- Single-user tool, mirroring the permissive policies already on companies
-- and log_entries. Tighten these if the app ever gets more than one user.
-- ---------------------------------------------------------------------------

grant select, insert on public.touches to anon, authenticated;
grant all on public.touches to service_role;

alter table public.touches enable row level security;

create policy "touches_read"
  on public.touches for select to anon, authenticated using (true);

create policy "touches_insert"
  on public.touches for insert to anon, authenticated with check (true);
