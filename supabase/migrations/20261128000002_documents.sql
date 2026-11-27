-- Signed documents and document requests. Shared between the psychologist panel and the patient app.
-- All access goes through the API (service role), which checks who owns each row.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  title text not null,
  body text not null,
  code text not null unique,          -- unique verification key printed on the PDF
  pdf text not null,                  -- signed PDF, base64
  signed_by text,
  signed_at timestamptz not null default now()
);
create index if not exists documents_psychologist_id_idx on public.documents (psychologist_id);
create index if not exists documents_patient_id_idx on public.documents (patient_id);

create table if not exists public.document_requests (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  kind text not null check (char_length(kind) between 2 and 120),
  why text check (char_length(why) <= 500),
  status text not null default 'Pendente' check (status in ('Pendente', 'Concluído')),
  created_at timestamptz not null default now()
);
create index if not exists document_requests_psychologist_id_idx on public.document_requests (psychologist_id);

alter table public.documents enable row level security;
alter table public.document_requests enable row level security;
grant select, insert, update, delete on public.documents, public.document_requests to service_role;

-- Sensitive columns hold AES-256-GCM ciphertext written by the API, so length checks no longer apply.
alter table public.document_requests drop constraint if exists document_requests_kind_check;
alter table public.document_requests drop constraint if exists document_requests_why_check;
