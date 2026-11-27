-- Psychologist's digital certificate (ICP-Brasil A1). The .pfx and its password are encrypted by the API
-- (AES-256-GCM, key CERT_KEY) before reaching the database: the database never sees them in clear text.
create table if not exists public.certificates (
  psychologist_id uuid primary key references auth.users (id) on delete cascade,
  file_name text not null,
  pfx_enc text not null,
  password_enc text not null,
  subject text,
  issuer text,
  valid_until timestamptz,
  uploaded_at timestamptz not null default now()
);

-- RLS on with no policies: only the server (service role) can read or write certificates.
alter table public.certificates enable row level security;
grant select, insert, update, delete on public.certificates to service_role;
