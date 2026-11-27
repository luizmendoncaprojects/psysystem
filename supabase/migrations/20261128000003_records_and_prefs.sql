-- Patient record shared by the panel and the patient app, split into keys with a single writer each:
--   psychologist writes: plan (perms, habits, meds, water goal), clinical (cid, risk), rxStatus
--   patient writes:      log (mood, sleep, water, emotions, habit checks, doses), diary, topics, rx
-- data holds AES-256-GCM ciphertext written by the API (CERT_KEY): the database never sees it in clear text.
create table if not exists public.patient_records (
  patient_id uuid not null references public.patients (id) on delete cascade,
  key text not null check (key in ('plan', 'clinical', 'rxStatus', 'log', 'diary', 'topics', 'rx')),
  data text not null,
  updated_at timestamptz not null default now(),
  primary key (patient_id, key)
);

-- Per-account preferences (theme, accent, text size…), encrypted the same way.
create table if not exists public.user_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data text not null,
  updated_at timestamptz not null default now()
);

alter table public.patient_records enable row level security;
alter table public.user_prefs enable row level security;
grant select, insert, update, delete on public.patient_records, public.user_prefs to service_role;
