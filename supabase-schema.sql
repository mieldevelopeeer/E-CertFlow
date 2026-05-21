-- ══════════════════════════════════════════
-- MailBlast — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ══════════════════════════════════════════

-- 1. Credentials table
--    Stores SMTP email accounts (app passwords)
create table if not exists credentials (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,
  display_name  text,
  photo_url     text,
  email         text not null,
  smtp_host     text not null default 'smtp.gmail.com',
  smtp_port     int  not null default 465,
  app_password  text not null,
  created_at    timestamptz default now()
);

-- 2. Send logs — one row per email (attachments stored in Supabase Storage URLs)
create table if not exists send_logs (
  id                     uuid primary key default gen_random_uuid(),
  credential_id          uuid references credentials(id) on delete set null,
  recipient_email        text not null,
  recipient_name         text,
  subject                text,
  body                   text,
  status                 text not null default 'pending',
  error_msg              text,
  global_attachment_name text,
  global_attachment_url  text,
  recip_attachment_name  text,
  recip_attachment_url   text,
  created_at             timestamptz default now()
);

-- ══════════════════════════════════════════
-- Row Level Security (RLS)
-- Enable if you add auth; disable for personal/admin use
-- ══════════════════════════════════════════

-- For a personal admin tool (no user auth), you can leave RLS off.
-- If you want to enable it for multi-user later:
-- alter table credentials enable row level security;
-- alter table campaigns   enable row level security;
-- alter table attachments enable row level security;
-- alter table send_logs   enable row level security;


-- ══════════════════════════════════════════
-- Storage bucket
-- ══════════════════════════════════════════
-- Go to Storage > New bucket > name: "attachments"
-- Set to PUBLIC so Nodemailer can fetch attachment URLs to forward
-- Or keep private and generate signed URLs (more complex)

-- ══════════════════════════════════════════
-- Indexes for performance
-- ══════════════════════════════════════════
create index if not exists idx_send_logs_created on send_logs(created_at desc);
create index if not exists idx_send_logs_credential on send_logs(credential_id);
