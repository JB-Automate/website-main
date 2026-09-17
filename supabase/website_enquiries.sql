-- Run this in the Supabase SQL editor for the project used by the public website.
-- The browser receives only a publishable key. Never expose a secret/service-role key.

create table if not exists public.website_enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submission_id uuid not null unique,
  session_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  company text not null default '' check (char_length(company) <= 200),
  message text not null check (char_length(message) between 1 and 5000),
  source_path text not null default '/' check (char_length(source_path) between 1 and 512),
  follow_up_status text not null default 'new' check (follow_up_status in ('new', 'contacted', 'closed'))
);

alter table public.website_enquiries enable row level security;

-- Start from no public privileges, then grant only the columns the website must insert.
revoke all on table public.website_enquiries from anon, authenticated;
grant insert (submission_id, session_id, name, email, company, message, source_path)
  on table public.website_enquiries to anon;

drop policy if exists "public website may submit enquiries" on public.website_enquiries;
create policy "public website may submit enquiries"
  on public.website_enquiries
  for insert
  to anon
  with check (
    char_length(name) between 1 and 120
    and char_length(email) between 3 and 254
    and char_length(company) <= 200
    and char_length(message) between 1 and 5000
    and char_length(source_path) between 1 and 512
  );

-- Intentionally no SELECT, UPDATE, or DELETE grants/policies for anon or authenticated.
