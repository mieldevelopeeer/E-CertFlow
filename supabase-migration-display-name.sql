-- Run once in Supabase SQL Editor (existing projects)
alter table credentials
  add column if not exists display_name text,
  add column if not exists photo_url text;

-- Backfill: use label as display_name where missing
update credentials
set display_name = label
where display_name is null or display_name = '';
