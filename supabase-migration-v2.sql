-- CertFlow v2: send_logs columns (recipient_name already exists on send_logs)
-- Sender name is stored in credentials.label (not display_name)
-- Run in Supabase SQL Editor

alter table send_logs
  add column if not exists credential_id uuid references credentials(id) on delete set null,
  add column if not exists subject text,
  add column if not exists body text,
  add column if not exists global_attachment_name text,
  add column if not exists global_attachment_url text,
  add column if not exists recip_attachment_name text,
  add column if not exists recip_attachment_url text;

alter table send_logs alter column campaign_id drop not null;

create index if not exists idx_send_logs_credential on send_logs(credential_id);
