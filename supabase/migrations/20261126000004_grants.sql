-- New Supabase projects do not auto-grant table privileges to API roles.
-- Server (service_role): full access. Signed-in users: read only, still filtered by the RLS policies.
-- anon gets nothing.
grant select, insert, update, delete on public.profiles, public.patients, public.google_connections to service_role;
grant select on public.profiles, public.patients to authenticated;
