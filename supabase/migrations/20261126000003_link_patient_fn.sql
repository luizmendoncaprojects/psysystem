-- Redeems a link code in one transaction: claims the patient record and updates the patient's profile.
-- Callable only by the API (service role); clients cannot execute it.
create or replace function public.link_patient(p_code text, p_user uuid)
returns table (patient_id uuid, psychologist_id uuid, patient_name text, psychologist_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.patients;
begin
  if exists (select 1 from public.profiles p where p.id = p_user and p.psychologist_id is not null) then
    raise exception 'already_linked';
  end if;

  update public.patients
     set user_id = p_user, linked_at = now(), link_code = null
   where link_code = p_code and user_id is null and code_expires_at > now()
  returning * into r;

  if r.id is null then
    raise exception 'invalid_code';
  end if;

  update public.profiles
     set psychologist_id = r.psychologist_id, patient_id = r.id::text
   where id = p_user;

  return query
    select r.id, r.psychologist_id, r.name, (select p.name from public.profiles p where p.id = r.psychologist_id);
end;
$$;

revoke execute on function public.link_patient(text, uuid) from public, anon, authenticated;
grant execute on function public.link_patient(text, uuid) to service_role;
