-- KiWave: psychologist creates a patient (name only) and shares a link code;
-- the patient signs up, fills in their own data and redeems the code to link the accounts.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists birth_date date,
  add column if not exists cpf text,
  add column if not exists psychologist_id uuid references auth.users (id) on delete set null;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  user_id uuid unique references auth.users (id) on delete set null, -- set when the patient redeems the code
  link_code text unique,                                             -- cleared once used
  code_expires_at timestamptz,
  linked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists patients_psychologist_id_idx on public.patients (psychologist_id);

alter table public.patients enable row level security;

-- Reads only; all writes go through the API (service role), which enforces the linking rules.
create policy "patients: psychologist reads own" on public.patients
  for select to authenticated using ((select auth.uid()) = psychologist_id);
create policy "patients: patient reads own record" on public.patients
  for select to authenticated using ((select auth.uid()) = user_id);
