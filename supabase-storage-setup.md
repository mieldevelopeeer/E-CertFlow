# Supabase Storage setup (required to view attachments in Sent emails)

1. Open your project at [supabase.com](https://supabase.com)
2. Go to **Storage** → **New bucket**
3. Name: `attachments` (exactly)
4. Enable **Public bucket**
5. Create bucket

### Policies (if uploads fail with permission error)

In Storage → `attachments` → Policies, add for **anon** / **authenticated**:

- **INSERT** allowed
- **SELECT** allowed (public read)

Or use this in SQL Editor:

```sql
-- Allow public read
create policy "Public read attachments"
on storage.objects for select
using ( bucket_id = 'attachments' );

-- Allow uploads (adjust for your auth setup)
create policy "Allow upload attachments"
on storage.objects for insert
with check ( bucket_id = 'attachments' );
```

Emails still **send with attachments** via Gmail even without this bucket; the bucket only stores copies for viewing/resending in CertFlow.
