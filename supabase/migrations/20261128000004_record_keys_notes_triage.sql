-- The psychologist also stores the prontuário (notes) and her topic priorities (triage) in the patient record.
alter table public.patient_records drop constraint if exists patient_records_key_check;
alter table public.patient_records add constraint patient_records_key_check
  check (key in ('plan', 'clinical', 'rxStatus', 'notes', 'triage', 'log', 'diary', 'topics', 'rx'));
