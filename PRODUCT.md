# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences of equal weight. When their needs conflict, decide per surface; neither side is subordinate by default.

- **Psychologists (psicólogas)** in Brazilian private practice. They use the desktop panel (`/painel`) to run the practice: patients, agenda, documents, alerts, pre-session summaries.
- **Their patients.** They use the mobile patient app (`/app`) between sessions to log mood, emotions, habits, sleep, water, medication, prescriptions and a diary, and to prepare topics for the next session. A patient links to one psychologist with a 6-character code or link the psychologist sends.

## Product Purpose

KiWave ("acompanhamento entre sessões para pacientes e psicólogas") connects what happens between therapy sessions to the session itself, and gives the psychologist one place to run the practice. Success: patients keep logging between sessions, and the psychologist arrives at each session with a ready summary and runs the rest of the practice without leaving KiWave.

## Positioning

All-in-one practice tool for psychologists: agenda with Google Calendar sync, patient tracking from the patient app, clinical documents with digital signature, AI-assisted report drafts, and invoices, in one product, with the patient app built in rather than bolted on.

## Operating Context

- Psychologist: desktop, during the workday and between sessions; reviews the pre-session summary ("Resumo pré-sessão") before each session; sends documents and invoices to the patient app.
- Patient: phone, quick daily check-ins; mood can be logged several times a day (scale 1–6); past days are read-only except sleep.
- Sessions are 50 min; the video link opens 10 min before.
- Patients use invoices sent to their CPF to declare medical expenses on Imposto de Renda.

## Capabilities and Constraints

- Patient features (each can be turned on or off per patient by the psychologist): Humor, Emoções, Hábitos, Sono, Água, Remédios, Envio de receitas, Diário, Assuntos da sessão (pauta).
- Patient chooses what to share in each diary record; the psychologist sees the session agenda before the session.
- Medication list is entered by the psychologist from the patient's prescriptions; dose changes are agreed with the prescribing doctor, not in the app.
- Panel: patient list and profile, alerts (simple rules over patient records; the risk level is always set by the psychologist), screening scales (free-use only; SATEPSI-restricted instruments stay out until validated), AI report draft that the psychologist reviews and completes before signing, documents signed with an ICP-Brasil digital certificate, each with a verification code.
- Health data under LGPD art. 11: shared only with the psychologist the patient links to. Patient data is encrypted server-side.
- Language: Brazilian Portuguese (pt-BR) only. Terms in use: psicóloga, paciente, sessão, pauta, registro, Resumo pré-sessão, Painel.
- Stack: React (Create React App), Node API on Vercel serverless, Supabase (Postgres).
- PWA metadata present (installable, standalone).

## Brand Commitments

- Name: KiWave.
- Voice: plain, warm, second person to the patient ("sua psicóloga", "você decide o que compartilhar"); clear about who sees what.
- Patient prefs already offer light/dark theme, five accent colors, text size and a colorblind option.

## Evidence on Hand

Pre-launch. No real users, testimonials, customer counts or metrics exist. All people and records in the app are demo data, including the "Débora Mendonça" psychologist persona, the sample patients, CRP/CNPJ placeholders and the sample invoice. Future work must not present any of these as real proof.

## Product Principles

1. Serve both sides: a feature is not done until it works for the psychologist who reviews it and the patient who produces it.
2. The psychologist stays in charge of clinical judgment: the app flags, drafts and summarizes; the psychologist decides, reviews and signs.
3. Say who sees the data, every time the patient records something.
4. One place for the practice: prefer bringing a workflow into KiWave over sending the psychologist to another tool.
5. Logging must take seconds on a phone, or patients stop.

## Accessibility & Inclusion

Patient app supports adjustable text size, a colorblind mode and dark theme; keep these working on every new surface. No formal standard was set; treat WCAG 2.2 AA as the floor.
