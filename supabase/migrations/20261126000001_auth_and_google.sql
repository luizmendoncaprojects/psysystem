-- KiWave: user roles and Google Calendar connections.
-- Accounts live in Supabase Auth (auth.users); this adds the app role and the Google OAuth tokens.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('psicologa', 'paciente')),
  name text not null,
  patient_id text, -- links a patient account to its record in the app
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Each user reads only their own profile. No insert/update/delete policies:
-- roles are assigned by the server (service role), never by the client.
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create table if not exists public.google_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_email text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  scope text,
  connected_at timestamptz not null default now()
);

-- RLS on with no policies: only the server (service role) can read or write OAuth tokens.
alter table public.google_connections enable row level security;
